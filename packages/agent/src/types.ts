// Re-export base types from @agentx/context
export type {
  LLMSystemMessage,
  LLMUserMessage,
  LLMAssistantMessage,
  LLMToolMessage,
  LLMMessage,
  LLMToolDefinition,
  ContentDeltaChunk,
  ToolCallDeltaChunk,
  UsageChunk,
  DoneChunk,
  LLMStreamChunk,
  StreamFnOptions,
  StreamFn,
  MiddlewareContext,
} from "@agentx/context";

import type { Middleware, MiddlewareContext, StreamFn, LLMMessage } from "@agentx/context";

// Re-export tool types from @agentx/toolkit
export type { ToolExecutionContext, AgentToolResult } from "@agentx/toolkit";

import type { BuiltTool, AgentToolResult } from "@agentx/toolkit";

/**
 * AgentTool — alias for toolkit's BuiltTool.
 * Kept for backwards compatibility in consumer code.
 */
export type AgentTool = BuiltTool;

// ---------------------------------------------------------------------------
// Message types (application layer)
// ---------------------------------------------------------------------------

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType?: string;
}

export type ContentPart = TextContent | ImageContent;

export interface UserMessage {
  role: "user";
  content: string | ContentPart[];
}

export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;
  content: string;
  isError?: boolean;
  /** Image results from tool execution — sent as vision content to the model */
  images?: Array<{ data: string; mimeType: string }>;
}

export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;

// ---------------------------------------------------------------------------
// Tool call (application layer — parsed JSON)
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Event types (discriminated union)
// ---------------------------------------------------------------------------

interface BaseEvent {
  timestamp: number;
}

export interface AgentStartEvent extends BaseEvent {
  type: "agent_start";
}
export interface AgentEndEvent extends BaseEvent {
  type: "agent_end";
  result: AgentResult;
}
export interface TurnStartEvent extends BaseEvent {
  type: "turn_start";
  turn: number;
}
export interface TurnEndEvent extends BaseEvent {
  type: "turn_end";
  turn: number;
  continueLoop: boolean;
}
export interface MessageStartEvent extends BaseEvent {
  type: "message_start";
  messageId: string;
}
export interface MessageDeltaEvent extends BaseEvent {
  type: "message_delta";
  messageId: string;
  delta: string;
  /** Byte offset into the accumulated content where this delta starts.
   *  Used by the frontend to skip already-applied deltas on event replay. */
  offset?: number;
}
export interface MessageEndEvent extends BaseEvent {
  type: "message_end";
  messageId: string;
  content: string;
}
export interface ToolStartEvent extends BaseEvent {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}
export interface ToolUpdateEvent extends BaseEvent {
  type: "tool_update";
  toolCallId: string;
  update: string;
}
export interface ToolEndEvent extends BaseEvent {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  result: AgentToolResult;
}
export interface ErrorEvent extends BaseEvent {
  type: "error";
  error: Error;
  fatal: boolean;
}
export interface UsageEvent extends BaseEvent {
  type: "usage";
  inputTokens: number;
  outputTokens: number;
}

export type AgentEvent =
  | AgentStartEvent
  | AgentEndEvent
  | TurnStartEvent
  | TurnEndEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageEndEvent
  | ToolStartEvent
  | ToolUpdateEvent
  | ToolEndEvent
  | ErrorEvent
  | UsageEvent;

// ---------------------------------------------------------------------------
// Agent result
// ---------------------------------------------------------------------------

export interface AgentResult {
  messages: AgentMessage[];
  turns: number;
  aborted: boolean;
  error?: Error;
}

// ---------------------------------------------------------------------------
// Middleware (extends base Middleware from context)
// ---------------------------------------------------------------------------

export interface AgentMiddleware extends Middleware {
  afterModelCall?: (
    ctx: MiddlewareContext & { response: AssistantMessage },
  ) => Promise<boolean | void>;
  beforeToolExecution?: (
    ctx: MiddlewareContext & { toolCall: ToolCall },
  ) => Promise<Record<string, unknown> | void>;
  afterToolExecution?: (
    ctx: MiddlewareContext & { toolCall: ToolCall; result: AgentToolResult },
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: AgentTool[];
  streamFn?: StreamFn;
  getApiKey?: () => string | Promise<string>;
  baseUrl?: string;
  convertToLlm?: (messages: AgentMessage[]) => LLMMessage[];
  transformContext?: (messages: LLMMessage[]) => LLMMessage[] | Promise<LLMMessage[]>;
  middleware?: AgentMiddleware[];
  maxTurns?: number; // default: 50
  maxTokens?: number; // default: 8192
  temperature?: number; // default: 0.7
  toolChoice?: "auto" | "required" | "none";
  /** Max retries for retryable LLM errors (429/5xx/network). Default: 3 */
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Agent state (read-only snapshot)
// ---------------------------------------------------------------------------

export interface AgentState {
  messages: readonly AgentMessage[];
  isRunning: boolean;
  currentTurn: number;
}
