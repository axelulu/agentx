import type { LLMMessage, ContextConfig, OptimizeContextOptions, SummaryStore } from "./types.js";
import { estimateMessagesTokens } from "./utils/token-estimator.js";
import { compressToolResults } from "./compression/tool-result-compressor.js";
import { deduplicateFileReads } from "./compression/file-dedup-compressor.js";
import { relevanceCompress } from "./compression/relevance-compressor.js";
import { gradientCompress } from "./compression/gradient-compressor.js";
import {
  summarizeHistory,
  prependSummary,
  estimateSummaryTokens,
} from "./compression/history-summarizer.js";
import { InMemorySummaryStore } from "./storage/in-memory-store.js";

const DEFAULT_RECENT_TURNS = 5;
const DEFAULT_SUMMARY_MAX_TOKENS = 2000;

/**
 * Orchestrates context window optimization.
 *
 * Pipeline:
 * 1. Deduplicate repeated file reads (keep latest version only)
 * 2. Compress tool results (character-level truncation)
 * 3. Check if messages fit within budget → done
 * 4. Apply relevance-based compression (score turns by relevance to current task)
 * 5. Fall back to gradient compression (remove old tool call groups)
 * 6. If still over budget and summarization enabled, generate LLM summary
 */
export class ContextManager {
  private config: ContextConfig;
  private summaryStore: SummaryStore;

  constructor(config: ContextConfig, summaryStore?: SummaryStore) {
    this.config = config;
    this.summaryStore = summaryStore ?? new InMemorySummaryStore();
  }

  /**
   * Optimize a message list to fit within the configured token budget.
   */
  async optimizeContext(
    messages: LLMMessage[],
    options?: OptimizeContextOptions,
  ): Promise<LLMMessage[]> {
    if (messages.length === 0) return messages;

    // Separate system message from the rest
    const systemMsg = messages[0]?.role === "system" ? messages[0] : null;
    const conversationMessages = systemMsg ? messages.slice(1) : messages;

    // Step 1: Deduplicate repeated file reads (same file read multiple times → keep latest)
    const deduped = deduplicateFileReads(conversationMessages);

    // Step 2: Compress tool results (character-level truncation)
    const compressed = compressToolResults(deduped, {
      maxChars: this.config.toolResultMaxChars,
      headChars: this.config.toolResultHeadChars,
      tailChars: this.config.toolResultTailChars,
    });

    const withSystem = systemMsg ? [systemMsg, ...compressed] : compressed;

    // Check if we're within budget
    const currentTokens = estimateMessagesTokens(withSystem);
    if (currentTokens <= this.config.maxContextTokens) {
      return withSystem;
    }

    const systemTokens = systemMsg ? estimateMessagesTokens([systemMsg]) : 0;
    const budget = this.config.maxContextTokens - systemTokens;

    // Step 3: Relevance-based compression (score turns, compress low-relevance ones)
    const relevanceResult = relevanceCompress(compressed, budget);
    if (relevanceResult) {
      return systemMsg ? [systemMsg, ...relevanceResult] : relevanceResult;
    }

    // Step 4: Gradient compression (fallback — remove old tool call groups)
    const recentTurns = this.config.recentTurnsToKeep ?? DEFAULT_RECENT_TURNS;
    const gradientResult = gradientCompress(compressed, budget, recentTurns);

    if (gradientResult) {
      return systemMsg ? [systemMsg, ...gradientResult] : gradientResult;
    }

    // Step 5: LLM summarization (if enabled and streamFn provided)
    if (this.config.enableSummarization && options?.streamFn && options.model) {
      return this.summarizeAndTruncate(compressed, systemMsg, options);
    }

    // Fallback: keep as much recent context as possible
    return this.fallbackTruncation(compressed, systemMsg);
  }

  private async summarizeAndTruncate(
    messages: LLMMessage[],
    systemMsg: LLMMessage | null,
    options: OptimizeContextOptions,
  ): Promise<LLMMessage[]> {
    const summaryMaxTokens = this.config.summaryMaxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS;
    const systemTokens = systemMsg ? estimateMessagesTokens([systemMsg]) : 0;
    const availableTokens = this.config.maxContextTokens - systemTokens;

    // Check for cached summary
    let summary: string | null = null;
    if (options.conversationId) {
      const cached = await this.summaryStore.get(options.conversationId);
      if (cached) {
        summary = cached.summaryText;
      }
    }

    // Split: older messages to summarize, recent to keep
    const recentTurns = this.config.recentTurnsToKeep ?? DEFAULT_RECENT_TURNS;
    const splitIdx = Math.max(0, messages.length - recentTurns * 3); // ~3 messages per turn
    const toSummarize = messages.slice(0, splitIdx);
    const toKeep = messages.slice(splitIdx);

    // Generate summary if we don't have a cached one
    if (!summary && toSummarize.length > 0) {
      summary = await summarizeHistory(
        toSummarize,
        options.streamFn!,
        options.model!,
        summaryMaxTokens,
      );

      // Cache the summary
      if (options.conversationId && summary) {
        await this.summaryStore.save({
          conversationId: options.conversationId,
          summaryText: summary,
          messageCount: toSummarize.length,
          tokenEstimate: estimateSummaryTokens(summary),
          createdAt: Date.now(),
        });
      }
    }

    if (summary) {
      const withSummary = prependSummary(summary, toKeep);
      const result = systemMsg ? [systemMsg, ...withSummary] : withSummary;

      if (estimateMessagesTokens(result) <= this.config.maxContextTokens) {
        return result;
      }
    }

    // If summary + recent still too large, just truncate
    return this.fallbackTruncation(messages, systemMsg);
  }

  private fallbackTruncation(messages: LLMMessage[], systemMsg: LLMMessage | null): LLMMessage[] {
    const systemTokens = systemMsg ? estimateMessagesTokens([systemMsg]) : 0;
    const budget = this.config.maxContextTokens - systemTokens;

    // Keep messages from the end until we hit the budget
    const kept: LLMMessage[] = [];
    let tokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = estimateMessagesTokens([messages[i]!]);
      if (tokens + msgTokens > budget) break;
      kept.unshift(messages[i]!);
      tokens += msgTokens;
    }

    return systemMsg ? [systemMsg, ...kept] : kept;
  }
}
