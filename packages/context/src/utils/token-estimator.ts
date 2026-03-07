import type { LLMMessage } from "../types.js";

/**
 * Regex matching CJK Unified Ideographs + common CJK punctuation ranges
 */
const CJK_REGEX = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\u3000-\u303F\uFF00-\uFFEF]/g;

/**
 * Character-based token estimation with CJK awareness.
 * Latin text: ~4 characters per token.
 * CJK characters: ~1.5 characters per token.
 */
export function estimateTokens(text: string): number {
  let cjkCount = 0;
  for (const _ of text.matchAll(CJK_REGEX)) cjkCount++;
  const nonCjkCount = text.length - cjkCount;
  return Math.ceil(nonCjkCount / 4 + cjkCount / 1.5);
}

/**
 * Estimate total token count of LLMMessage array.
 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0;

  for (const msg of messages) {
    // Per-message overhead (~4 tokens for role, delimiters)
    total += 4;

    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (msg.content === null) {
      // no content tokens
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ("text" in part && part.text) {
          total += estimateTokens(part.text);
        }
      }
    }

    // Tool calls in assistant messages
    if ("tool_calls" in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name);
        total += estimateTokens(tc.function.arguments);
      }
    }
  }

  return total;
}
