import type { LLMMessage, LLMAssistantMessage, LLMToolMessage } from "../types.js";
import { estimateMessagesTokens } from "../utils/token-estimator.js";

/**
 * Relevance-based dynamic compression.
 *
 * Instead of blindly removing old turns (gradient compression),
 * this compressor scores each turn group by relevance to the current task
 * and applies tiered compression:
 *
 * - High relevance: keep full content
 * - Medium relevance: truncate tool results aggressively
 * - Low relevance: collapse to a single-line summary
 *
 * Relevance is determined by weighted keyword overlap between each turn and
 * the "current context" (recent messages), with TF-IDF-like weighting so
 * rare/distinctive terms score higher than common ones.
 */

export interface RelevanceCompressorConfig {
  /** Number of recent messages to use as the relevance context (default: 6) */
  recentContextSize?: number;
  /** Relevance score threshold for "high" tier — kept intact (default: 0.3) */
  highRelevanceThreshold?: number;
  /** Relevance score threshold for "medium" tier — tool results truncated (default: 0.1) */
  medRelevanceThreshold?: number;
  /** Max chars for tool results in medium-relevance turns (default: 200) */
  medTierMaxChars?: number;
}

interface ScoredGroup {
  messages: LLMMessage[];
  startIdx: number;
  score: number;
  /** Position in the conversation (0..1), used for recency tiebreaking */
  position: number;
}

/**
 * Apply relevance-based compression to fit messages within a token budget.
 * Returns null if even maximum compression doesn't fit.
 */
export function relevanceCompress(
  messages: LLMMessage[],
  maxTokens: number,
  config?: RelevanceCompressorConfig,
): LLMMessage[] | null {
  if (estimateMessagesTokens(messages) <= maxTokens) {
    return messages;
  }

  const recentContextSize = config?.recentContextSize ?? 6;
  const highThreshold = config?.highRelevanceThreshold ?? 0.3;
  const medThreshold = config?.medRelevanceThreshold ?? 0.1;
  const medMaxChars = config?.medTierMaxChars ?? 200;

  // Extract weighted keywords from recent messages (user messages weighted 2x)
  const recentMessages = messages.slice(-recentContextSize);
  const contextKeywords = extractWeightedKeywords(recentMessages, true);

  if (contextKeywords.size === 0) {
    return null;
  }

  // Build IDF map across all messages for weighting
  const groups = segmentIntoGroups(messages);
  const idfMap = buildIDF(groups);

  // Score each group except the last few (which are always kept intact)
  const protectedGroupCount = Math.min(2, groups.length);
  const scoredGroups: ScoredGroup[] = groups.map((group, idx) => {
    const position = groups.length > 1 ? idx / (groups.length - 1) : 1;
    if (idx >= groups.length - protectedGroupCount) {
      return { ...group, score: 1.0, position };
    }
    const groupKeywords = extractWeightedKeywords(group.messages, false);
    const score = computeRelevanceScore(groupKeywords, contextKeywords, idfMap, position);
    return { ...group, score, position };
  });

  // Apply tiered compression based on scores
  const compressed = scoredGroups.flatMap((group) => {
    if (group.score >= highThreshold) {
      return group.messages;
    }
    if (group.score >= medThreshold) {
      return compressMediumRelevance(group.messages, medMaxChars);
    }
    return compressLowRelevance(group.messages);
  });

  if (estimateMessagesTokens(compressed) <= maxTokens) {
    return compressed;
  }

  // If still over budget, progressively drop low-relevance groups entirely
  const sorted = [...scoredGroups].sort((a, b) => a.score - b.score);
  const dropped = new Set<number>();

  for (const group of sorted) {
    if (group.score >= 1.0) continue;

    dropped.add(group.startIdx);

    const remaining = scoredGroups.flatMap((g) => {
      if (dropped.has(g.startIdx)) return [];
      if (g.score >= highThreshold) return g.messages;
      if (g.score >= medThreshold) return compressMediumRelevance(g.messages, medMaxChars);
      return compressLowRelevance(g.messages);
    });

    if (estimateMessagesTokens(remaining) <= maxTokens) {
      return remaining;
    }
  }

  return null;
}

/**
 * Segment messages into logical turn groups.
 * A group is either:
 * - A user message (standalone)
 * - An assistant message with its subsequent tool results + assistant response
 */
