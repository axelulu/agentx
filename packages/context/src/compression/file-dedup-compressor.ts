import type { LLMMessage, LLMToolMessage, LLMAssistantMessage } from "../types.js";

/**
 * File content deduplication compressor.
 *
 * When the same file is read multiple times during a conversation,
 * only the most recent read result is kept intact. Earlier reads of the
 * same file are replaced with a short placeholder to save tokens.
 *
 * Detection strategy:
 * - Scan assistant messages for tool_calls whose function name matches
 *   common file-read patterns (Read, file_read, readFile, etc.)
 * - Extract the file path from the tool_call arguments
 * - Track the last occurrence index for each file path
 * - Replace earlier tool result content with a dedup marker
 */

const FILE_READ_TOOL_NAMES = new Set([
  "read",
  "Read",
  "file_read",
  "readFile",
  "read_file",
  "cat",
  "view_file",
]);

const DEDUP_MARKER_PREFIX =
  "[File content deduplicated — latest version retained at a later point in this conversation";

/**
 * Deduplicate file read results. When the same file is read multiple times,
 * only the latest read is preserved; earlier reads are replaced with a short marker.
 */
export function deduplicateFileReads(messages: LLMMessage[]): LLMMessage[] {
  // Pass 1: Build a map of file_path -> last tool_call_id that read it
  const fileLastCallId = new Map<string, string>();
  // Also track tool_call_id -> file_path for tool results
  const callIdToFile = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !("tool_calls" in msg) || !msg.tool_calls) continue;

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      if (!FILE_READ_TOOL_NAMES.has(tc.function.name)) continue;

      const filePath = extractFilePath(tc.function.arguments);
      if (!filePath) continue;

      callIdToFile.set(tc.id, filePath);
      // Overwrite — the last one seen wins
      fileLastCallId.set(filePath, tc.id);
    }
  }

  // If no files were read more than once, return early
  const readCounts = new Map<string, number>();
  for (const [, filePath] of callIdToFile) {
    readCounts.set(filePath, (readCounts.get(filePath) ?? 0) + 1);
  }

  let hasDuplicates = false;
  for (const [, count] of readCounts) {
    if (count > 1) {
      hasDuplicates = true;
      break;
    }
  }
  if (!hasDuplicates) return messages;

  // Pass 2: Replace earlier reads with dedup marker
  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;

    const toolMsg = msg as LLMToolMessage;
    const filePath = callIdToFile.get(toolMsg.tool_call_id);
    if (!filePath) return msg;

    // Check if this is NOT the latest read of this file
    const latestCallId = fileLastCallId.get(filePath);
    if (toolMsg.tool_call_id === latestCallId) return msg;

    // This is an earlier read — replace content with marker
    if (typeof toolMsg.content !== "string") return msg;

    return {
      ...toolMsg,
      content: `${DEDUP_MARKER_PREFIX}: ${filePath}]`,
    };
  });
}

/**
 * Extract file_path from tool call arguments JSON.
 * Handles common argument patterns:
 *   {"file_path": "..."}, {"path": "..."}, {"filePath": "..."}
 */
function extractFilePath(argsJson: string): string | null {
  try {
    const args = JSON.parse(argsJson);
    return args.file_path ?? args.filePath ?? args.path ?? null;
  } catch {
    // If arguments aren't valid JSON, try regex extraction
    const match = argsJson.match(/(?:"file_path"|"filePath"|"path")\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }
}
