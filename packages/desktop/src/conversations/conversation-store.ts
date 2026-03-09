import type { ConversationData, MessageData } from "../types.js";

/**
 * Persistence interface for conversation data.
 */
export interface ConversationStore {
  /** List all conversations (metadata only, no messages) */
  listConversations(): Promise<ConversationData[]>;
  /** Get a single conversation's metadata */
  getConversation(id: string): Promise<ConversationData | null>;
  /** Save conversation metadata */
  saveConversation(data: ConversationData): Promise<void>;
  /** Delete a conversation and all its messages */
  deleteConversation(id: string): Promise<void>;
  /** Get all messages for a conversation */
  getMessages(conversationId: string): Promise<MessageData[]>;
  /** Append messages to a conversation */
  appendMessages(conversationId: string, messages: MessageData[]): Promise<void>;
  /** Replace all messages for a conversation (full rewrite) */
  replaceMessages(conversationId: string, messages: MessageData[]): Promise<void>;
}
