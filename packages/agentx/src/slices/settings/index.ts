/**
 * Settings module — re-exports types and persistence utilities.
 *
 * The settingsSlice itself remains at ../settingsSlice.ts for backwards
 * compatibility (all existing imports continue to work).
 */

// Types
export type {
  ProviderConfig,
  KnowledgeBaseItem,
  MCPServerConfig,
  ChannelConfig,
  VoiceSettings,
  ToolApprovalMode,
  ToolPermissionsState,
  SkillDefinition,
  Folder,
  ConversationOrder,
  AccentColor,
  FontSize,
  LayoutDensity,
  SettingsState,
  PrefsPayload,
} from "./types";

// Persistence utilities
export {
  LS_PROVIDERS,
  LS_PREFERENCES,
  LS_KB,
  LS_MCP,
  LS_SKILLS,
  LS_CHANNELS,
  LS_SCHEDULED,
  LS_TOOL_PERMS,
  lsGet,
  lsSet,
  lsUpsert,
  lsRemove,
  withRetry,
  persistPreferences,
  persistKBItem,
  persistKBRemove,
  persistMCPServer,
  persistMCPRemove,
  persistProvider,
  persistProviderRemove,
  persistProviderSetActive,
  persistSkillInstall,
  persistSkillUninstall,
  persistChannel,
  persistChannelRemove,
  persistScheduledTask,
  persistScheduledTaskRemove,
  persistToolPermissions,
} from "./persistence";
