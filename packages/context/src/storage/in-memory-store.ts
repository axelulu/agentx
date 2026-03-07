import type { ConversationSummary, SummaryStore } from "../types.js";

/**
 * In-memory implementation of SummaryStore.
 * Suitable for development and desktop use where persistence
 * across process restarts is not required.
 */
export class InMemorySummaryStore implements SummaryStore {
  private summaries = new Map<string, ConversationSummary>();

  async get(conversationId: string): Promise<ConversationSummary | null> {
    return this.summaries.get(conversationId) ?? null;
  }

  async save(summary: ConversationSummary): Promise<void> {
    this.summaries.set(summary.conversationId, summary);
  }

  async delete(conversationId: string): Promise<void> {
    this.summaries.delete(conversationId);
  }

  /** Clear all stored summaries */
  clear(): void {
    this.summaries.clear();
  }

  /** Get the number of stored summaries */
  get size(): number {
    return this.summaries.size;
  }
}