function segmentIntoGroups(
  messages: LLMMessage[],
): Array<{ messages: LLMMessage[]; startIdx: number }> {
  const groups: Array<{ messages: LLMMessage[]; startIdx: number }> = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i]!;

    if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls?.length) {
      const group: LLMMessage[] = [msg];
      const startIdx = i;
      i++;

      while (i < messages.length && messages[i]!.role === "tool") {
        group.push(messages[i]!);
        i++;
      }

      if (
        i < messages.length &&
        messages[i]!.role === "assistant" &&
        !("tool_calls" in messages[i]! && (messages[i] as LLMAssistantMessage).tool_calls?.length)
      ) {
        group.push(messages[i]!);
        i++;
      }

      groups.push({ messages: group, startIdx });
    } else {
      groups.push({ messages: [msg], startIdx: i });
      i++;
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Keyword extraction (weighted)
// ---------------------------------------------------------------------------

interface WeightedKeywords {
  /** keyword → weight (higher = more distinctive) */
  weights: Map<string, number>;
  size: number;
}

/**
 * Extract weighted keywords from messages.
 * When `boostUser` is true, keywords from user messages get 2x weight.
 */
function extractWeightedKeywords(messages: LLMMessage[], boostUser: boolean): WeightedKeywords {
  const weights = new Map<string, number>();

  for (const msg of messages) {
    const roleWeight = boostUser && msg.role === "user" ? 2.0 : 1.0;
    const text = messageToText(msg);
    const keywords = extractRawKeywords(text);
    for (const kw of keywords) {
      weights.set(kw, (weights.get(kw) ?? 0) + roleWeight);
    }
  }

  return { weights, size: weights.size };
}

/**
 * Extract raw keywords from a text string.
 * Handles: file paths, CamelCase splitting, snake_case splitting,
 * tool names, and general identifiers.
 */
function extractRawKeywords(text: string): string[] {
  const keywords: string[] = [];

  // 1. File paths (Unix-style, 2+ segments)
  const filePaths = text.match(/(?:\/[\w.-]+){2,}/g);
  if (filePaths) {
    for (const fp of filePaths) {
      keywords.push(fp);
      const filename = fp.split("/").pop();
      if (filename) {
        keywords.push(filename.toLowerCase());
        // Also extract the extension-less name
        const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
        if (nameWithoutExt.length >= 3) keywords.push(nameWithoutExt.toLowerCase());
      }
    }
  }

  // 2. Identifiers — split CamelCase and snake_case
  const identifiers = text.match(/\b[a-zA-Z_]\w{2,}\b/g);
  if (identifiers) {
    for (const id of identifiers) {
      const lower = id.toLowerCase();
      if (STOP_WORDS.has(lower)) continue;

      // Add the full identifier
      if (id.length >= 4) keywords.push(lower);

      // Split CamelCase: getUserById → [get, user, by, id] → keep 3+ char parts
      const camelParts = id.replace(/([a-z])([A-Z])/g, "$1\0$2").split("\0");
      if (camelParts.length > 1) {
        for (const part of camelParts) {
          const p = part.toLowerCase();
          if (p.length >= 3 && !STOP_WORDS.has(p)) keywords.push(p);
        }
      }

      // Split snake_case
      if (id.includes("_")) {
        const parts = id.split("_");
        for (const part of parts) {
          const p = part.toLowerCase();
          if (p.length >= 3 && !STOP_WORDS.has(p)) keywords.push(p);
        }
      }
    }
  }

  // 3. Error-like patterns (status codes, error names)
  const errors = text.match(/\b(?:Error|Exception|ENOENT|EACCES|EPERM|ETIMEDOUT)\b/gi);
  if (errors) {
    for (const e of errors) keywords.push(e.toLowerCase());
  }
  const statusCodes = text.match(/\b[45]\d{2}\b/g);
  if (statusCodes) {
    for (const sc of statusCodes) keywords.push(`status_${sc}`);
  }

  return keywords;
}

// ---------------------------------------------------------------------------
// IDF (Inverse Document Frequency)
// ---------------------------------------------------------------------------

type IDFMap = Map<string, number>;

/**
 * Build an IDF map: keywords that appear in fewer groups get higher weight.
 * IDF = log(N / df) where N = total groups, df = groups containing the term.
 */
function buildIDF(groups: Array<{ messages: LLMMessage[] }>): IDFMap {
  const docFreq = new Map<string, number>();
  const N = groups.length;

  for (const group of groups) {
    const text = group.messages.map((m) => messageToText(m)).join(" ");
    const keywords = new Set(extractRawKeywords(text));
    for (const kw of keywords) {
      docFreq.set(kw, (docFreq.get(kw) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    // Smoothed IDF: log((N + 1) / (df + 1)) + 1
    // Ensures even universal terms get a small positive weight
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  }
  return idf;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute relevance score using TF-IDF-weighted keyword overlap + recency decay.
 *
 * For each keyword in the group that also appears in context:
 *   contribution = groupWeight * contextWeight * idf
 *
 * Normalized by the max possible score (all context keywords matched at full IDF).
 * A small recency bonus (up to 0.05) is added based on position.
 */
function computeRelevanceScore(
  groupKeywords: WeightedKeywords,
  contextKeywords: WeightedKeywords,
  idfMap: IDFMap,
  position: number,
): number {
  if (groupKeywords.size === 0 || contextKeywords.size === 0) return 0;

  let score = 0;
  let maxPossible = 0;

  // Compute max possible score (if every context keyword matched perfectly)
  for (const [kw, ctxWeight] of contextKeywords.weights) {
    const idf = idfMap.get(kw) ?? 1;
    maxPossible += ctxWeight * idf;
  }

  if (maxPossible === 0) return 0;

  // Compute actual overlap score
  for (const [kw, groupWeight] of groupKeywords.weights) {
    const ctxWeight = contextKeywords.weights.get(kw);
    if (ctxWeight === undefined) continue;
    const idf = idfMap.get(kw) ?? 1;
    // Use min of weights to avoid inflation from repetition
    score += Math.min(groupWeight, ctxWeight) * idf;
  }

  const normalized = score / maxPossible;

  // Recency bonus: newer groups get a small boost (max +0.05)
  const recencyBonus = position * 0.05;

  return Math.min(1.0, normalized + recencyBonus);
}

// ---------------------------------------------------------------------------
// Compression tiers
// ---------------------------------------------------------------------------

/**
 * Medium-relevance compression: keep assistant text, truncate tool results.
 */
function compressMediumRelevance(messages: LLMMessage[], maxChars: number): LLMMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    const toolMsg = msg as LLMToolMessage;
    if (typeof toolMsg.content !== "string") return msg;
    if (toolMsg.content.length <= maxChars) return msg;

    return {
      ...toolMsg,
      content:
        toolMsg.content.substring(0, maxChars) +
        "\n...[compressed — low relevance to current task]",
    };
  });
}

/**
 * Low-relevance compression: collapse entire group to a minimal summary.
 */
function compressLowRelevance(messages: LLMMessage[]): LLMMessage[] {
  const toolNames: string[] = [];

  for (const msg of messages) {
    if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolNames.push(tc.function.name);
      }
    }
  }

  // For standalone user/assistant messages, keep a truncated version
  if (toolNames.length === 0) {
    return messages.map((msg) => {
      if (typeof msg.content !== "string" || msg.content.length <= 100) return msg;
      return { ...msg, content: msg.content.substring(0, 100) + "..." } as LLMMessage;
    });
  }

  // For tool call groups: keep the assistant tool_call message (for structure)
  // but replace all tool results with a compact marker
  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    const toolMsg = msg as LLMToolMessage;
    return {
      ...toolMsg,
      content: `[Result compressed — not relevant to current task]`,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function messageToText(msg: LLMMessage): string {
  const parts: string[] = [];
  if (typeof msg.content === "string" && msg.content) {
    parts.push(msg.content);
  } else if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      if ("text" in p && p.text) parts.push(p.text);
    }
  }
  if ("tool_calls" in msg && msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      parts.push(tc.function.name);
      parts.push(tc.function.arguments);
    }
  }
  return parts.join(" ");
}

/** Common words to exclude from keyword extraction */
const STOP_WORDS = new Set([
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
  "messages",
  "result",
  "error",
  "value",
  "name",
  "role",
  "tool",
  "user",
  "assistant",
  "system",
  "call",
  "calls",
  "let",
  "var",
  "new",
  "for",
  "not",
  "but",
  "use",
  "can",
  "all",
  "file",
  "line",
  "code",
  "data",
  "text",
  "list",
  "note",
  "need",
  "want",
  "know",
  "try",
  "see",
  "get",
  "set",
  "run",
  "add",
]);
