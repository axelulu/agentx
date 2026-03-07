import type { LLMMessage, LLMAssistantMessage } from "../types.js";
import { estimateMessagesTokens } from "../utils/token-estimator.js";

/**
 * Gradient compression: progressively remove older turns until the
 * message list fits within the token budget.
 *
 * Strategy: identify "tool call groups" (an assistant message with tool_calls
 * followed by the corresponding tool result messages). Keep the most recent
 * N groups and discard earlier ones.
 */
export function gradientCompress(
  messages: LLMMessage[],
  maxTokens: number,
  recentTurnsToKeep: number,
): LLMMessage[] | null {
  // First check if messages already fit
  if (estimateMessagesTokens(messages) <= maxTokens) {
    return messages;
  }

  // Find tool call group boundaries (scanning backwards)
  const groupBoundaries = findToolCallGroupBoundaries(messages);

  // Try keeping progressively fewer groups
  const levels = [recentTurnsToKeep, Math.ceil(recentTurnsToKeep / 2), 1, 0];

  for (const keepCount of levels) {
    const splitIdx = getSplitIndex(groupBoundaries, keepCount, messages.length);
    const kept = messages.slice(splitIdx);
    const tokens = estimateMessagesTokens(kept);
    if (tokens <= maxTokens) {
      return kept;
    }
  }

  return null; // Could not fit within budget
}

/**
 * Returns start indices of tool call groups, from most recent to oldest.
 * A group starts at an assistant message that has tool_calls.
 */
function findToolCallGroupBoundaries(messages: LLMMessage[]): number[] {
  const boundaries: number[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    if (isAssistantWithToolCalls(msg)) {
      boundaries.push(i);
    }
  }

  return boundaries;
}

function isAssistantWithToolCalls(msg: LLMMessage): msg is LLMAssistantMessage {
  return (
    msg.role === "assistant" &&
    "tool_calls" in msg &&
    Array.isArray(msg.tool_calls) &&
    msg.tool_calls.length > 0
  );
}

function getSplitIndex(boundaries: number[], keepCount: number, totalLength: number): number {
  if (keepCount === 0 || boundaries.length === 0) {
    // No tool groups to keep — fall back to keeping the latter half
    return Math.max(0, Math.floor(totalLength / 2));
  }

  const groupsToKeep = Math.min(keepCount, boundaries.length);
  // boundaries are ordered most-recent-first, so the Nth most recent is at index N-1
  return boundaries[groupsToKeep - 1] ?? 0;
}
