import { describe, it, expect } from "vitest";
import type { LLMMessage } from "../types.js";
import { deduplicateFileReads } from "../compression/file-dedup-compressor.js";

function toolCallMsg(id: string, toolName: string, args: string): LLMMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: [{ id, type: "function" as const, function: { name: toolName, arguments: args } }],
  };
}

function toolResultMsg(toolCallId: string, content: string): LLMMessage {
  return { role: "tool", tool_call_id: toolCallId, content };
}

function userMsg(content: string): LLMMessage {
  return { role: "user", content };
}

describe("deduplicateFileReads", () => {
  it("returns messages unchanged when no files are read", () => {
    const messages: LLMMessage[] = [userMsg("Hello"), { role: "assistant", content: "Hi!" }];
    expect(deduplicateFileReads(messages)).toEqual(messages);
  });

  it("returns messages unchanged when each file is read only once", () => {
    const messages: LLMMessage[] = [
      toolCallMsg("c1", "Read", '{"file_path":"/src/a.ts"}'),
      toolResultMsg("c1", "content of a.ts"),
      toolCallMsg("c2", "Read", '{"file_path":"/src/b.ts"}'),
      toolResultMsg("c2", "content of b.ts"),
    ];
    expect(deduplicateFileReads(messages)).toEqual(messages);
  });

  it("deduplicates when the same file is read twice — keeps latest", () => {
    const messages: LLMMessage[] = [
      toolCallMsg("c1", "Read", '{"file_path":"/src/a.ts"}'),
      toolResultMsg("c1", "version 1 of a.ts"),
      userMsg("Now make changes"),
      toolCallMsg("c2", "Read", '{"file_path":"/src/a.ts"}'),
      toolResultMsg("c2", "version 2 of a.ts"),
    ];

    const result = deduplicateFileReads(messages);

    // First read should be deduplicated
    const firstToolResult = result.find(
      (m) => m.role === "tool" && (m as any).tool_call_id === "c1",
    ) as { content: string };
    expect(firstToolResult.content).toContain("deduplicated");

    // Second read should be preserved
    const secondToolResult = result.find(
      (m) => m.role === "tool" && (m as any).tool_call_id === "c2",
    ) as { content: string };
    expect(secondToolResult.content).toBe("version 2 of a.ts");
  });

  it("handles multiple files with mixed duplicates", () => {
    const messages: LLMMessage[] = [
      toolCallMsg("c1", "Read", '{"file_path":"/src/a.ts"}'),
      toolResultMsg("c1", "a v1"),
      toolCallMsg("c2", "Read", '{"file_path":"/src/b.ts"}'),
      toolResultMsg("c2", "b v1"),
      toolCallMsg("c3", "Read", '{"file_path":"/src/a.ts"}'),
      toolResultMsg("c3", "a v2"),
    ];

    const result = deduplicateFileReads(messages);

    // a.ts first read deduplicated
    expect((result[1] as any).content).toContain("deduplicated");
    // b.ts untouched (only read once)
    expect((result[3] as any).content).toBe("b v1");
    // a.ts second read preserved
    expect((result[5] as any).content).toBe("a v2");
  });

  it("handles different tool name variants", () => {
    const messages: LLMMessage[] = [
      toolCallMsg("c1", "file_read", '{"path":"/src/x.ts"}'),
      toolResultMsg("c1", "old content"),
      toolCallMsg("c2", "Read", '{"file_path":"/src/x.ts"}'),
      toolResultMsg("c2", "new content"),
    ];

    const result = deduplicateFileReads(messages);
    expect((result[1] as any).content).toContain("deduplicated");
    expect((result[3] as any).content).toBe("new content");
  });

  it("preserves non-string tool content (arrays with images)", () => {
    const messages: LLMMessage[] = [
      toolCallMsg("c1", "Read", '{"file_path":"/img.png"}'),
      {
        role: "tool",
        tool_call_id: "c1",
        content: [{ type: "image_url" as const, image_url: { url: "data:..." } }],
      },
      toolCallMsg("c2", "Read", '{"file_path":"/img.png"}'),
      {
        role: "tool",
        tool_call_id: "c2",
        content: [{ type: "image_url" as const, image_url: { url: "data:...v2" } }],
      },
    ];

    const result = deduplicateFileReads(messages);
    // Non-string content should not be modified (can't safely replace)
    expect(result[1]).toEqual(messages[1]);
  });
});
