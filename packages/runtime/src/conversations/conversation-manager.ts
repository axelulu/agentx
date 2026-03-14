import { randomUUID } from "node:crypto";
import type { ConversationStore } from "./conversation-store.js";
import type { ConversationData, MessageData, BranchInfo } from "../types.js";

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

  async saveConversation(data: ConversationData): Promise<void> {
    return this.store.saveConversation(data);
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

  async replaceMessages(conversationId: string, messages: MessageData[]): Promise<void> {
    await this.store.replaceMessages(conversationId, messages);
  }

  // ---------------------------------------------------------------------------
  // Branch / tree resolution
  // ---------------------------------------------------------------------------

  /**
   * Walk the message tree using `activeBranches` to produce a linear active path.
   * Legacy messages (no id/parentId) are returned as-is.
   */
  resolveActiveBranch(
    messages: MessageData[],
    activeBranches: Record<string, string>,
  ): MessageData[] {
    // If no messages have IDs, this is a legacy conversation — return as-is
    if (messages.length === 0 || !messages.some((m) => m.id)) {
      return messages;
    }

    // Build parent → children map
    const childrenMap = new Map<string, MessageData[]>();
    const roots: MessageData[] = [];

    for (const msg of messages) {
      if (!msg.parentId) {
        roots.push(msg);
      } else {
        const siblings = childrenMap.get(msg.parentId) ?? [];
        siblings.push(msg);
        childrenMap.set(msg.parentId, siblings);
      }
    }

    // Walk from roots following activeBranches
    const result: MessageData[] = [];
    const queue = [...roots];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const children = childrenMap.get(current.id!) ?? [];
      if (children.length === 0) continue;

      // Pick the active child at this fork point, or default to last
      const activeChildId = activeBranches[current.id!];
      const activeChild = activeChildId
        ? children.find((c) => c.id === activeChildId)
        : children[children.length - 1];

      if (activeChild) {
        queue.push(activeChild);
      }
    }

    return result;
  }

  /**
   * Compute branch info for all fork points in the message tree.
   * A fork point is a message that has multiple children.
   */
  computeBranchInfo(messages: MessageData[], activeBranches: Record<string, string>): BranchInfo {
    if (messages.length === 0 || !messages.some((m) => m.id)) {
      return {};
    }

    // Build parent → children map
    const childrenMap = new Map<string, MessageData[]>();
    for (const msg of messages) {
      if (msg.parentId) {
        const siblings = childrenMap.get(msg.parentId) ?? [];
        siblings.push(msg);
        childrenMap.set(msg.parentId, siblings);
      }
    }

    const info: BranchInfo = {};

    for (const [parentId, children] of childrenMap) {
      if (children.length <= 1) continue;

      const siblingIds = children.map((c) => c.id!);
      const activeChildId = activeBranches[parentId] ?? siblingIds[siblingIds.length - 1]!;
      const activeIndex = siblingIds.indexOf(activeChildId);

      // Key by each child message ID so the frontend can look up by message
      for (const childId of siblingIds) {
        info[childId] = {
          siblings: siblingIds,
          activeIndex: activeIndex >= 0 ? activeIndex : siblingIds.length - 1,
        };
      }
    }

    return info;
  }

  /**
   * Get the active (linear) message path for a conversation.
   */
  async getActiveMessages(conversationId: string): Promise<MessageData[]> {
    const allMessages = await this.store.getMessages(conversationId);
    const convData = await this.store.getConversation(conversationId);
    const activeBranches = convData?.activeBranches ?? {};
    return this.resolveActiveBranch(allMessages, activeBranches);
  }

  /**
   * Switch the active branch at a fork point.
   */
  async switchBranch(conversationId: string, targetMessageId: string): Promise<void> {
    const allMessages = await this.store.getMessages(conversationId);
    const target = allMessages.find((m) => m.id === targetMessageId);
    if (!target?.parentId) return;

    const convData = await this.store.getConversation(conversationId);
    if (!convData) return;

    if (!convData.activeBranches) convData.activeBranches = {};
    convData.activeBranches[target.parentId] = targetMessageId;
    convData.updatedAt = Date.now();
    await this.store.saveConversation(convData);
  }

  /**
   * Get branch info for a conversation.
   */
  async getBranchInfo(conversationId: string): Promise<BranchInfo> {
    const allMessages = await this.store.getMessages(conversationId);
    const convData = await this.store.getConversation(conversationId);
    const activeBranches = convData?.activeBranches ?? {};
    return this.computeBranchInfo(allMessages, activeBranches);
  }
}
