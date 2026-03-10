// Core
export { Agent } from "./agent.js";
export { agentLoop } from "./agent-loop.js";
export { EventStream } from "./event-stream.js";

// Tool execution
export { executeTools } from "./tool-executor.js";

// Providers
export { createOpenAIProvider } from "./providers/openai.js";
export { convertToLlmMessages, convertToolsToLlm } from "./providers/message-builder.js";

// Middleware
export { createMiddleware, composeMiddleware } from "./middleware.js";

// Types (own)
export type {
  // Messages
  AgentMessage,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  ContentPart,
  TextContent,
  ImageContent,
  // Tools
  AgentTool,
  AgentToolResult,
  ToolCall,
  ToolExecutionContext,
  // Events
  AgentEvent,
  AgentStartEvent,
  AgentEndEvent,
  TurnStartEvent,
  TurnEndEvent,
  MessageStartEvent,
  MessageDeltaEvent,
  MessageEndEvent,
  ToolStartEvent,
  ToolUpdateEvent,
  ToolEndEvent,
  ErrorEvent,
  // Result
  AgentResult,
  // LLM (re-exported from context)
  LLMMessage,
  LLMSystemMessage,
  LLMUserMessage,
  LLMAssistantMessage,
  LLMToolMessage,
  LLMToolDefinition,
  LLMStreamChunk,
  ContentDeltaChunk,
  ToolCallDeltaChunk,
  UsageChunk,
  DoneChunk,
  StreamFn,
  StreamFnOptions,
  // Config
  AgentConfig,
  AgentState,
  // Middleware
  AgentMiddleware,
  MiddlewareContext,
} from "./types.js";

// Provider types
export type { ProviderConfig } from "./providers/types.js";

// ---------------------------------------------------------------------------
// Re-exports from @workspace/context (so desktop only needs @workspace/agent)
// ---------------------------------------------------------------------------
export {
  ContextManager,
  createContextMiddleware,
  compressToolResults,
  gradientCompress,
  summarizeHistory,
  prependSummary,
  estimateSummaryTokens,
  InMemorySummaryStore,
  estimateTokens,
  estimateMessagesTokens,
} from "@workspace/context";

export type {
  Middleware,
  ContextConfig,
  OptimizeContextOptions,
  ConversationSummary,
  SummaryStore,
  CompressionResult,
  ToolResultCompressionConfig,
} from "@workspace/context";

// ---------------------------------------------------------------------------
// Re-exports from @workspace/toolkit (so desktop only needs @workspace/agent)
// ---------------------------------------------------------------------------
export {
  Toolkit,
  PromptService,
  PromptCompiler,
  ToolService,
  CapabilityRegistry,
  createDesktopHandlers,
  createFileToolHandlers,
  createSearchToolHandlers,
  createShellToolHandlers,
  replaceVariables,
  replaceVariablesInObject,
  mergeVariables,
  sanitizePath,
  isPathWithinWorkspace,
  isConditionalSection,
  isTaggedSection,
  isListSection,
} from "@workspace/toolkit";

export type {
  BuiltTool,
  ToolkitInit,
  ToolkitLogger,
  ToolInputSchema,
  ToolType,
  ToolDefinition,
  ToolDefinitionsFile,
  ToolHandler,
  ToolHandlerOptions,
  NamedToolHandler,
  VariableDefinition,
  VariableDefinitions,
  SectionContent,
  ConditionalSection,
  TaggedSection,
  ListSection,
  PromptTemplate,
  CompiledPrompt,
  CapabilityEntry,
} from "@workspace/toolkit";
