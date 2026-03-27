/**
 * Serializable types for IPC communication.
 * All types here are safe to pass through JSON-RPC / Tauri IPC (no Error
 * objects, no functions, no class instances).
 */

// ---------------------------------------------------------------------------
// Agent events (serializable versions of @agentx/agent AgentEvent)
// ---------------------------------------------------------------------------

export interface SerializableAgentStart {
  type: "agent_start";
  conversationId: string;
  timestamp: number;
}

export interface SerializableAgentEnd {
  type: "agent_end";
  conversationId: string;
  timestamp: number;
  result: {
    turns: number;
    aborted: boolean;
    error?: string;
  };
}

export interface SerializableTurnStart {
  type: "turn_start";
  conversationId: string;
  timestamp: number;
  turn: number;
}

export interface SerializableTurnEnd {
  type: "turn_end";
  conversationId: string;
  timestamp: number;
  turn: number;
  continueLoop: boolean;
}

export interface SerializableMessageStart {
  type: "message_start";
  conversationId: string;
  timestamp: number;
  messageId: string;
}

export interface SerializableMessageDelta {
  type: "message_delta";
  conversationId: string;
  timestamp: number;
  messageId: string;
  delta: string;
}

export interface SerializableMessageEnd {
  type: "message_end";
  conversationId: string;
  timestamp: number;
  messageId: string;
  content: string;
}

export interface SerializableToolStart {
  type: "tool_start";
  conversationId: string;
  timestamp: number;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface SerializableToolUpdate {
  type: "tool_update";
  conversationId: string;
  timestamp: number;
  toolCallId: string;
  update: string;
}

export interface SerializableToolEnd {
  type: "tool_end";
  conversationId: string;
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
  conversationId: string;
  timestamp: number;
  error: string;
  fatal: boolean;
}

export interface SerializableUsage {
  type: "usage";
  conversationId: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

export interface SerializableSubAgentProgress {
  type: "sub_agent_progress";
  conversationId: string;
  timestamp: number;
  batchId: string;
  agents: Array<{
    agentId: string;
    label: string;
    status: "pending" | "running" | "completed" | "error" | "cancelled";
    currentTurn: number;
    maxTurns: number;
    activeTool?: string;
    lastMessage?: string;
  }>;
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
  | SerializableToolApprovalRequest
  | SerializableUsage
  | SerializableSubAgentProgress;

// ---------------------------------------------------------------------------
// Session status
// ---------------------------------------------------------------------------

export type SessionStatus = "running" | "awaiting_approval" | "completed" | "aborted" | "error";

export interface SessionStatusInfo {
  conversationId: string;
  status: SessionStatus;
  startedAt: number;
  eventCount: number;
  pendingApproval?: SerializableToolApprovalRequest;
}

// ---------------------------------------------------------------------------
// Conversation data
// ---------------------------------------------------------------------------

export interface ConversationData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /** Per-conversation system prompt override (empty = use global default) */
  systemPrompt?: string;
  /** Skill IDs enabled for this conversation */
  enabledSkills?: string[];
  /** Folder this conversation belongs to (undefined = ungrouped) */
  folderId?: string;
  /** Whether this conversation is favorited/starred */
  isFavorite?: boolean;
  /** Tracks which child is selected at each fork point (parentId → childId) */
  activeBranches?: Record<string, string>;
  /** Origin of this conversation (e.g. "telegram", "wechat") — set for channel-created conversations */
  source?: string;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

export interface MessageData {
  id?: string;
  parentId?: string;
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
  /** Image attachments — base64 stored in separate files, references stored here */
  images?: Array<{ path: string; mimeType: string }>;
}

/**
 * Branch info for a single fork point.
 * `siblings` = all child message IDs at that fork, `activeIndex` = which is selected.
 */
export type BranchInfo = Record<string, { siblings: string[]; activeIndex: number }>;

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

export interface ProviderConfig {
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
  /** Whether MCP tool calls are allowed */
  mcpCall: boolean;
  /** If non-empty, file tools are restricted to these directories */
  allowedPaths: string[];
}

export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  approvalMode: "smart",
  fileRead: true,
  fileWrite: true,
  shellExecute: true,
  mcpCall: true,
  allowedPaths: [],
};

/** Maps tool names to their permission category */
export function getToolPermissionCategory(
  toolName: string,
): "fileRead" | "fileWrite" | "shellExecute" | "mcpCall" | "none" {
  if (toolName.startsWith("mcp_")) return "mcpCall";
  switch (toolName) {
    case "file_read":
    case "grep":
    case "glob":
    case "list_directory":
      return "fileRead";
    case "file_create":
    case "file_rewrite":
      return "fileWrite";
    case "shell_run":
    case "manage_scheduled_task":
    case "screen_capture":
      return "shellExecute";
    case "sub_agent":
    case "orchestrate_sub_agents":
      return "none";
    default:
      return "none";
  }
}

/** Returns true if a tool is considered a "write" or "execute" operation (used by smart mode) */
export function isWriteOrExecuteTool(toolName: string): boolean {
  const category = getToolPermissionCategory(toolName);
  return category === "fileWrite" || category === "shellExecute" || category === "mcpCall";
}

// ---------------------------------------------------------------------------
// Tool Approval Events
// ---------------------------------------------------------------------------

export interface SerializableToolApprovalRequest {
  type: "tool_approval_request";
  conversationId: string;
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
// Skills
// ---------------------------------------------------------------------------

export interface SkillDefinition {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  voteCount: number;
}

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  type: "file" | "text";
  filePath?: string;
  content?: string;
  enabled: boolean;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// MCP Server config & state
// ---------------------------------------------------------------------------

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
}

export type MCPConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface MCPServerState {
  id: string;
  name: string;
  status: MCPConnectionStatus;
  toolCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Scheduled Tasks (re-exported from scheduler module)
// ---------------------------------------------------------------------------

export type {
  ScheduledTask,
  ScheduledTaskSchedule,
  ScheduledTaskAction,
  ScheduledTaskStatusUpdate,
} from "./scheduler/types.js";

// ---------------------------------------------------------------------------
// Runtime config
// ---------------------------------------------------------------------------

export interface AgentRuntimeConfig {
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
