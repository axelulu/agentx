// Core
export { ContextManager } from "./context-manager.js";

// Compression utilities
export { compressToolResults } from "./compression/tool-result-compressor.js";
export { deduplicateFileReads } from "./compression/file-dedup-compressor.js";
export { relevanceCompress } from "./compression/relevance-compressor.js";
export { gradientCompress } from "./compression/gradient-compressor.js";
export {
  summarizeHistory,
  prependSummary,
  estimateSummaryTokens,
} from "./compression/history-summarizer.js";

// Storage
export { InMemorySummaryStore } from "./storage/in-memory-store.js";

// Middleware
export { createContextMiddleware } from "./middleware/context-middleware.js";

// Token estimation
export { estimateTokens, estimateMessagesTokens } from "./utils/token-estimator.js";

// Types
export type {
  // LLM wire-level types
  LLMMessage,
  LLMSystemMessage,
  LLMUserMessage,
  LLMAssistantMessage,
  LLMToolMessage,
  LLMToolDefinition,
  // Stream types
  LLMStreamChunk,
  ContentDeltaChunk,
  ToolCallDeltaChunk,
  UsageChunk,
  DoneChunk,
  StreamFn,
  StreamFnOptions,
  // Middleware base types
  Middleware,
  MiddlewareContext,
  MiddlewareConfig,
  // Context config types
  ContextConfig,
  OptimizeContextOptions,
  ConversationSummary,
  SummaryStore,
  CompressionResult,
} from "./types.js";

export type { ToolResultCompressionConfig } from "./compression/tool-result-compressor.js";
export type { RelevanceCompressorConfig } from "./compression/relevance-compressor.js";
