import { describe, it, expect } from "vitest";
import type { LLMMessage } from "../types.js";
import { compressToolResults } from "../compression/tool-result-compressor.js";

describe("compressToolResults", () => {
  it("leaves short tool results unchanged", () => {
    const messages: LLMMessage[] = [
      { role: "tool", tool_call_id: "call_1", content: "short result" },
    ];

    const result = compressToolResults(messages);
    expect(result).toEqual(messages);
  });

  it("truncates tool results exceeding threshold", () => {
    const longContent = "A".repeat(3000);
    const messages: LLMMessage[] = [{ role: "tool", tool_call_id: "call_1", content: longContent }];

    const result = compressToolResults(messages, {
      maxChars: 2000,
      headChars: 500,
      tailChars: 1500,
    });

    const compressed = result[0] as { role: "tool"; content: string };
    expect(compressed.content.length).toBeLessThan(longContent.length);
    expect(compressed.content).toContain("truncated");
    // Head preserved
    expect(compressed.content.startsWith("A".repeat(500))).toBe(true);
    // Tail preserved
    expect(compressed.content.endsWith("A".repeat(1500))).toBe(true);
  });

  it("does not modify non-tool messages", () => {
    const messages: LLMMessage[] = [
      { role: "user", content: "A".repeat(5000) },
      { role: "assistant", content: "B".repeat(5000) },
    ];

    const result = compressToolResults(messages, { maxChars: 100 });
    expect(result).toEqual(messages);
  });

  it("handles mixed message types", () => {
    const messages: LLMMessage[] = [
      { role: "user", content: "question" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function" as const,
            function: { name: "test", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "Z".repeat(3000) },
      { role: "assistant", content: "answer" },
    ];

    const result = compressToolResults(messages, { maxChars: 100, headChars: 30, tailChars: 30 });

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual(messages[0]); // user unchanged
    expect(result[1]).toEqual(messages[1]); // assistant unchanged
    expect((result[2] as { content: string }).content).toContain("truncated"); // tool compressed
    expect(result[3]).toEqual(messages[3]); // assistant unchanged
  });

  it("uses default config when none provided", () => {
    const messages: LLMMessage[] = [
      { role: "tool", tool_call_id: "call_1", content: "X".repeat(5000) },
    ];

    const result = compressToolResults(messages);
    const compressed = result[0] as { content: string };
    // Default maxChars is 2000, so this should be compressed
    expect(compressed.content).toContain("truncated");
  });
});
