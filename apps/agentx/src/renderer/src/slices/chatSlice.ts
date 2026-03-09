import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status?: "running" | "done" | "error";
  result?: { content: string; isError?: boolean };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCallData[];
  toolCallId?: string;
  isError?: boolean;
  timestamp: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface PendingApproval {
  approvalId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface ChatState {
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  messages: Message[];
  inputValue: string;
  isStreaming: boolean;
  streamingMessageId: string | null;
  /** Tracks the single assistant message used across all turns in one agent run */
  activeAgentMessageId: string | null;
  error: string | null;
  /** Tool approval request waiting for user response */
  pendingApproval: PendingApproval | null;
  /** Conversation IDs with running agent sessions */
  runningSessions: string[];
}

// ---------------------------------------------------------------------------
// Async thunks
// ---------------------------------------------------------------------------

export const loadConversations = createAsyncThunk("chat/loadConversations", async () => {
  const list = await window.api.conversation.list();
  return list as ConversationSummary[];
});

export const createNewConversation = createAsyncThunk(
  "chat/createNewConversation",
  async (title?: string) => {
    const conv = await window.api.conversation.create(title);
    return conv as ConversationSummary;
  },
);

export const loadMessages = createAsyncThunk(
  "chat/loadMessages",
  async (conversationId: string) => {
    const msgs = await window.api.conversation.messages(conversationId);
    // Add local IDs to messages from the store (they don't have IDs)
    return (msgs as Array<Omit<Message, "id">>).map((m) => ({
      ...m,
      id: uuidv4(),
    })) as Message[];
  },
);

export const switchConversation = createAsyncThunk(
  "chat/switchConversation",
  async (conversationId: string) => {
    const msgs = await window.api.conversation.messages(conversationId);
    const status = await window.api.agent.status(conversationId);
    const isRunning =
      status &&
      (status as { status: string }).status !== "completed" &&
      (status as { status: string }).status !== "error" &&
      (status as { status: string }).status !== "aborted";
    if (isRunning) {
      await window.api.agent.subscribe(conversationId);
    }
    return {
      conversationId,
      messages: (msgs as Array<Omit<Message, "id">>).map((m) => ({
        ...m,
        id: uuidv4(),
      })) as Message[],
      isRunning: !!isRunning,
    };
  },
);

export const removeConversation = createAsyncThunk(
  "chat/removeConversation",
  async (id: string, { getState, dispatch }) => {
    await window.api.conversation.delete(id);
    const state = (getState() as { chat: ChatState }).chat;
    if (state.currentConversationId === id) {
      const remaining = state.conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        dispatch(switchConversation(remaining[0].id));
      }
    }
    return id;
  },
);

export const updateConversationTitle = createAsyncThunk(
  "chat/updateConversationTitle",
  async ({ id, title }: { id: string; title: string }) => {
    const updated = await window.api.conversation.updateTitle(id, title);
    return updated as ConversationSummary;
  },
);

export const initializeSessions = createAsyncThunk("chat/initializeSessions", async () => {
  const running = (await window.api.agent.runningConversations()) as string[];
  return running;
});

// ---------------------------------------------------------------------------
// Normalize loaded messages: fold tool result messages into assistant toolCalls
// ---------------------------------------------------------------------------

