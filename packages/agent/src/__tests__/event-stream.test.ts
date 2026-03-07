import { describe, expect, it } from "vitest";
import { EventStream } from "../event-stream.js";
import type { AgentEvent, AgentResult } from "../types.js";

describe("EventStream", () => {
  it("should push and consume events in order", async () => {
    const stream = new EventStream<AgentEvent>();
    const events: AgentEvent[] = [];

    stream.push({ type: "agent_start", timestamp: 1 });
    stream.push({
      type: "message_delta",
      messageId: "m1",
      delta: "hello",
      timestamp: 2,
    });
    stream.complete({ messages: [], turns: 0, aborted: false });

    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("agent_start");
    expect(events[1].type).toBe("message_delta");
  });

  it("should resolve result() after complete", async () => {
    const stream = new EventStream<AgentEvent>();
    const expected: AgentResult = {
      messages: [],
      turns: 3,
      aborted: false,
    };

    stream.complete(expected);
    const result = await stream.result();

    expect(result.turns).toBe(3);
    expect(result.aborted).toBe(false);
  });

  it("should handle async push (consumer waits for producer)", async () => {
    const stream = new EventStream<AgentEvent>();
    const events: AgentEvent[] = [];

    const consumer = (async () => {
      for await (const event of stream) {
        events.push(event);
      }
    })();

    // Push after a tick
    await new Promise((r) => setTimeout(r, 10));
    stream.push({ type: "agent_start", timestamp: 1 });

    await new Promise((r) => setTimeout(r, 10));
    stream.complete({ messages: [], turns: 1, aborted: false });

    await consumer;
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("agent_start");
  });

  it("should handle abort", async () => {
    const stream = new EventStream<AgentEvent>();
    const events: AgentEvent[] = [];

    const consumer = (async () => {
      for await (const event of stream) {
        events.push(event);
      }
    })();

    stream.push({ type: "agent_start", timestamp: 1 });
    stream.abort(new Error("cancelled"));

    await consumer;
    const result = await stream.result();

    expect(events).toHaveLength(1);
    expect(result.aborted).toBe(true);
    expect(result.error?.message).toBe("cancelled");
  });

  it("should report isComplete correctly", () => {
    const stream = new EventStream<AgentEvent>();
    expect(stream.isComplete).toBe(false);

    stream.complete({ messages: [], turns: 0, aborted: false });
    expect(stream.isComplete).toBe(true);
  });

  it("should ignore pushes after complete", async () => {
    const stream = new EventStream<AgentEvent>();
    const events: AgentEvent[] = [];

    stream.push({ type: "agent_start", timestamp: 1 });
    stream.complete({ messages: [], turns: 0, aborted: false });
    stream.push({ type: "agent_start", timestamp: 2 }); // should be ignored

    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
  });
});
