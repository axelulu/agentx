// Main facade
export { AgentRuntime } from "./runtime.js";
/** @deprecated Use AgentRuntime */
export { AgentRuntime as DesktopRuntime } from "./runtime.js";

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

// Scheduler
export { ScheduledTaskManager } from "./scheduler/index.js";

// Sub-agent orchestration
export { SubAgentOrchestrator, Blackboard } from "./sub-agent/index.js";
export type {
  SubAgentTask,
  SubAgentResult,
  SubAgentStatus,
  SubAgentProgressEvent,
  SubAgentProgressEntry,
  OrchestratedResult,
} from "./sub-agent/index.js";

// Channels
export { ChannelManager } from "./channels/index.js";
export type { ChannelConfig, ChannelState, ChannelType, ChannelStatus } from "./channels/index.js";

// Memory
export { MemoryManager } from "./memory/index.js";
export type {
  ConversationSummary,
  LearnedFact,
  MemoryConfig,
  MemoryExtraction,
} from "./memory/index.js";
export { DEFAULT_MEMORY_CONFIG } from "./memory/index.js";

// Types
export type {
  SerializableAgentEvent,
  SerializableToolApprovalRequest,
  ConversationData,
  MessageData,
  ProviderConfig,
  AgentRuntimeConfig,
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
  ScheduledTask,
  ScheduledTaskSchedule,
  ScheduledTaskAction,
  ScheduledTaskStatusUpdate,
} from "./types.js";

/** @deprecated Use ProviderConfig */
export type { ProviderConfig as DesktopProviderConfig } from "./types.js";
/** @deprecated Use AgentRuntimeConfig */
export type { AgentRuntimeConfig as DesktopRuntimeConfig } from "./types.js";

export {
  DEFAULT_TOOL_PERMISSIONS,
  getToolPermissionCategory,
  isWriteOrExecuteTool,
} from "./types.js";

export type { ConversationStore } from "./conversations/conversation-store.js";

export type { MainToRendererChannels, RendererToMainChannels, IpcChannel } from "./ipc/contract.js";
