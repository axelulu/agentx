// Main facade
export { DesktopRuntime } from "./runtime.js";

// Sub-managers (for advanced usage / testing)
export { ProviderManager } from "./providers/provider-manager.js";
export { ConversationManager } from "./conversations/conversation-manager.js";
export { JsonFileStore } from "./conversations/json-file-store.js";
export { SessionRunner } from "./sessions/session-runner.js";
export { toSerializableEvent } from "./sessions/event-bridge.js";

// Provider adapters
export { createOpenAIStreamFn } from "./providers/adapters/openai-adapter.js";
export { createAnthropicStreamFn } from "./providers/adapters/anthropic-adapter.js";

// MCP
export { MCPClientManager } from "./mcp/index.js";

// Skills API
export { searchSkills, getSkill } from "./skills/skill-api.js";

// Types
export type {
  SerializableAgentEvent,
  SerializableToolApprovalRequest,
  ConversationData,
  MessageData,
  DesktopProviderConfig,
  DesktopRuntimeConfig,
  KnowledgeBaseItem,
  SkillDefinition,
  ToolPermissions,
  ToolApprovalMode,
  SessionStatusInfo,
  SessionStatus,
  Folder,
  MCPServerConfig,
  MCPServerState,
  MCPConnectionStatus,
  BranchInfo,
} from "./types.js";

export {
  DEFAULT_TOOL_PERMISSIONS,
  getToolPermissionCategory,
  isWriteOrExecuteTool,
} from "./types.js";

export type { ConversationStore } from "./conversations/conversation-store.js";

export type { MainToRendererChannels, RendererToMainChannels, IpcChannel } from "./ipc/contract.js";