function normalizeMessages(messages: Message[]): Message[] {
  // Build a map of toolCallId → result from tool messages
  const resultMap = new Map<string, { content: string; isError?: boolean }>();
  for (const msg of messages) {
    if (msg.role === "tool" && msg.toolCallId) {
      resultMap.set(msg.toolCallId, {
        content: msg.content ?? "",
        isError: msg.isError,
      });
    }
  }
  if (resultMap.size === 0) return messages;

  // Attach results to assistant toolCalls, filter out standalone tool messages
  const result: Message[] = [];
  for (const msg of messages) {
    if (msg.role === "tool" && msg.toolCallId && resultMap.has(msg.toolCallId)) {
      continue; // skip — result is folded into assistant's toolCalls
    }
    if (msg.role === "assistant" && msg.toolCalls) {
      msg.toolCalls = msg.toolCalls.map((tc) => {
        const res = resultMap.get(tc.id);
        return res
          ? {
              ...tc,
              result: res,
              status: (res.isError ? "error" : "done") as ToolCallData["status"],
            }
          : tc;
      });
    }
    result.push(msg);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Agent event types (matching SerializableAgentEvent from @workspace/desktop)
// ---------------------------------------------------------------------------

interface AgentEventBase {
  conversationId: string;
  timestamp: number;
}

interface AgentStartEvent extends AgentEventBase {
  type: "agent_start";
}

interface AgentEndEvent extends AgentEventBase {
  type: "agent_end";
  result: { turns: number; aborted: boolean; error?: string };
}

interface MessageStartEvent extends AgentEventBase {
  type: "message_start";
  messageId: string;
}

interface MessageDeltaEvent extends AgentEventBase {
  type: "message_delta";
  messageId: string;
  delta: string;
}

interface MessageEndEvent extends AgentEventBase {
  type: "message_end";
  messageId: string;
  content: string;
}

interface ToolStartEvent extends AgentEventBase {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

interface ToolEndEvent extends AgentEventBase {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  result: { content: string; isError?: boolean };
}

interface ErrorEventData extends AgentEventBase {
  type: "error";
  error: string;
  fatal: boolean;
}

interface ToolApprovalRequestEvent extends AgentEventBase {
  type: "tool_approval_request";
  approvalId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

type AgentEvent =
  | AgentStartEvent
  | AgentEndEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ToolStartEvent
  | ToolEndEvent
  | ErrorEventData
  | ToolApprovalRequestEvent
  | {
      type: "turn_start" | "turn_end" | "tool_update";
      conversationId: string;
      [key: string]: unknown;
    };

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const initialState: ChatState = {
  conversations: [],
  currentConversationId: null,
  messages: [],
  inputValue: "",
  isStreaming: false,
  streamingMessageId: null,
  activeAgentMessageId: null,
  error: null,
  pendingApproval: null,
  runningSessions: [],
};

// ---------------------------------------------------------------------------
// Immer-safe helpers — always access draft elements via state.messages[index],
// never via [...spread].reverse().find() which can detach from the draft tree.
// ---------------------------------------------------------------------------

/** Find message by ID directly in the Immer draft array. */
function findDraftMessage(messages: Message[], id: string): Message | undefined {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].id === id) return messages[i];
  }
  return undefined;
}

/** Find the last assistant message in the Immer draft array. */
function findLastAssistantDraft(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return undefined;
}

/**
 * Find the target assistant message for tool events.
 * Prefer activeAgentMessageId (precise), fall back to last assistant (robust).
 */
function findToolTargetMessage(
  messages: Message[],
  activeAgentMessageId: string | null,
): Message | undefined {
  if (activeAgentMessageId) {
    return findDraftMessage(messages, activeAgentMessageId);
  }
  return findLastAssistantDraft(messages);
}

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setInputValue(state, action: PayloadAction<string>) {
      state.inputValue = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    addUserMessage(state, action: PayloadAction<{ conversationId: string; content: string }>) {
      state.messages.push({
        id: uuidv4(),
        role: "user",
        content: action.payload.content,
        timestamp: Date.now(),
      });
    },
    handleAgentEvent(state, action: PayloadAction<AgentEvent>) {
      const event = action.payload;

      // Route events: skip events for a different conversation
      if (event.conversationId && event.conversationId !== state.currentConversationId) {
        // Still track running sessions even if not the current conversation
        if (event.type === "agent_start") {
          if (!state.runningSessions.includes(event.conversationId)) {
            state.runningSessions.push(event.conversationId);
          }
        } else if (event.type === "agent_end" || event.type === "error") {
          state.runningSessions = state.runningSessions.filter((id) => id !== event.conversationId);
        }
        return;
      }

      switch (event.type) {
        case "agent_start":
          state.isStreaming = true;
          state.error = null;
          state.activeAgentMessageId = null;
          if (event.conversationId && !state.runningSessions.includes(event.conversationId)) {
            state.runningSessions.push(event.conversationId);
          }
          break;

        case "message_start": {
          const msgId = event.messageId;
          // Replay idempotency: skip if message ID already exists
          if (findDraftMessage(state.messages, msgId)) {
            state.streamingMessageId = msgId;
            state.activeAgentMessageId = msgId;
            break;
          }
          state.streamingMessageId = msgId;
          state.activeAgentMessageId = msgId;
          state.messages.push({
            id: msgId,
            role: "assistant",
            content: "",
            timestamp: event.timestamp,
          });
          break;
        }

        case "message_delta": {
          const targetId = state.streamingMessageId ?? event.messageId;
          const msg = findDraftMessage(state.messages, targetId);
          if (msg) {
            msg.content = (msg.content ?? "") + event.delta;
          }
          break;
        }

        case "message_end": {
          const targetId = state.streamingMessageId ?? event.messageId;
          const msg = findDraftMessage(state.messages, targetId);
          if (msg) {
            msg.content = event.content;
          }
          state.streamingMessageId = null;
          break;
        }

        case "tool_start": {
          const msg = findToolTargetMessage(state.messages, state.activeAgentMessageId);
          if (msg) {
            if (!msg.toolCalls) msg.toolCalls = [];
            // Guard: skip if this tool call ID already exists
            if (!msg.toolCalls.some((t) => t.id === event.toolCallId)) {
              msg.toolCalls.push({
                id: event.toolCallId,
                name: event.toolName,
                arguments: event.arguments,
                status: "running",
              });
            }
          }
          break;
        }

        case "tool_end": {
          const msg = findToolTargetMessage(state.messages, state.activeAgentMessageId);
          if (msg?.toolCalls) {
            const idx = msg.toolCalls.findIndex((t) => t.id === event.toolCallId);
            if (idx !== -1) {
              // Mutate the specific element in the draft array directly
              msg.toolCalls[idx].result = event.result;
              msg.toolCalls[idx].status = event.result.isError ? "error" : "done";
            }
          }
          break;
        }

        case "agent_end":
          state.isStreaming = false;
          state.streamingMessageId = null;
          state.activeAgentMessageId = null;
          state.pendingApproval = null;
          if (event.conversationId) {
            state.runningSessions = state.runningSessions.filter(
              (id) => id !== event.conversationId,
            );
          }
          if (event.result.error) {
            state.error = event.result.error;
          }
          break;

        case "tool_approval_request":
          state.pendingApproval = {
            approvalId: event.approvalId,
            toolName: event.toolName,
            arguments: event.arguments,
            timestamp: event.timestamp,
          };
          break;

        case "error":
          state.isStreaming = false;
          state.streamingMessageId = null;
          state.activeAgentMessageId = null;
          state.error = event.error;
          state.pendingApproval = null;
          if (event.conversationId) {
            state.runningSessions = state.runningSessions.filter(
              (id) => id !== event.conversationId,
            );
          }
          break;
      }
    },
    clearPendingApproval(state) {
      state.pendingApproval = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(createNewConversation.fulfilled, (state, action) => {
        state.conversations.unshift(action.payload);
        state.currentConversationId = action.payload.id;
        state.messages = [];
        state.isStreaming = false;
        state.streamingMessageId = null;
        state.activeAgentMessageId = null;
        state.pendingApproval = null;
        state.error = null;
      })
      .addCase(loadMessages.fulfilled, (state, action) => {
        state.messages = normalizeMessages(action.payload);
      })
      .addCase(removeConversation.fulfilled, (state, action) => {
        const id = action.payload;
        state.conversations = state.conversations.filter((c) => c.id !== id);
        if (state.currentConversationId === id) {
          state.currentConversationId = state.conversations[0]?.id ?? null;
          state.messages = [];
          state.isStreaming = false;
          state.streamingMessageId = null;
          state.activeAgentMessageId = null;
          state.pendingApproval = null;
          state.error = null;
        }
      })
      .addCase(updateConversationTitle.fulfilled, (state, action) => {
        const idx = state.conversations.findIndex((c) => c.id === action.payload.id);
        if (idx >= 0) {
          state.conversations[idx] = action.payload;
        }
      })
      .addCase(switchConversation.fulfilled, (state, action) => {
        state.currentConversationId = action.payload.conversationId;
        state.messages = normalizeMessages(action.payload.messages);
        // Always reset streaming state, then restore if the target is running
        state.isStreaming = action.payload.isRunning;
        state.streamingMessageId = null;
        state.activeAgentMessageId = null;
        state.pendingApproval = null;
        state.error = null;
      })
      .addCase(initializeSessions.fulfilled, (state, action) => {
        state.runningSessions = action.payload;
      });
  },
});

export const { setInputValue, setError, addUserMessage, handleAgentEvent, clearPendingApproval } =
  chatSlice.actions;

export default chatSlice.reducer;
