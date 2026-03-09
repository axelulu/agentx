import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status?: "running" | "done" | "error" | "cancelled";
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
  folderId?: string;
  isFavorite?: boolean;
}

export interface PendingApproval {
  approvalId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface BranchInfoEntry {
  siblings: string[];
  activeIndex: number;
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
  /** Accumulated token usage for the current conversation session */
  sessionUsage: TokenUsage;
  /** Total accumulated token usage for the current conversation (all sessions) */
  conversationUsage: TokenUsage;
  /** Skill IDs enabled for the current conversation */
  enabledSkills: string[];
  /** Branch navigation info — keyed by message ID */
  branchInfo: Record<string, BranchInfoEntry>;
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
    // Use backend-assigned id if present, fall back to uuidv4()
    return (msgs as Array<Omit<Message, "id"> & { id?: string }>).map((m) => ({
      ...m,
      id: m.id || uuidv4(),
    })) as Message[];
  },
);

export const switchConversation = createAsyncThunk(
  "chat/switchConversation",
  async (conversationId: string) => {
    const [msgs, status, enabledSkills, branchInfo] = await Promise.all([
      window.api.conversation.messages(conversationId),
      window.api.agent.status(conversationId),
      window.api.skills.getEnabled(conversationId),
      window.api.conversation.branchInfo(conversationId),
    ]);
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
      messages: (msgs as Array<Omit<Message, "id"> & { id?: string }>).map((m) => ({
        ...m,
        id: m.id || uuidv4(),
      })) as Message[],
      isRunning: !!isRunning,
      enabledSkills: enabledSkills as string[],
      branchInfo: (branchInfo ?? {}) as Record<string, BranchInfoEntry>,
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

export const removeConversations = createAsyncThunk(
  "chat/removeConversations",
  async (ids: string[], { getState, dispatch }) => {
    const results = await Promise.allSettled(ids.map((id) => window.api.conversation.delete(id)));
    const deleted: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") deleted.push(ids[i]);
    });
    const state = (getState() as { chat: ChatState }).chat;
    if (state.currentConversationId && deleted.includes(state.currentConversationId)) {
      const remaining = state.conversations.filter((c) => !deleted.includes(c.id));
      if (remaining.length > 0) {
        dispatch(switchConversation(remaining[0].id));
      }
    }
    return deleted;
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

export const updateConversationFolder = createAsyncThunk(
  "chat/updateConversationFolder",
  async ({ id, folderId }: { id: string; folderId: string | null }) => {
    await window.api.conversation.setFolder(id, folderId);
    return { id, folderId };
  },
);

export const toggleConversationFavorite = createAsyncThunk(
  "chat/toggleConversationFavorite",
  async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
    await window.api.conversation.setFavorite(id, isFavorite);
    return { id, isFavorite };
  },
);

export const switchBranch = createAsyncThunk(
  "chat/switchBranch",
  async ({
    conversationId,
    targetMessageId,
  }: {
    conversationId: string;
    targetMessageId: string;
  }) => {
    await window.api.conversation.switchBranch(conversationId, targetMessageId);
    const [msgs, branchInfo] = await Promise.all([
      window.api.conversation.messages(conversationId),
      window.api.conversation.branchInfo(conversationId),
    ]);
    return {
      messages: (msgs as Array<Omit<Message, "id"> & { id?: string }>).map((m) => ({
        ...m,
        id: m.id || uuidv4(),
      })) as Message[],
      branchInfo: (branchInfo ?? {}) as Record<string, BranchInfoEntry>,
    };
  },
);

export const regenerateMessage = createAsyncThunk(
  "chat/regenerateMessage",
  async ({
    conversationId,
    assistantMessageId,
  }: {
    conversationId: string;
    assistantMessageId: string;
  }) => {
    const result = (await window.api.agent.regenerate(conversationId, assistantMessageId)) as
      | {
          started: boolean;
        }
      | undefined;
    if (result?.started) {
      await window.api.agent.subscribe(conversationId);
    }
    return { started: !!result?.started };
  },
);

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

interface UsageEventData extends AgentEventBase {
  type: "usage";
  inputTokens: number;
  outputTokens: number;
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
  | UsageEventData
  | {
      type: "turn_start" | "turn_end" | "tool_update";
      conversationId: string;
      [key: string]: unknown;
    };

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

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
  sessionUsage: { ...EMPTY_USAGE },
  conversationUsage: { ...EMPTY_USAGE },
  enabledSkills: [],
  branchInfo: {},
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

/**
 * Clean up incomplete state after abort or error:
 * - Remove empty streaming messages (no content & no tool calls)
 * - Mark still-running tool calls as "cancelled"
 */
function cleanupPartialMessages(messages: Message[]): void {
  // Walk backwards to safely remove empty messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const hasContent = !!msg.content;
    const hasToolCalls = !!msg.toolCalls && msg.toolCalls.length > 0;

    // Remove completely empty assistant messages (no content at all)
    if (!hasContent && !hasToolCalls) {
      messages.splice(i, 1);
      continue;
    }

    // Mark running tool calls as cancelled
    if (msg.toolCalls) {
      for (let j = 0; j < msg.toolCalls.length; j++) {
        if (msg.toolCalls[j].status === "running") {
          msg.toolCalls[j].status = "cancelled";
        }
      }
    }
  }
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
          state.sessionUsage = { ...EMPTY_USAGE };
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
          // Clean up incomplete messages from abort or unexpected termination
          cleanupPartialMessages(state.messages);
          break;

        case "usage":
          state.sessionUsage.inputTokens += event.inputTokens;
          state.sessionUsage.outputTokens += event.outputTokens;
          state.conversationUsage.inputTokens += event.inputTokens;
          state.conversationUsage.outputTokens += event.outputTokens;
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
          // Clean up incomplete messages from the error
          cleanupPartialMessages(state.messages);
          break;
      }
    },
    clearPendingApproval(state) {
      state.pendingApproval = null;
    },
    setBranchInfo(state, action: PayloadAction<Record<string, BranchInfoEntry>>) {
      state.branchInfo = action.payload;
    },
    setEnabledSkills(state, action: PayloadAction<string[]>) {
      state.enabledSkills = action.payload;
    },
    toggleSkill(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.enabledSkills.indexOf(id);
      if (idx >= 0) {
        state.enabledSkills.splice(idx, 1);
      } else {
        state.enabledSkills.push(id);
      }
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
        state.sessionUsage = { ...EMPTY_USAGE };
        state.conversationUsage = { ...EMPTY_USAGE };
        state.enabledSkills = [];
        state.branchInfo = {};
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
        state.sessionUsage = { ...EMPTY_USAGE };
        state.conversationUsage = { ...EMPTY_USAGE };
        state.enabledSkills = action.payload.enabledSkills ?? [];
        state.branchInfo = action.payload.branchInfo ?? {};
      })
      .addCase(removeConversations.fulfilled, (state, action) => {
        const deleted = new Set(action.payload);
        state.conversations = state.conversations.filter((c) => !deleted.has(c.id));
        if (state.currentConversationId && deleted.has(state.currentConversationId)) {
          state.currentConversationId = state.conversations[0]?.id ?? null;
          state.messages = [];
          state.isStreaming = false;
          state.streamingMessageId = null;
          state.activeAgentMessageId = null;
          state.pendingApproval = null;
          state.error = null;
        }
      })
      .addCase(initializeSessions.fulfilled, (state, action) => {
        state.runningSessions = action.payload;
      })
      .addCase(updateConversationFolder.fulfilled, (state, action) => {
        const { id, folderId } = action.payload;
        const conv = state.conversations.find((c) => c.id === id);
        if (conv) {
          conv.folderId = folderId ?? undefined;
        }
      })
      .addCase(toggleConversationFavorite.fulfilled, (state, action) => {
        const { id, isFavorite } = action.payload;
        const conv = state.conversations.find((c) => c.id === id);
        if (conv) {
          conv.isFavorite = isFavorite || undefined;
        }
      })
      .addCase(switchBranch.fulfilled, (state, action) => {
        state.messages = normalizeMessages(action.payload.messages);
        state.branchInfo = action.payload.branchInfo;
      })
      .addCase(regenerateMessage.pending, (state, action) => {
        state.isStreaming = true;
        state.error = null;
        // Truncate messages from the assistant message being regenerated onwards
        const { assistantMessageId } = action.meta.arg;
        const idx = state.messages.findIndex((m) => m.id === assistantMessageId);
        if (idx >= 0) {
          state.messages = state.messages.slice(0, idx);
        }
      })
      .addCase(regenerateMessage.fulfilled, (state, action) => {
        if (!action.payload.started) {
          state.isStreaming = false;
          state.error = "Failed to regenerate: message not found";
        }
      })
      .addCase(regenerateMessage.rejected, (state, action) => {
        state.isStreaming = false;
        state.error = action.error.message ?? "Regeneration failed";
      });
  },
});

export const {
  setInputValue,
  setError,
  addUserMessage,
  handleAgentEvent,
  clearPendingApproval,
  setBranchInfo,
  setEnabledSkills,
  toggleSkill,
} = chatSlice.actions;

export default chatSlice.reducer;
