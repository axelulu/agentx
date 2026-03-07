import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  inputValue: string;
  isStreaming: boolean;
}

const initialState: ChatState = {
  conversations: [],
  currentConversationId: null,
  inputValue: "",
  isStreaming: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    createConversation(state) {
      const conversation: Conversation = {
        id: uuidv4(),
        title: "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.conversations.unshift(conversation);
      state.currentConversationId = conversation.id;
    },
    setCurrentConversation(state, action: PayloadAction<string>) {
      state.currentConversationId = action.payload;
    },
    addMessage(
      state,
      action: PayloadAction<{
        conversationId: string;
        message: Omit<Message, "id" | "timestamp">;
      }>
    ) {
      const conversation = state.conversations.find(
        (c) => c.id === action.payload.conversationId
      );
      if (conversation) {
        const message: Message = {
          ...action.payload.message,
          id: uuidv4(),
          timestamp: Date.now(),
        };
        conversation.messages.push(message);
        conversation.updatedAt = Date.now();

        // Auto-title from first user message
        if (
          message.role === "user" &&
          conversation.messages.length === 1
        ) {
          conversation.title = message.content.slice(0, 50);
        }
      }
    },
    appendToLastMessage(
      state,
      action: PayloadAction<{
        conversationId: string;
        content: string;
      }>
    ) {
      const conversation = state.conversations.find(
        (c) => c.id === action.payload.conversationId
      );
      if (conversation && conversation.messages.length > 0) {
        const lastMessage =
          conversation.messages[conversation.messages.length - 1];
        if (lastMessage) {
          lastMessage.content += action.payload.content;
        }
      }
    },
    deleteConversation(state, action: PayloadAction<string>) {
      state.conversations = state.conversations.filter(
        (c) => c.id !== action.payload
      );
      if (state.currentConversationId === action.payload) {
        state.currentConversationId =
          state.conversations[0]?.id ?? null;
      }
    },
    setInputValue(state, action: PayloadAction<string>) {
      state.inputValue = action.payload;
    },
    setIsStreaming(state, action: PayloadAction<boolean>) {
      state.isStreaming = action.payload;
    },
  },
});

export const {
  createConversation,
  setCurrentConversation,
  addMessage,
  appendToLastMessage,
  deleteConversation,
  setInputValue,
  setIsStreaming,
} = chatSlice.actions;

export default chatSlice.reducer;
