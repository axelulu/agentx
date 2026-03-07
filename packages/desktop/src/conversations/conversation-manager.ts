import { randomUUID } from "node:crypto";
import type { ConversationStore } from "./conversation-store.js";
import type { ConversationData, MessageData } from "../types.js";

/**
 * Manages conversation CRUD and message history.
 */
export class ConversationManager {
  constructor(private store: ConversationStore) {}

  async createConversation(title?: string): Promise<ConversationData> {
    const now = Date.now();
    const data: ConversationData = {
      id: randomUUID(),
      title: title ?? "New Conversation",
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    await this.store.saveConversation(data);
    return data;
  }

  async listConversations(): Promise<ConversationData[]> {
    return this.store.listConversations();
  }

  async getConversation(id: string): Promise<ConversationData | null> {
    return this.store.getConversation(id);
  }

  async deleteConversation(id: string): Promise<void> {
    return this.store.deleteConversation(id);
  }

  async updateTitle(id: string, title: string): Promise<ConversationData> {
    const data = await this.store.getConversation(id);
    if (!data) throw new Error(`Conversation not found: ${id}`);
    data.title = title;
    data.updatedAt = Date.now();
    await this.store.saveConversation(data);
    return data;
  }

  async getMessages(conversationId: string): Promise<MessageData[]> {
    return this.store.getMessages(conversationId);
  }

  async appendMessages(conversationId: string, messages: MessageData[]): Promise<void> {
    await this.store.appendMessages(conversationId, messages);

    // Update metadata
    const data = await this.store.getConversation(conversationId);
    if (data) {
      data.messageCount += messages.length;
      data.updatedAt = Date.now();
      await this.store.saveConversation(data);
    }
  }
}
