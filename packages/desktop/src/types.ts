/**
 * Serializable types for IPC communication.
 * All types here are safe to pass through Electron IPC (no Error objects,
 * no functions, no class instances).
 */

// ---------------------------------------------------------------------------
// Agent events (serializable versions of @workspace/agent AgentEvent)
// ---------------------------------------------------------------------------

export interface SerializableAgentStart {
  type: "agent_start";
  timestamp: number;
}

export interface SerializableAgentEnd {
  type: "agent_end";
  timestamp: number;
  result: {
    turns: number;
    aborted: boolean;
    error?: string;
  };
}

export interface SerializableTurnStart {
  type: "turn_start";
  timestamp: number;
  turn: number;
}

export interface SerializableTurnEnd {
  type: "turn_end";
  timestamp: number;
  turn: number;
  continueLoop: boolean;
}

export interface SerializableMessageStart {
  type: "message_start";
  timestamp: number;
  messageId: string;
}

export interface SerializableMessageDelta {
  type: "message_delta";
  timestamp: number;
  messageId: string;
  delta: string;
}

export interface SerializableMessageEnd {
  type: "message_end";
  timestamp: number;
  messageId: string;
  content: string;
}

export interface SerializableToolStart {
  type: "tool_start";
  timestamp: number;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface SerializableToolUpdate {
  type: "tool_update";
  timestamp: number;
  toolCallId: string;
  update: string;
}

export interface SerializableToolEnd {
  type: "tool_end";
  timestamp: number;
  toolCallId: string;
  toolName: string;
  result: {
    content: string;
    isError?: boolean;
  };
}

export interface SerializableError {
  type: "error";
  timestamp: number;
  error: string;
  fatal: boolean;
}

export type SerializableAgentEvent =
  | SerializableAgentStart
  | SerializableAgentEnd
  | SerializableTurnStart
  | SerializableTurnEnd
  | SerializableMessageStart
  | SerializableMessageDelta
  | SerializableMessageEnd
  | SerializableToolStart
  | SerializableToolUpdate
  | SerializableToolEnd
  | SerializableError;

// ---------------------------------------------------------------------------
// Conversation data
// ---------------------------------------------------------------------------

export interface ConversationData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface MessageData {
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
  isError?: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

export interface DesktopProviderConfig {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "gemini" | "custom";
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime config
// ---------------------------------------------------------------------------

export interface DesktopRuntimeConfig {
  /** Path to toolkit YAML files */
  toolkitPath: string;
  /** Language for toolkit prompts */
  language: string;
  /** Workspace root for file/shell tools */
  workspacePath: string;
  /** Data directory for conversation persistence */
  dataPath: string;
  /** Capabilities to enable (defaults to all available) */
  capabilities?: string[];
}
