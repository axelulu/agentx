import { randomUUID } from "node:crypto";
import { MemoryStore } from "./memory-store.js";
import type { ConversationSummary, LearnedFact, MemoryConfig, MemoryExtraction } from "./types.js";
import { DEFAULT_MEMORY_CONFIG } from "./types.js";

/**
 * Manages cross-session agent memory: conversation summaries and learned facts.
 *
 * Responsibilities:
 * - Extract summaries + facts from completed conversations via LLM
 * - Persist them to disk
 * - Build context strings for injection into system prompts
 * - Deduplicate and prune old entries
 */
export class MemoryManager {
  private store: MemoryStore;
  private config: MemoryConfig = { ...DEFAULT_MEMORY_CONFIG };

  /** Cache to avoid re-reading disk on every sendMessage */
  private summariesCache: ConversationSummary[] | null = null;
  private factsCache: LearnedFact[] | null = null;

  constructor(dataDir: string) {
    this.store = new MemoryStore(dataDir);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    this.config = await this.store.getConfig();
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  async setConfig(config: MemoryConfig): Promise<void> {
    this.config = { ...config };
    await this.store.saveConfig(this.config);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ---------------------------------------------------------------------------
  // Summaries CRUD
  // ---------------------------------------------------------------------------

  async getSummaries(): Promise<ConversationSummary[]> {
    if (!this.summariesCache) {
      this.summariesCache = await this.store.getSummaries();
    }
    return this.summariesCache;
  }

  async addSummary(
    conversationId: string,
    title: string,
    summary: string,
    topics: string[],
  ): Promise<ConversationSummary> {
    const summaries = await this.getSummaries();

    // Replace existing summary for same conversation
    const existing = summaries.findIndex((s) => s.conversationId === conversationId);
    const entry: ConversationSummary = {
      id: existing >= 0 ? summaries[existing]!.id : randomUUID(),
      conversationId,
      title,
      summary,
      topics,
      createdAt: Date.now(),
    };

    if (existing >= 0) {
      summaries[existing] = entry;
    } else {
      summaries.push(entry);
    }

    // Prune oldest if over limit
    while (summaries.length > this.config.maxSummaries) {
      summaries.shift();
    }

    this.summariesCache = summaries;
    await this.store.saveSummaries(summaries);
    return entry;
  }

  async deleteSummary(id: string): Promise<void> {
    const summaries = await this.getSummaries();
    this.summariesCache = summaries.filter((s) => s.id !== id);
    await this.store.saveSummaries(this.summariesCache);
  }

  /** Remove summaries for a deleted conversation */
  async removeSummariesForConversation(conversationId: string): Promise<void> {
    const summaries = await this.getSummaries();
    const filtered = summaries.filter((s) => s.conversationId !== conversationId);
    if (filtered.length !== summaries.length) {
      this.summariesCache = filtered;
      await this.store.saveSummaries(filtered);
    }
  }

  // ---------------------------------------------------------------------------
  // Facts CRUD
  // ---------------------------------------------------------------------------

  async getFacts(): Promise<LearnedFact[]> {
    if (!this.factsCache) {
      this.factsCache = await this.store.getFacts();
    }
    return this.factsCache;
  }

  async addFact(
    category: LearnedFact["category"],
    content: string,
    sourceConversationId: string,
  ): Promise<LearnedFact> {
    const facts = await this.getFacts();

    // Deduplicate: if a very similar fact exists, update it
    const duplicate = facts.find(
      (f) => f.category === category && this.isSimilar(f.content, content),
    );
    if (duplicate) {
      duplicate.content = content;
      duplicate.updatedAt = Date.now();
      this.factsCache = facts;
      await this.store.saveFacts(facts);
      return duplicate;
    }

    const entry: LearnedFact = {
      id: randomUUID(),
      category,
      content,
      sourceConversationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    facts.push(entry);

    // Prune oldest if over limit
    while (facts.length > this.config.maxFacts) {
      facts.shift();
    }

    this.factsCache = facts;
    await this.store.saveFacts(facts);
    return entry;
  }

  async deleteFact(id: string): Promise<void> {
    const facts = await this.getFacts();
    this.factsCache = facts.filter((f) => f.id !== id);
    await this.store.saveFacts(this.factsCache);
  }

  async updateFact(id: string, content: string): Promise<LearnedFact | null> {
    const facts = await this.getFacts();
    const fact = facts.find((f) => f.id === id);
    if (!fact) return null;
    fact.content = content;
    fact.updatedAt = Date.now();
    this.factsCache = facts;
    await this.store.saveFacts(facts);
    return fact;
  }

  // ---------------------------------------------------------------------------
  // Memory extraction (called after conversation ends)
  // ---------------------------------------------------------------------------

  /**
   * Extract memories from a completed conversation.
   * Uses the provided streamFn to make an LLM call.
   *
   * streamFn follows the StreamFn signature:
   *   (messages: LLMMessage[], options: StreamFnOptions) => AsyncIterable<LLMStreamChunk>
   */
  async extractMemories(
    conversationId: string,
    title: string,
    messages: Array<{ role: string; content: string | null }>,
    streamFn: (
      messages: Array<{ role: string; content: unknown }>,
      options: { model: string; maxTokens?: number },
    ) => AsyncIterable<{ type: string; delta?: string; text?: string }>,
    model: string,
  ): Promise<MemoryExtraction | null> {
    if (!this.config.enabled || !this.config.autoExtract) return null;

    // Build a condensed transcript (only user + assistant text, truncated)
    const transcript = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
      .map((m) => `${m.role}: ${m.content!.slice(0, 500)}`)
      .slice(-20) // last 20 turns max
      .join("\n");

    if (transcript.length < 50) return null; // too short to extract from

    const extractionPrompt = `Analyze this conversation and extract:
1. A concise 1-2 sentence summary of what was discussed/accomplished
2. 1-3 topic tags (short keywords)
3. Any user preferences, project conventions, or recurring patterns worth remembering for future conversations (0-3 items)

For facts, categorize each as:
- "preference": User's personal preferences (coding style, tool choices, communication style)
- "project": Project-specific context (tech stack, architecture, file structure)
- "pattern": Recurring patterns or solutions
- "instruction": Explicit user instructions for how the agent should behave

Conversation title: "${title}"

Transcript:
${transcript}

Respond in JSON format only:
{
  "summary": "...",
  "topics": ["...", "..."],
  "facts": [
    { "category": "preference|project|pattern|instruction", "content": "..." }
  ]
}

If there are no notable facts to remember, return an empty facts array. Only extract facts that would genuinely be useful in future conversations. Respond with ONLY the JSON, no markdown fences.`;

    try {
      let result = "";
      const stream = streamFn(
        [
          {
            role: "system",
            content:
              "You are a memory extraction assistant. Extract structured information from conversations. Always respond with valid JSON only.",
          },
          { role: "user", content: extractionPrompt },
        ],
        { model, maxTokens: 500 },
      );

      for await (const event of stream) {
        if (event.delta) result += event.delta;
        else if (event.text) result += event.text;
      }

      // Parse the JSON response
      const cleaned = result
        .trim()
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "");
      const extraction = JSON.parse(cleaned) as MemoryExtraction;

      // Validate structure
      if (!extraction.summary || !Array.isArray(extraction.topics)) {
        console.warn("[MemoryManager] Invalid extraction format, skipping");
        return null;
      }

      return extraction;
    } catch (err) {
      console.error("[MemoryManager] Failed to extract memories:", err);
      return null;
    }
  }

  /**
   * Process an extraction result: persist summary and facts.
   */
  async processExtraction(
    conversationId: string,
    title: string,
    extraction: MemoryExtraction,
  ): Promise<void> {
    // Save summary
    await this.addSummary(conversationId, title, extraction.summary, extraction.topics);

    // Save facts
    for (const fact of extraction.facts) {
      if (fact.content && fact.category) {
        await this.addFact(fact.category, fact.content, conversationId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Context building (for injection into system prompts)
  // ---------------------------------------------------------------------------

  /**
   * Build a context string from stored memories, filtered by relevance
   * to the current conversation.
   *
   * @param conversationContext - Recent user/assistant messages to match against.
   *   If empty, falls back to injecting instruction facts + recent summaries only.
   */
  async buildMemoryContext(
    conversationContext?: Array<{ role: string; content: string | null }>,
  ): Promise<string> {
    if (!this.config.enabled) return "";

    const [summaries, facts] = await Promise.all([this.getSummaries(), this.getFacts()]);

    if (summaries.length === 0 && facts.length === 0) return "";

    // Extract keywords from current conversation for relevance matching
    const contextKeywords = this.extractContextKeywords(conversationContext ?? []);

    // --- Filter facts by relevance ---
    const relevantFacts = this.filterRelevantFacts(facts, contextKeywords);
    const relevantSummaries = this.filterRelevantSummaries(summaries, contextKeywords);

    if (relevantFacts.length === 0 && relevantSummaries.length === 0) return "";

    const sections: string[] = [];
    sections.push("## Agent Memory (Cross-Session)");
    sections.push(
      "The following is your persistent memory from previous conversations. Use it to provide continuity and personalized responses.\n",
    );

    if (relevantFacts.length > 0) {
      sections.push("### Learned Facts");
      const grouped: Record<string, string[]> = {};
      for (const f of relevantFacts) {
        if (!grouped[f.category]) grouped[f.category] = [];
        grouped[f.category]!.push(f.content);
      }
      for (const [cat, items] of Object.entries(grouped)) {
        sections.push(`**${cat}**:`);
        for (const item of items) {
          sections.push(`- ${item}`);
        }
      }
    }

    if (relevantSummaries.length > 0) {
      sections.push("\n### Relevant Conversation History");
      for (const s of relevantSummaries) {
        const date = new Date(s.createdAt).toLocaleDateString();
        sections.push(`- [${date}] **${s.title}**: ${s.summary}`);
      }
    }

    return sections.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Relevance scoring for selective recall
  // ---------------------------------------------------------------------------

  /**
   * Extract normalized keywords from conversation messages for matching.
   */
  private extractContextKeywords(
    messages: Array<{ role: string; content: string | null }>,
  ): Set<string> {
    const keywords = new Set<string>();
    for (const msg of messages) {
      if (!msg.content) continue;
      // Weight user messages — only extract from user + assistant text
      if (msg.role !== "user" && msg.role !== "assistant") continue;
      const text = msg.content;

      // File paths
      const paths = text.match(/(?:\/[\w.-]+){2,}/g);
      if (paths) {
        for (const fp of paths) {
          keywords.add(fp.toLowerCase());
          const filename = fp.split("/").pop();
          if (filename) keywords.add(filename.toLowerCase());
        }
      }

      // Identifiers (3+ chars, split CamelCase/snake_case)
      const ids = text.match(/\b[a-zA-Z_]\w{2,}\b/g);
      if (ids) {
        for (const id of ids) {
          const lower = id.toLowerCase();
          if (MEMORY_STOP_WORDS.has(lower)) continue;
          if (id.length >= 4) keywords.add(lower);
          // CamelCase split
          const parts = id.replace(/([a-z])([A-Z])/g, "$1\0$2").split("\0");
          if (parts.length > 1) {
            for (const p of parts) {
              const pl = p.toLowerCase();
              if (pl.length >= 3 && !MEMORY_STOP_WORDS.has(pl)) keywords.add(pl);
            }
          }
          // snake_case split
          if (id.includes("_")) {
            for (const p of id.split("_")) {
              const pl = p.toLowerCase();
              if (pl.length >= 3 && !MEMORY_STOP_WORDS.has(pl)) keywords.add(pl);
            }
          }
        }
      }
    }
    return keywords;
  }

  /**
   * Filter facts by relevance to the current conversation context.
   *
   * Rules:
   * - "instruction" facts are ALWAYS included (user explicitly asked the agent to behave a certain way)
   * - Other facts are scored by keyword overlap and only included above threshold
   * - If no context keywords available (first message), include all facts (compact enough)
   */
  private filterRelevantFacts(facts: LearnedFact[], contextKeywords: Set<string>): LearnedFact[] {
    // No context → include all (first message in conversation, or very short input)
    if (contextKeywords.size === 0) return facts;

    // If we have very few facts, just include all (not worth filtering)
    if (facts.length <= 5) return facts;

    const scored: Array<{ fact: LearnedFact; score: number }> = [];

    for (const fact of facts) {
      // Instructions always included
      if (fact.category === "instruction") {
        scored.push({ fact, score: 1.0 });
        continue;
      }

      // Score by keyword overlap
      const factKeywords = this.tokenize(fact.content);
      const score = this.overlapScore(factKeywords, contextKeywords);
      scored.push({ fact, score });
    }

    // Include facts above threshold, plus always include top N even if low score
    // to ensure some context is always available
    const RELEVANCE_THRESHOLD = 0.15;
    const MIN_FACTS = 3;

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const result: LearnedFact[] = [];
    for (const { fact, score } of scored) {
      if (score >= RELEVANCE_THRESHOLD || result.length < MIN_FACTS) {
        result.push(fact);
      }
    }

    return result;
  }

  /**
   * Filter summaries by relevance. Returns at most 5 relevant summaries.
   *
   * Uses topic tags + title keywords for fast matching.
   * Falls back to last 3 summaries if no context keywords.
   */
  private filterRelevantSummaries(
    summaries: ConversationSummary[],
    contextKeywords: Set<string>,
  ): ConversationSummary[] {
    if (summaries.length === 0) return [];

    // No context keywords → return last 3 as recency fallback
    if (contextKeywords.size === 0) {
      return summaries.slice(-3);
    }

    const scored: Array<{ summary: ConversationSummary; score: number }> = [];

    for (const s of summaries) {
      // Build keywords from topics + title + summary text
      const text = [s.title, s.summary, ...s.topics].join(" ");
      const summaryKeywords = this.tokenize(text);
      const overlapScore = this.overlapScore(summaryKeywords, contextKeywords);

      // Recency bonus: newer summaries get a small boost
      const ageMs = Date.now() - s.createdAt;
      const ageDays = ageMs / 86_400_000;
      const recencyBonus = Math.max(0, 0.1 - ageDays * 0.002); // decays over ~50 days

      scored.push({ summary: s, score: overlapScore + recencyBonus });
    }

    scored.sort((a, b) => b.score - a.score);

    // Take top 5 with score > 0.05
    const THRESHOLD = 0.05;
    const MAX_SUMMARIES = 5;
    const result: ConversationSummary[] = [];

    for (const { summary, score } of scored) {
      if (result.length >= MAX_SUMMARIES) break;
      if (score >= THRESHOLD || result.length < 1) {
        result.push(summary);
      }
    }

    // Sort result chronologically for readability
    result.sort((a, b) => a.createdAt - b.createdAt);
    return result;
  }

  /**
   * Tokenize text into a set of normalized keywords.
   */
  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    const words = text.match(/\b[a-zA-Z_]\w{2,}\b/g);
    if (words) {
      for (const w of words) {
        const lower = w.toLowerCase();
        if (!MEMORY_STOP_WORDS.has(lower)) tokens.add(lower);
      }
    }
    return tokens;
  }

  /**
   * Compute overlap ratio: |intersection| / |smaller set|
   */
  private overlapScore(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    // Iterate the smaller set for efficiency
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    for (const kw of smaller) {
      if (larger.has(kw)) overlap++;
    }
    return overlap / smaller.size;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Simple similarity check: normalize and compare */
  private isSimilar(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const na = normalize(a);
    const nb = normalize(b);
    // Exact match after normalization
    if (na === nb) return true;
    // One contains the other
    if (na.includes(nb) || nb.includes(na)) return true;
    return false;
  }
}

/** Common stop words excluded from memory relevance matching */
const MEMORY_STOP_WORDS = new Set([
  "the",
  "this",
  "that",
  "with",
  "from",
  "have",
  "been",
  "will",
  "would",
  "could",
  "should",
  "which",
  "their",
  "there",
  "here",
  "when",
  "what",
  "where",
  "about",
  "into",
  "some",
  "more",
  "than",
  "then",
  "also",
  "just",
  "like",
  "other",
  "each",
  "make",
  "made",
  "does",
  "done",
  "true",
  "false",
  "null",
  "undefined",
  "return",
  "function",
  "const",
  "import",
  "export",
  "default",
  "async",
  "await",
  "class",
  "interface",
  "type",
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "void",
  "content",
  "message",
  "result",
  "error",
  "value",
  "name",
  "file",
  "using",
  "please",
  "help",
  "want",
  "need",
  "know",
  "think",
  "code",
  "line",
  "data",
  "text",
  "list",
  "note",
]);
