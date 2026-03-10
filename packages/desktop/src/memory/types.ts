/**
 * Cross-session memory types.
 */

export interface ConversationSummary {
  id: string;
  conversationId: string;
  title: string;
  summary: string;
  topics: string[];
  createdAt: number;
}

export interface LearnedFact {
  id: string;
  /** Category of the learned fact */
  category: "preference" | "project" | "pattern" | "instruction";
  /** The fact content */
  content: string;
  /** Conversation ID where this was learned */
  sourceConversationId: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryConfig {
  /** Whether cross-session memory is enabled */
  enabled: boolean;
  /** Max number of conversation summaries to retain */
  maxSummaries: number;
  /** Max number of learned facts to retain */
  maxFacts: number;
  /** Whether to auto-extract memories after each conversation */
  autoExtract: boolean;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  maxSummaries: 50,
  maxFacts: 100,
  autoExtract: true,
};

/** Result from the LLM extraction */
export interface MemoryExtraction {
  summary: string;
  topics: string[];
  facts: Array<{
    category: LearnedFact["category"];
    content: string;
  }>;
}
