import type { LLMMessage, LLMToolMessage } from "../types.js";

const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_HEAD_CHARS = 500;
const DEFAULT_TAIL_CHARS = 1500;

export interface ToolResultCompressionConfig {
  maxChars?: number;
  headChars?: number;
  tailChars?: number;
}

/**
 * Compress tool result messages that exceed the character threshold.
 * Uses a head+tail strategy to preserve the beginning (context) and
 * end (errors/stack traces are usually at the end) of tool output.
 */
export function compressToolResults(
  messages: LLMMessage[],
  config?: ToolResultCompressionConfig,
): LLMMessage[] {
  const maxChars = config?.maxChars ?? DEFAULT_MAX_CHARS;
  const headChars = config?.headChars ?? DEFAULT_HEAD_CHARS;
  const tailChars = config?.tailChars ?? DEFAULT_TAIL_CHARS;

  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    return compressToolMessage(msg, maxChars, headChars, tailChars);
  });
}

function compressToolMessage(
  msg: LLMToolMessage,
  maxChars: number,
  headChars: number,
  tailChars: number,
): LLMToolMessage {
  const content = msg.content;
  // Skip truncation for multipart content (arrays with images)
  if (typeof content !== "string") return msg;
  if (content.length <= maxChars) return msg;

  // Clamp to avoid overlapping substrings when head+tail exceeds content length
  const effectiveHead = Math.min(headChars, content.length);
  const effectiveTail = Math.min(tailChars, Math.max(0, content.length - effectiveHead));
  const omitted = content.length - effectiveHead - effectiveTail;

  const truncated =
    content.substring(0, effectiveHead) +
    `\n...[${omitted} chars truncated]...\n` +
    content.substring(content.length - effectiveTail);

  return {
    ...msg,
    content: truncated,
  };
}
