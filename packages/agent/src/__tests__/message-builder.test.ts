import { describe, expect, it } from "vitest";
import { convertToLlmMessages, convertToolsToLlm } from "../providers/message-builder.js";
import type { AgentMessage, AgentTool } from "../types.js";

describe("convertToLlmMessages", () => {
  it("should convert a simple user message", () => {
    const messages: AgentMessage[] = [{ role: "user", content: "Hello" }];

    const result = convertToLlmMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
  });

  it("should convert a user message with content parts", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this" },
          { type: "image", data: "abc123", mimeType: "image/jpeg" },
        ],
      },
    ];

    const result = convertToLlmMessages(messages);
    expect(result).toHaveLength(1);

    const msg = result[0];
    expect(msg.role).toBe("user");
    expect(Array.isArray(msg.content)).toBe(true);

    const content = msg.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: "text", text: "Describe this" });
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,abc123" },
    });
  });

  it("should convert an assistant message without tool calls", () => {
    const messages: AgentMessage[] = [{ role: "assistant", content: "I can help!" }];

    const result = convertToLlmMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "assistant", content: "I can help!" });
  });

  it("should convert an assistant message with tool calls", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "tc1", name: "search", arguments: { query: "test" } }],
      },
    ];

    const result = convertToLlmMessages(messages);
    expect(result).toHaveLength(1);

    const msg = result[0] as { tool_calls: Array<Record<string, unknown>> };
    expect(msg.tool_calls).toHaveLength(1);
    expect(msg.tool_calls[0]).toEqual({
      id: "tc1",
      type: "function",
      function: {
        name: "search",
        arguments: '{"query":"test"}',
      },
    });
  });

  it("should convert a tool result message", () => {
    const messages: AgentMessage[] = [{ role: "tool", toolCallId: "tc1", content: "result data" }];

    const result = convertToLlmMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "tool",
      tool_call_id: "tc1",
      content: "result data",
    });
  });

  it("should convert a full conversation", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "Search for cats" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "tc1", name: "search", arguments: { query: "cats" } }],
      },
      { role: "tool", toolCallId: "tc1", content: "Found 10 cats" },
      { role: "assistant", content: "I found 10 cats for you!" },
    ];

    const result = convertToLlmMessages(messages);
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("tool");
    expect(result[3].role).toBe("assistant");
  });

  it("should handle image content with default mime type", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [{ type: "image", data: "xyz" }],
      },
    ];

    const result = convertToLlmMessages(messages);
    const content = result[0].content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,xyz" },
    });
  });
});

describe("convertToolsToLlm", () => {
  it("should convert tool definitions", () => {
    const tools: AgentTool[] = [
      {
        name: "search",
        description: "Search the web",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        execute: async () => ({ content: "" }),
      },
    ];

    const result = convertToolsToLlm(tools);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "function",
      function: {
        name: "search",
        description: "Search the web",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    });
  });

  it("should handle empty tools array", () => {
    expect(convertToolsToLlm([])).toEqual([]);
  });
});
