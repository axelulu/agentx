import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
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

export interface ChatState {
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  messages: Message[];
  inputValue: string;
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
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

export const removeConversation = createAsyncThunk(
  "chat/removeConversation",
  async (id: string, { getState }) => {
    await window.api.conversation.delete(id);
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

// ---------------------------------------------------------------------------
// Agent event types (matching SerializableAgentEvent from @workspace/desktop)
// ---------------------------------------------------------------------------

interface AgentEventBase {
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

type AgentEvent =
  | AgentStartEvent
  | AgentEndEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ToolStartEvent
  | ToolEndEvent
  | ErrorEventData
  | { type: "turn_start" | "turn_end" | "tool_update"; [key: string]: unknown };

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
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setCurrentConversation(state, action: PayloadAction<string>) {
      state.currentConversationId = action.payload;
    },
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
      switch (event.type) {
        case "agent_start":
          state.isStreaming = true;
          state.error = null;
          break;

        case "message_start": {
          const msgId = event.messageId;
          state.streamingMessageId = msgId;
          state.messages.push({
            id: msgId,
            role: "assistant",
            content: "",
            timestamp: event.timestamp,
          });
          break;
        }

        case "message_delta": {
          const msg = state.messages.find((m) => m.id === event.messageId);
          if (msg) {
            msg.content = (msg.content ?? "") + event.delta;
          }
          break;
        }

        case "message_end": {
          const msg = state.messages.find((m) => m.id === event.messageId);
          if (msg) {
            msg.content = event.content;
          }
          state.streamingMessageId = null;
          break;
        }

        case "tool_start": {
          // Find the current assistant message and add tool call info
          const lastAssistant = [...state.messages].reverse().find((m) => m.role === "assistant");
          if (lastAssistant) {
            if (!lastAssistant.toolCalls) lastAssistant.toolCalls = [];
            lastAssistant.toolCalls.push({
              id: event.toolCallId,
              name: event.toolName,
              arguments: event.arguments,
            });
          }
          break;
        }

        case "tool_end": {
          state.messages.push({
            id: uuidv4(),
            role: "tool",
            content: event.result.content,
            toolCallId: event.toolCallId,
            isError: event.result.isError,
            timestamp: event.timestamp,
          });
          break;
        }

        case "agent_end":
          state.isStreaming = false;
          state.streamingMessageId = null;
          if (event.result.error) {
            state.error = event.result.error;
          }
          break;

        case "error":
          state.isStreaming = false;
          state.streamingMessageId = null;
          state.error = event.error;
          break;
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
      })
      .addCase(loadMessages.fulfilled, (state, action) => {
        state.messages = action.payload;
      })
      .addCase(removeConversation.fulfilled, (state, action) => {
        const id = action.payload;
        state.conversations = state.conversations.filter((c) => c.id !== id);
        if (state.currentConversationId === id) {
          state.currentConversationId = state.conversations[0]?.id ?? null;
          state.messages = [];
        }
      })
      .addCase(updateConversationTitle.fulfilled, (state, action) => {
        const idx = state.conversations.findIndex((c) => c.id === action.payload.id);
        if (idx >= 0) {
          state.conversations[idx] = action.payload;
        }
      });
  },
});

export const { setCurrentConversation, setInputValue, setError, addUserMessage, handleAgentEvent } =
  chatSlice.actions;

export default chatSlice.reducer;
