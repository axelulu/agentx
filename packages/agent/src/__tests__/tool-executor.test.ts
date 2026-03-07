import { describe, expect, it } from "vitest";
import { executeTools } from "../tool-executor.js";
import type { AgentEvent, AgentTool, ToolCall } from "../types.js";

function makeTool(overrides: Partial<AgentTool> & { name: string }): AgentTool {
  return {
    description: `${overrides.name} tool`,
    parameters: {},
    execute: async () => ({ content: `${overrides.name} result` }),
    ...overrides,
  };
}

function makeToolCall(name: string, id?: string): ToolCall {
  return { id: id ?? `call_${name}`, name, arguments: {} };
}

describe("executeTools", () => {
  it("should execute tools sequentially by default", async () => {
    const order: string[] = [];
    const toolA = makeTool({
      name: "a",
      execute: async () => {
        order.push("a");
        return { content: "a done" };
      },
    });
    const toolB = makeTool({
      name: "b",
      execute: async () => {
        order.push("b");
        return { content: "b done" };
      },
    });

    const toolMap = new Map([
      ["a", toolA],
      ["b", toolB],
    ]);
    const calls = [makeToolCall("a"), makeToolCall("b")];
    const events: AgentEvent[] = [];

    const results = await executeTools(calls, toolMap, new AbortController().signal, (e) =>
      events.push(e),
    );

    expect(order).toEqual(["a", "b"]);
    expect(results).toHaveLength(2);
    expect(results[0].result.content).toBe("a done");
    expect(results[1].result.content).toBe("b done");

    // Should have tool_start and tool_end for each tool
    const starts = events.filter((e) => e.type === "tool_start");
    const ends = events.filter((e) => e.type === "tool_end");
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
  });

  it("should execute parallel tools concurrently", async () => {
    const order: string[] = [];
    const toolA = makeTool({
      name: "a",
      category: "parallel",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push("a");
        return { content: "a done" };
      },
    });
    const toolB = makeTool({
      name: "b",
      category: "parallel",
      execute: async () => {
        order.push("b");
        return { content: "b done" };
      },
    });

    const toolMap = new Map([
      ["a", toolA],
      ["b", toolB],
    ]);
    const calls = [makeToolCall("a"), makeToolCall("b")];

    const results = await executeTools(calls, toolMap, new AbortController().signal, () => {});

    // b should finish before a since it's faster (parallel)
    expect(order[0]).toBe("b");
    expect(results).toHaveLength(2);
    // Results should still be in original order
    expect(results[0].toolCallId).toBe("call_a");
    expect(results[1].toolCallId).toBe("call_b");
  });

  it("should handle tool not found", async () => {
    const toolMap = new Map<string, AgentTool>();
    const calls = [makeToolCall("missing")];

    const results = await executeTools(calls, toolMap, new AbortController().signal, () => {});

    expect(results).toHaveLength(1);
    expect(results[0].result.isError).toBe(true);
    expect(results[0].result.content).toContain("Tool not found");
  });

  it("should handle tool execution errors", async () => {
    const tool = makeTool({
      name: "failing",
      execute: async () => {
        throw new Error("boom");
      },
    });

    const toolMap = new Map([["failing", tool]]);
    const calls = [makeToolCall("failing")];

    const results = await executeTools(calls, toolMap, new AbortController().signal, () => {});

    expect(results[0].result.isError).toBe(true);
    expect(results[0].result.content).toContain("boom");
  });

  it("should handle timeout", async () => {
    const tool = makeTool({
      name: "slow",
      timeoutMs: 50,
      execute: async () => {
        await new Promise((r) => setTimeout(r, 500));
        return { content: "done" };
      },
    });

    const toolMap = new Map([["slow", tool]]);
    const calls = [makeToolCall("slow")];

    const results = await executeTools(calls, toolMap, new AbortController().signal, () => {});

    expect(results[0].result.isError).toBe(true);
    expect(results[0].result.content).toContain("timed out");
  });

  it("should respect AbortSignal", async () => {
    const controller = new AbortController();
    const tool = makeTool({
      name: "long",
      execute: async (_args, ctx) => {
        await new Promise((r) => setTimeout(r, 500));
        return { content: "done" };
      },
    });

    const toolMap = new Map([["long", tool]]);
    const calls = [makeToolCall("long", "c1"), makeToolCall("long", "c2")];

    // Abort after short delay
    setTimeout(() => controller.abort(), 10);

    const results = await executeTools(calls, toolMap, controller.signal, () => {});

    // Should have executed at most 1 tool (first one started before abort)
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("should emit tool_update via emitProgress", async () => {
    const tool = makeTool({
      name: "progress",
      execute: async (_args, ctx) => {
        ctx.emitProgress?.("step 1");
        ctx.emitProgress?.("step 2");
        return { content: "done" };
      },
    });

    const toolMap = new Map([["progress", tool]]);
    const calls = [makeToolCall("progress")];
    const events: AgentEvent[] = [];

    await executeTools(calls, toolMap, new AbortController().signal, (e) => events.push(e));

    const updates = events.filter((e) => e.type === "tool_update");
    expect(updates).toHaveLength(2);
  });
});
