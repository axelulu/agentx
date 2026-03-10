// ---------------------------------------------------------------------------
// LLM abstraction (wire-level message types)
// ---------------------------------------------------------------------------

export interface LLMSystemMessage {
  role: "system";
  content: string;
}

export interface LLMUserMessage {
  role: "user";
  content:
    | string
    | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export interface LLMAssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface LLMToolMessage {
  role: "tool";
  tool_call_id: string;
  content:
    | string
    | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export type LLMMessage = LLMSystemMessage | LLMUserMessage | LLMAssistantMessage | LLMToolMessage;

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Stream chunks from LLM
export interface ContentDeltaChunk {
  type: "content_delta";
  delta: string;
}

export interface ToolCallDeltaChunk {
  type: "tool_call_delta";
  index: number;
  id?: string;
  name?: string;
  argumentsDelta: string;
}

export interface UsageChunk {
  type: "usage";
  inputTokens: number;
  outputTokens: number;
}

export interface DoneChunk {
  type: "done";
}

export type LLMStreamChunk = ContentDeltaChunk | ToolCallDeltaChunk | UsageChunk | DoneChunk;

export interface StreamFnOptions {
  model: string;
  tools?: LLMToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  toolChoice?: "auto" | "required" | "none";
  signal?: AbortSignal;
}

/**
 * Core injection point: Agent calls this function to get LLM responses.
 * Return an async iterable of LLMStreamChunk.
 */
export type StreamFn = (
  messages: LLMMessage[],
  options: StreamFnOptions,
) => AsyncIterable<LLMStreamChunk>;

// ---------------------------------------------------------------------------
// Middleware (base types — agent extends these)
// ---------------------------------------------------------------------------

export interface MiddlewareContext {
  messages: LLMMessage[];
  config: MiddlewareConfig;
  turn: number;
}

/**
 * Minimal config shape visible to middleware.
 * Agent's AgentConfig is a superset of this.
 */
export interface MiddlewareConfig {
  model: string;
  streamFn?: StreamFn;
}

export interface Middleware {
  name: string;
  beforeModelCall?: (ctx: MiddlewareContext) => Promise<LLMMessage[] | void>;
}

// ---------------------------------------------------------------------------
// Context Manager config
// ---------------------------------------------------------------------------

/**
 * Configuration for the ContextManager.
 */
export interface ContextConfig {
  /** Maximum token budget for the context window */
  maxContextTokens: number;
  /** Number of recent assistant turns to keep uncompressed (default: 5) */
  recentTurnsToKeep?: number;
  /** Maximum character length for a single tool result before truncation */
  toolResultMaxChars?: number;
  /** Head portion chars to keep when truncating (default: 500) */
  toolResultHeadChars?: number;
  /** Tail portion chars to keep when truncating (default: 1500) */
  toolResultTailChars?: number;
  /** Enable LLM-based history summarization (requires streamFn) */
  enableSummarization?: boolean;
  /** Max tokens for generated summaries (default: 2000) */
  summaryMaxTokens?: number;
}

/**
 * Options for a single optimizeContext call.
 */
export interface OptimizeContextOptions {
  /** Conversation ID for summary caching */
  conversationId?: string;
  /** StreamFn for LLM-based summarization (optional) */
  streamFn?: StreamFn;
  /** Model to use for summarization */
  model?: string;
}

/**
 * Stored summary for a conversation.
 */
export interface ConversationSummary {
  conversationId: string;
  summaryText: string;
  /** Number of messages that were summarized */
  messageCount: number;
  /** Estimated tokens of the summary */
  tokenEstimate: number;
  /** Timestamp of when this summary was created */
  createdAt: number;
}

/**
 * Persistence interface for conversation summaries.
 */
export interface SummaryStore {
  get(conversationId: string): Promise<ConversationSummary | null>;
  save(summary: ConversationSummary): Promise<void>;
  delete(conversationId: string): Promise<void>;
}

/**
 * Result of a compression operation.
 */
export interface CompressionResult {
  messages: LLMMessage[];
  /** Whether any compression was applied */
  compressed: boolean;
  /** Estimated token count of the result */
  estimatedTokens: number;
}
