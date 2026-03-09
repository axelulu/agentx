import { describe, it, expect, vi, beforeEach } from "vitest";
import { toSerializableEvent } from "../sessions/event-bridge.js";
import { ProviderManager } from "../providers/provider-manager.js";
import { ConversationManager } from "../conversations/conversation-manager.js";
import type { ConversationStore } from "../conversations/conversation-store.js";
import type { ConversationData, MessageData } from "../types.js";
import type { AgentEvent } from "@workspace/agent";

// ---------------------------------------------------------------------------
// Event Bridge tests
// ---------------------------------------------------------------------------

const TEST_CONV_ID = "test-conv-123";

describe("toSerializableEvent", () => {
  it("converts agent_start event", () => {
    const event: AgentEvent = { type: "agent_start", timestamp: 1000 };
    const result = toSerializableEvent(event, TEST_CONV_ID);
    expect(result).toEqual({ type: "agent_start", conversationId: TEST_CONV_ID, timestamp: 1000 });
  });

  it("converts error event with Error object to string", () => {
    const event: AgentEvent = {
      type: "error",
      timestamp: 1000,
      error: new Error("something failed"),
      fatal: true,
    };
    const result = toSerializableEvent(event, TEST_CONV_ID);
    expect(result).toEqual({
      type: "error",
      conversationId: TEST_CONV_ID,
      timestamp: 1000,
      error: "something failed",
      fatal: true,
    });
  });

  it("converts agent_end with error", () => {
    const event: AgentEvent = {
      type: "agent_end",
      timestamp: 1000,
      result: {
        messages: [],
        turns: 3,
        aborted: false,
        error: new Error("limit reached"),
      },
    };
    const result = toSerializableEvent(event, TEST_CONV_ID);
    expect(result).toEqual({
      type: "agent_end",
      conversationId: TEST_CONV_ID,
      timestamp: 1000,
      result: {
        turns: 3,
        aborted: false,
        error: "limit reached",
      },
    });
  });

  it("converts tool_end event", () => {
    const event: AgentEvent = {
      type: "tool_end",
      timestamp: 1000,
      toolCallId: "call_1",
      toolName: "file_read",
      result: { content: "file content", isError: false },
    };
    const result = toSerializableEvent(event, TEST_CONV_ID);
    expect(result).toEqual({
      type: "tool_end",
      conversationId: TEST_CONV_ID,
      timestamp: 1000,
      toolCallId: "call_1",
      toolName: "file_read",
      result: { content: "file content", isError: false },
    });
  });
});

// ---------------------------------------------------------------------------
// ProviderManager tests
// ---------------------------------------------------------------------------

describe("ProviderManager", () => {
  let manager: ProviderManager;

  beforeEach(() => {
    manager = new ProviderManager();
  });

  it("sets and retrieves provider configs", () => {
    manager.setProvider({
      id: "p1",
      name: "OpenAI",
      type: "openai",
      apiKey: "test-key",
      defaultModel: "gpt-4o",
    });

    const configs = manager.getProviderConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0]!.id).toBe("p1");
  });

  it("first provider becomes active by default", () => {
    manager.setProvider({
      id: "p1",
      name: "OpenAI",
      type: "openai",
      apiKey: "key",
    });

    const active = manager.getActiveProvider();
    expect(active?.id).toBe("p1");
  });

  it("respects isActive flag", () => {
    manager.setProvider({
      id: "p1",
      name: "OpenAI",
      type: "openai",
      apiKey: "key",
    });
    manager.setProvider({
      id: "p2",
      name: "Anthropic",
      type: "anthropic",
      apiKey: "key",
      isActive: true,
    });

    expect(manager.getActiveProvider()?.id).toBe("p2");
  });

  it("removes provider and updates active", () => {
    manager.setProvider({
      id: "p1",
      name: "OpenAI",
      type: "openai",
      apiKey: "key",
    });
    manager.setProvider({
      id: "p2",
      name: "Anthropic",
      type: "anthropic",
      apiKey: "key",
    });

    manager.removeProvider("p1");
    expect(manager.getProviderConfigs()).toHaveLength(1);
    expect(manager.getActiveProvider()?.id).toBe("p2");
  });

  it("throws when creating StreamFn without active provider", () => {
    expect(() => manager.createStreamFn()).toThrow("No active provider");
  });
});

// ---------------------------------------------------------------------------
// ConversationManager tests
// ---------------------------------------------------------------------------

describe("ConversationManager", () => {
  function createMockStore(): ConversationStore {
    const conversations = new Map<string, ConversationData>();
    const messages = new Map<string, MessageData[]>();

    return {
      listConversations: vi.fn(async () =>
        [...conversations.values()].sort((a, b) => b.updatedAt - a.updatedAt),
      ),
      getConversation: vi.fn(async (id: string) => conversations.get(id) ?? null),
      saveConversation: vi.fn(async (data: ConversationData) => {
        conversations.set(data.id, data);
      }),
      deleteConversation: vi.fn(async (id: string) => {
        conversations.delete(id);
        messages.delete(id);
      }),
      getMessages: vi.fn(async (id: string) => messages.get(id) ?? []),
      appendMessages: vi.fn(async (id: string, msgs: MessageData[]) => {
        const existing = messages.get(id) ?? [];
        messages.set(id, [...existing, ...msgs]);
      }),
    };
  }

  it("creates and lists conversations", async () => {
    const store = createMockStore();
    const manager = new ConversationManager(store);

    const conv = await manager.createConversation("Test Chat");
    expect(conv.title).toBe("Test Chat");
    expect(conv.id).toBeTruthy();

    const list = await manager.listConversations();
    expect(list).toHaveLength(1);
  });

  it("deletes a conversation", async () => {
    const store = createMockStore();
    const manager = new ConversationManager(store);

    const conv = await manager.createConversation();
    await manager.deleteConversation(conv.id);

    expect(store.deleteConversation).toHaveBeenCalledWith(conv.id);
  });

  it("appends messages and updates metadata", async () => {
    const store = createMockStore();
    const manager = new ConversationManager(store);

    const conv = await manager.createConversation();
    await manager.appendMessages(conv.id, [
      { role: "user", content: "hello", timestamp: Date.now() },
    ]);

    const messages = await manager.getMessages(conv.id);
    expect(messages).toHaveLength(1);
  });
});
