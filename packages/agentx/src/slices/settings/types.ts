/**
 * Settings domain types — mirrors runtime types for the frontend.
 */

export interface ProviderConfig {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "gemini" | "custom";
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  isActive?: boolean;
}

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  type: "file" | "text";
  filePath?: string;
  content?: string;
  enabled: boolean;
  createdAt: number;
}

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

export interface ChannelConfig {
  id: string;
  type: "telegram" | "discord";
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface VoiceSettings {
  sttApiUrl: string;
  sttApiKey: string;
  sttLanguage: string;
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  autoReadReplies: boolean;
}

export type ToolApprovalMode = "auto" | "always-ask" | "smart";

export interface ToolPermissionsState {
  approvalMode: ToolApprovalMode;
  fileRead: boolean;
  fileWrite: boolean;
  shellExecute: boolean;
  mcpCall: boolean;
  allowedPaths: string[];
}

export interface SkillDefinition {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  voteCount: number;
  /** True for user-created skills (not from the Skill Store) */
  isCustom?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

export interface ConversationOrder {
  favorites: string[];
  ungrouped: string[];
  folders: Record<string, string[]>;
}

export type AccentColor = "cyan" | "blue" | "violet" | "rose" | "orange" | "green" | "teal";
export type FontSize = "small" | "default" | "large";
export type LayoutDensity = "compact" | "comfortable" | "spacious";

export interface SettingsState {
  theme: "light" | "dark" | "system";
  accentColor: AccentColor;
  fontSize: FontSize;
  layoutDensity: LayoutDensity;
  language: string;
  proxyUrl: string;
  workspacePath: string;
  dataPath: string;
  globalSystemPrompt: string;
  providers: ProviderConfig[];
  knowledgeBase: KnowledgeBaseItem[];
  mcpServers: MCPServerConfig[];
  channels: ChannelConfig[];
  scheduledTasks: ScheduledTaskConfig[];
  toolPermissions: ToolPermissionsState;
  voice: VoiceSettings;
  installedSkills: SkillDefinition[];
  folders: Folder[];
  conversationOrder: ConversationOrder;
  /** Set by createFolder so the UI can auto-enter edit mode for exactly that folder */
  lastCreatedFolderId: string | null;
}

export type PrefsPayload = {
  theme?: string;
  accentColor?: string;
  fontSize?: string;
  layoutDensity?: string;
  language?: string;
  sidebarOpen?: boolean;
  proxyUrl?: string;
  workspacePath?: string;
  dataPath?: string;
  globalSystemPrompt?: string;
  voice?: VoiceSettings;
  folders?: Folder[];
  conversationOrder?: ConversationOrder;
};
