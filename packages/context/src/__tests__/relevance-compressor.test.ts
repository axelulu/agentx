import { describe, it, expect } from "vitest";
import type { LLMMessage } from "../types.js";
import { relevanceCompress } from "../compression/relevance-compressor.js";

function userMsg(content: string): LLMMessage {
  return { role: "user", content };
}

function assistantMsg(content: string): LLMMessage {
  return { role: "assistant", content };
}

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

describe("relevanceCompress", () => {
  it("returns messages unchanged when within budget", () => {
    const messages: LLMMessage[] = [userMsg("Hello"), assistantMsg("Hi!")];
    const result = relevanceCompress(messages, 100_000);
    expect(result).toEqual(messages);
  });

  it("compresses low-relevance turns more aggressively", () => {
    // Build a conversation where early turns are about "database migration"
    // but recent turns are about "auth/login component"
    const messages: LLMMessage[] = [
      // Early turn: unrelated topic
      userMsg("Help me with the database migration script"),
      toolCallMsg("c1", "Read", '{"file_path":"/src/db/migration.ts"}'),
      toolResultMsg("c1", "x".repeat(2000) + " database schema migration code"),
      assistantMsg("Here's the migration script with database changes"),

      // Early turn: another unrelated topic
      userMsg("Now update the logging configuration"),
      toolCallMsg("c2", "Read", '{"file_path":"/src/config/logging.ts"}'),
      toolResultMsg("c2", "y".repeat(2000) + " logging configuration"),
      assistantMsg("Updated the logging configuration"),

      // Recent turn: current task
      userMsg("Fix the auth login component in /src/components/auth/Login.tsx"),
      toolCallMsg("c3", "Read", '{"file_path":"/src/components/auth/Login.tsx"}'),
      toolResultMsg("c3", "z".repeat(2000) + " auth login component code"),
      assistantMsg("I see the issue in the Login component auth flow"),
    ];

    // Set a budget that forces compression but allows compressed output to fit
    const result = relevanceCompress(messages, 800);

    expect(result).not.toBeNull();
    if (!result) return;

    // Result should be shorter than input
    expect(result.length).toBeLessThanOrEqual(messages.length);

    // The recent auth/login messages should be preserved more completely
    const lastAssistant = result.findLast(
      (m) => m.role === "assistant" && typeof m.content === "string",
    );
    expect(lastAssistant).toBeDefined();
    expect((lastAssistant as any).content).toContain("Login");
  });

  it("preserves recent (protected) groups regardless of content", () => {
    const messages: LLMMessage[] = [
      userMsg("Old unrelated question"),
      assistantMsg("Old answer " + "x".repeat(500)),
      userMsg("Current task about authentication"),
      assistantMsg("Working on auth"),
    ];

    const result = relevanceCompress(messages, 200);
    if (!result) return;

    // Last group (current task) should be preserved
    const lastMsg = result[result.length - 1];
    expect(lastMsg?.role).toBe("assistant");
    expect((lastMsg as any).content).toContain("auth");
  });

  it("returns null when even max compression cannot fit", () => {
    const messages: LLMMessage[] = [userMsg("x".repeat(10000)), assistantMsg("y".repeat(10000))];

    // Impossibly small budget
    const result = relevanceCompress(messages, 5);
    expect(result).toBeNull();
  });

  it("handles conversations with only tool calls", () => {
    const messages: LLMMessage[] = [
      toolCallMsg("c1", "Read", '{"file_path":"/a.ts"}'),
      toolResultMsg("c1", "content a " + "x".repeat(1000)),
      toolCallMsg("c2", "Read", '{"file_path":"/a.ts"}'),
      toolResultMsg("c2", "content a updated " + "x".repeat(1000)),
    ];

    const result = relevanceCompress(messages, 200);
    // Should either compress or return null, not crash
    expect(result === null || Array.isArray(result)).toBe(true);
  });
});
