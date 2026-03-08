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
  | SerializableError
  | SerializableToolApprovalRequest;

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
// Tool Permissions
// ---------------------------------------------------------------------------

export type ToolApprovalMode = "auto" | "always-ask" | "smart";

export interface ToolPermissions {
  /** How tool execution is approved: auto (no ask), always-ask (ask for every tool), smart (auto for reads, ask for writes/exec) */
  approvalMode: ToolApprovalMode;
  /** Whether file_read is allowed */
  fileRead: boolean;
  /** Whether file_create / file_rewrite are allowed */
  fileWrite: boolean;
  /** Whether shell_run is allowed */
  shellExecute: boolean;
  /** If non-empty, file tools are restricted to these directories */
  allowedPaths: string[];
}

export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  approvalMode: "smart",
  fileRead: true,
  fileWrite: true,
  shellExecute: true,
  allowedPaths: [],
};

/** Maps tool names to their permission category */
export function getToolPermissionCategory(
  toolName: string,
): "fileRead" | "fileWrite" | "shellExecute" | "none" {
  switch (toolName) {
    case "file_read":
      return "fileRead";
    case "file_create":
    case "file_rewrite":
      return "fileWrite";
    case "shell_run":
      return "shellExecute";
    default:
      return "none";
  }
}

/** Returns true if a tool is considered a "write" or "execute" operation (used by smart mode) */
export function isWriteOrExecuteTool(toolName: string): boolean {
  const category = getToolPermissionCategory(toolName);
  return category === "fileWrite" || category === "shellExecute";
}

// ---------------------------------------------------------------------------
// Tool Approval Events
// ---------------------------------------------------------------------------

export interface SerializableToolApprovalRequest {
  type: "tool_approval_request";
  timestamp: number;
  approvalId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface SerializableToolApprovalResponse {
  type: "tool_approval_response";
  timestamp: number;
  approvalId: string;
  approved: boolean;
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
