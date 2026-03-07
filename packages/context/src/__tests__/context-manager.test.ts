import { describe, it, expect } from "vitest";
import type { LLMMessage } from "../types.js";
import { ContextManager } from "../context-manager.js";

function userMsg(content: string): LLMMessage {
  return { role: "user", content };
}

function assistantMsg(content: string): LLMMessage {
  return { role: "assistant", content };
}

function toolCallMsg(toolName: string, args: string): LLMMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: `call_${toolName}`,
        type: "function" as const,
        function: { name: toolName, arguments: args },
      },
    ],
  };
}

function toolResultMsg(toolCallId: string, content: string): LLMMessage {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content,
  };
}

function systemMsg(content: string): LLMMessage {
  return { role: "system", content };
}

describe("ContextManager", () => {
  it("returns messages unchanged when within budget", async () => {
    const manager = new ContextManager({ maxContextTokens: 100_000 });
    const messages: LLMMessage[] = [
      systemMsg("You are a helpful assistant"),
      userMsg("Hello"),
      assistantMsg("Hi there!"),
    ];

    const result = await manager.optimizeContext(messages);
    expect(result).toEqual(messages);
  });

  it("compresses tool results that exceed threshold", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      toolResultMaxChars: 100,
      toolResultHeadChars: 30,
      toolResultTailChars: 30,
    });

    const longContent = "x".repeat(200);
    const messages: LLMMessage[] = [
      userMsg("Read the file"),
      toolCallMsg("file_read", '{"file_path":"test.txt"}'),
      toolResultMsg("call_file_read", longContent),
      assistantMsg("Here's the file content"),
    ];

    const result = await manager.optimizeContext(messages);
    const toolMsg = result.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect((toolMsg as { content: string }).content.length).toBeLessThan(200);
    expect((toolMsg as { content: string }).content).toContain("truncated");
  });

  it("preserves system message during optimization", async () => {
    const manager = new ContextManager({ maxContextTokens: 100_000 });
    const messages: LLMMessage[] = [systemMsg("System prompt"), userMsg("Hello")];

    const result = await manager.optimizeContext(messages);
    expect(result[0]).toEqual(systemMsg("System prompt"));
  });

  it("handles empty message list", async () => {
    const manager = new ContextManager({ maxContextTokens: 100_000 });
    const result = await manager.optimizeContext([]);
    expect(result).toEqual([]);
  });

  it("applies gradient compression when over budget", async () => {
    const manager = new ContextManager({
      maxContextTokens: 80, // very small budget to force compression
      recentTurnsToKeep: 1,
    });

    // Create enough messages to exceed the tight budget
    const messages: LLMMessage[] = [
      userMsg("First question " + "x".repeat(200)),
      toolCallMsg("tool_a", '{"a":1}'),
      toolResultMsg("call_tool_a", "Result A " + "x".repeat(200)),
      assistantMsg("Response to first " + "x".repeat(200)),
      userMsg("Second question " + "x".repeat(200)),
      toolCallMsg("tool_b", '{"b":2}'),
      toolResultMsg("call_tool_b", "Result B " + "x".repeat(200)),
      assistantMsg("Response to second " + "x".repeat(200)),
    ];

    const result = await manager.optimizeContext(messages);
    // Should have fewer messages than input due to compression/truncation
    expect(result.length).toBeLessThan(messages.length);
  });

  it("falls back to tail truncation as last resort", async () => {
    const manager = new ContextManager({
      maxContextTokens: 50,
      recentTurnsToKeep: 1,
    });

    const messages: LLMMessage[] = [
      systemMsg("System"),
      userMsg("A ".repeat(50)),
      assistantMsg("B ".repeat(50)),
      userMsg("C ".repeat(50)),
      assistantMsg("D"),
    ];

    const result = await manager.optimizeContext(messages);
    // Should always include system message
    expect(result[0]?.role).toBe("system");
    // Should include at least the last message
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
