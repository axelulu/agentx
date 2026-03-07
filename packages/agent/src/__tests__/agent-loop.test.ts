import { describe, expect, it } from "vitest";
import { agentLoop } from "../agent-loop.js";
import type { AgentConfig, AgentEvent, LLMStreamChunk, StreamFn } from "../types.js";

/** Create a mock StreamFn that returns predetermined responses */
function mockStreamFn(
  responses: Array<{
    content?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }>,
): StreamFn {
  let callIndex = 0;

  return async function* (_messages, _options): AsyncIterable<LLMStreamChunk> {
    const response = responses[callIndex++];
    if (!response) {
      yield { type: "content_delta", delta: "No more responses" };
      yield { type: "done" };
      return;
    }

    if (response.content) {
      yield { type: "content_delta", delta: response.content };
    }

    if (response.toolCalls) {
      for (let i = 0; i < response.toolCalls.length; i++) {
        const tc = response.toolCalls[i];
        yield {
          type: "tool_call_delta",
          index: i,
          id: tc.id,
          name: tc.name,
          argumentsDelta: JSON.stringify(tc.arguments),
        };
      }
    }

    yield { type: "usage", inputTokens: 100, outputTokens: 50 };
    yield { type: "done" };
  };
}

function baseConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    model: "test-model",
    systemPrompt: "You are a test assistant.",
    tools: [],
    ...overrides,
  };
}

describe("agentLoop", () => {
  it("should handle a simple text response", async () => {
    const stream = agentLoop(
      "Hello",
      baseConfig({
        streamFn: mockStreamFn([{ content: "Hi there!" }]),
      }),
    );

    const events: AgentEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events[0].type).toBe("agent_start");

    const deltas = events.filter((e) => e.type === "message_delta");
    expect(deltas).toHaveLength(1);
    expect((deltas[0] as { delta: string }).delta).toBe("Hi there!");

    const end = events.find((e) => e.type === "agent_end");
    expect(end).toBeDefined();

    const result = await stream.result();
    expect(result.turns).toBe(1);
    expect(result.aborted).toBe(false);
    expect(result.messages).toHaveLength(2); // user + assistant
  });

  it("should handle a tool call cycle", async () => {
    const stream = agentLoop(
      "Read the file",
      baseConfig({
        tools: [
          {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: { path: { type: "string" } },
            },
            execute: async (args) => ({
              content: `Contents of ${args.path}`,
            }),
          },
        ],
        streamFn: mockStreamFn([
          {
            toolCalls: [
              {
                id: "tc_1",
                name: "read_file",
                arguments: { path: "readme.md" },
              },
            ],
          },
          { content: "The file says hello!" },
        ]),
      }),
    );

    const events: AgentEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    const result = await stream.result();
    expect(result.turns).toBe(2);

    // Should have tool_start and tool_end events
    const toolStarts = events.filter((e) => e.type === "tool_start");
    expect(toolStarts).toHaveLength(1);
    expect((toolStarts[0] as { toolName: string }).toolName).toBe("read_file");

    const toolEnds = events.filter((e) => e.type === "tool_end");
    expect(toolEnds).toHaveLength(1);

    // Messages: user → assistant(tool_call) → tool_result → assistant(text)
    expect(result.messages).toHaveLength(4);
  });

  it("should respect maxTurns", async () => {
    // Stream that always returns tool calls
    let callCount = 0;
    const infiniteToolStream: StreamFn = async function* () {
      callCount++;
      yield {
        type: "tool_call_delta" as const,
        index: 0,
        id: `tc_${callCount}`,
        name: "echo",
        argumentsDelta: '{"text":"loop"}',
      };
      yield { type: "done" as const };
    };

    const stream = agentLoop(
      "Go",
      baseConfig({
        maxTurns: 3,
        tools: [
          {
            name: "echo",
            description: "Echo",
            parameters: {},
            execute: async () => ({ content: "ok" }),
          },
        ],
        streamFn: infiniteToolStream,
      }),
    );

    const events: AgentEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    const result = await stream.result();
    expect(result.turns).toBe(3);
  });

  it("should handle AbortSignal", async () => {
    const controller = new AbortController();

    const slowStream: StreamFn = async function* () {
      yield { type: "content_delta" as const, delta: "start" };
      await new Promise((r) => setTimeout(r, 500));
      yield { type: "content_delta" as const, delta: " end" };
      yield { type: "done" as const };
    };

    // Abort quickly
    setTimeout(() => controller.abort(), 20);

    const stream = agentLoop("Hello", baseConfig({ streamFn: slowStream }), controller.signal);

    const events: AgentEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    const result = await stream.result();
    expect(result.aborted).toBe(true);
  });

  it("should accept UserMessage input", async () => {
    const stream = agentLoop(
      { role: "user", content: "Hello" },
      baseConfig({
        streamFn: mockStreamFn([{ content: "World" }]),
      }),
    );

    const result = await stream.result();
    expect(result.messages[0]).toEqual({ role: "user", content: "Hello" });
  });

  it("should accept UserMessage[] input", async () => {
    const stream = agentLoop(
      [
        { role: "user", content: "First" },
        { role: "user", content: "Second" },
      ],
      baseConfig({
        streamFn: mockStreamFn([{ content: "Response" }]),
      }),
    );

    const result = await stream.result();
    expect(result.messages[0]).toEqual({ role: "user", content: "First" });
    expect(result.messages[1]).toEqual({ role: "user", content: "Second" });
  });
});
