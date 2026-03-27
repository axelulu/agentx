import { createSlice, createAsyncThunk, type PayloadAction, current } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types (mirrors ProviderConfig from @agentx/runtime)
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

// ---------------------------------------------------------------------------
// Async thunks — load only (read from main process)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Preferences (theme, language, sidebar — disk-persisted via main process)
// ---------------------------------------------------------------------------

export const loadPreferences = createAsyncThunk("settings/loadPreferences", async () => {
  const prefs = await window.api.preferences.get();
  return prefs as {
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
});

export const loadProviders = createAsyncThunk("settings/loadProviders", async () => {
  const configs = await window.api.provider.list();
  return configs as ProviderConfig[];
});

export const saveProvider = createAsyncThunk(
  "settings/saveProvider",
  async (config: ProviderConfig) => {
    await window.api.provider.set(config);
    return config;
  },
);

export const removeProvider = createAsyncThunk("settings/removeProvider", async (id: string) => {
  window.api.provider.remove(id);
  return id;
});

export const setActiveProvider = createAsyncThunk(
  "settings/setActiveProvider",
  async (id: string) => {
    window.api.provider.setActive(id);
    return id;
  },
);

export const loadKnowledgeBase = createAsyncThunk("settings/loadKnowledgeBase", async () => {
  const items = await window.api.knowledgeBase.list();
  return items as KnowledgeBaseItem[];
});

export const loadMCPServers = createAsyncThunk("settings/loadMCPServers", async () => {
  const configs = await window.api.mcp.list();
  return configs as MCPServerConfig[];
});

export const loadInstalledSkills = createAsyncThunk("settings/loadInstalledSkills", async () => {
  const skills = await window.api.skills.listInstalled();
  return skills as SkillDefinition[];
});

export const searchSkillStore = createAsyncThunk(
  "settings/searchSkillStore",
  async ({ query, category }: { query: string; category?: string }) => {
    const result = await window.api.skills.search(query, category, 30);
    return result.skills as SkillDefinition[];
  },
);

export const loadChannels = createAsyncThunk("settings/loadChannels", async () => {
  const configs = await window.api.channel.list();
  return configs as ChannelConfig[];
});

export const loadScheduledTasks = createAsyncThunk("settings/loadScheduledTasks", async () => {
  const tasks = await window.api.scheduler.list();
  return tasks as ScheduledTaskConfig[];
});

export const resetAllSettings = createAsyncThunk(
  "settings/resetAllSettings",
  async (_, { getState }) => {
    const state = (getState() as { settings: SettingsState }).settings;

    // Clear persisted preferences
    await window.api.preferences.set({
      theme: "system",
      accentColor: "cyan",
      fontSize: "default",
      layoutDensity: "comfortable",
      language: "en",
      proxyUrl: "",
      workspacePath: "",
      dataPath: "",
      globalSystemPrompt: "",
      voice: {
        sttApiUrl: "",
        sttApiKey: "",
        sttLanguage: "",
        ttsVoice: "",
        ttsRate: 1.0,
        ttsPitch: 1.0,
        autoReadReplies: false,
      },
      folders: [],
      conversationOrder: { favorites: [], ungrouped: [], folders: {} },
      notifications: { enabled: true, scheduledTasks: true, agentCompletion: true },
    });

    // Remove all providers
    for (const p of state.providers) {
      try {
        window.api.provider.remove(p.id);
      } catch {}
    }
    // Remove all KB items
    for (const k of state.knowledgeBase) {
      try {
        window.api.knowledgeBase.remove(k.id);
      } catch {}
    }
    // Remove all MCP servers
    for (const m of state.mcpServers) {
      try {
        window.api.mcp.remove(m.id);
      } catch {}
    }
    // Remove all scheduled tasks
    for (const t of state.scheduledTasks) {
      try {
        window.api.scheduler.remove(t.id);
      } catch {}
    }
    // Remove all installed skills
    for (const s of state.installedSkills) {
      try {
        await window.api.skills.uninstall(s.id);
      } catch {}
    }
    // Reset tool permissions
    const defaultPerms: ToolPermissionsState = {
      approvalMode: "smart",
      fileRead: true,
      fileWrite: true,
      shellExecute: true,
      mcpCall: true,
      allowedPaths: [],
    };
    await window.api.toolPermissions.set(defaultPerms);

    // Clear localStorage
    localStorage.removeItem("agentx-theme");
    localStorage.removeItem("agentx-accent-color");
    localStorage.removeItem("agentx-font-size");
    localStorage.removeItem("agentx-layout-density");
    localStorage.removeItem("agentx-language");
  },
);

export const loadToolPermissions = createAsyncThunk("settings/loadToolPermissions", async () => {
  const perms = await window.api.toolPermissions.get();
  return perms as ToolPermissionsState;
});

export const saveToolPermissions = createAsyncThunk(
  "settings/saveToolPermissions",
  async (permissions: ToolPermissionsState) => {
    await window.api.toolPermissions.set(permissions);
    return permissions;
  },
);

// ---------------------------------------------------------------------------
// IPC persistence helpers (fire-and-forget, errors logged)
// ---------------------------------------------------------------------------

function persistPreferences(prefs: Record<string, unknown>): void {
  try {
    window.api.preferences.set(prefs).catch((err: unknown) => {
      console.error("[Preferences] Failed to persist:", err);
    });
  } catch (err) {
    console.error("[Preferences] Failed to serialize:", err);
  }
}

function persistKBItem(item: KnowledgeBaseItem): void {
  window.api.knowledgeBase.set(item).catch((err: unknown) => {
    console.error("[KB] Failed to persist item:", err);
  });
}

function persistKBRemove(id: string): void {
  try {
    window.api.knowledgeBase.remove(id);
  } catch (err) {
    console.error("[KB] Failed to remove item:", err);
  }
}

function persistMCPServer(config: MCPServerConfig): void {
  window.api.mcp.set(config).catch((err: unknown) => {
    console.error("[MCP] Failed to persist server:", err);
  });
}

function persistMCPRemove(id: string): void {
  try {
    window.api.mcp.remove(id);
  } catch (err) {
    console.error("[MCP] Failed to remove server:", err);
  }
}

function persistProvider(config: ProviderConfig): void {
  window.api.provider.set(config).catch((err: unknown) => {
    console.error("[Provider] Failed to persist provider:", err);
  });
}

function persistProviderRemove(id: string): void {
  try {
    window.api.provider.remove(id);
  } catch (err) {
    console.error("[Provider] Failed to remove provider:", err);
  }
}

function persistProviderSetActive(id: string): void {
  try {
    window.api.provider.setActive(id);
  } catch (err) {
    console.error("[Provider] Failed to set active provider:", err);
  }
}

function persistSkillInstall(skill: SkillDefinition): void {
  window.api.skills.install(skill).catch((err: unknown) => {
    console.error("[Skills] Failed to install:", err);
  });
}

function persistSkillUninstall(id: string): void {
  window.api.skills.uninstall(id).catch((err: unknown) => {
    console.error("[Skills] Failed to uninstall:", err);
  });
}

function persistChannel(config: ChannelConfig): void {
  window.api.channel.set(config as ChannelConfigData).catch((err: unknown) => {
    console.error("[Channel] Failed to persist:", err);
  });
}

function persistChannelRemove(id: string): void {
  window.api.channel.remove(id).catch((err: unknown) => {
    console.error("[Channel] Failed to remove:", err);
  });
}

function persistScheduledTask(task: ScheduledTaskConfig): void {
  window.api.scheduler.set(task).catch((err: unknown) => {
    console.error("[Scheduler] Failed to persist task:", err);
  });
}

function persistScheduledTaskRemove(id: string): void {
  try {
    window.api.scheduler.remove(id);
  } catch (err) {
    console.error("[Scheduler] Failed to remove task:", err);
  }
}

function persistToolPermissions(perms: ToolPermissionsState): void {
  window.api.toolPermissions.set(perms).catch((err: unknown) => {
    console.error("[ToolPermissions] Failed to persist:", err);
  });
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const initialState: SettingsState = {
  theme: (localStorage.getItem("agentx-theme") as SettingsState["theme"]) || "system",
  accentColor: (localStorage.getItem("agentx-accent-color") as AccentColor) || "cyan",
  fontSize: (localStorage.getItem("agentx-font-size") as FontSize) || "default",
  layoutDensity: (localStorage.getItem("agentx-layout-density") as LayoutDensity) || "comfortable",
  language: localStorage.getItem("agentx-language") || "en",
  proxyUrl: "",
  workspacePath: "",
  dataPath: "",
  globalSystemPrompt: "",
  providers: [],
  knowledgeBase: [],
  mcpServers: [],
  channels: [],
  scheduledTasks: [],
  toolPermissions: {
    approvalMode: "smart",
    fileRead: true,
    fileWrite: true,
    shellExecute: true,
    mcpCall: true,
    allowedPaths: [],
  },
  voice: {
    sttApiUrl: "",
    sttApiKey: "",
    sttLanguage: "",
    ttsVoice: "",
    ttsRate: 1.0,
    ttsPitch: 1.0,
    autoReadReplies: false,
  },
  installedSkills: [],
  folders: [],
  conversationOrder: { favorites: [], ungrouped: [], folders: {} },
  lastCreatedFolderId: null,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<"light" | "dark" | "system">) {
      state.theme = action.payload;
      localStorage.setItem("agentx-theme", action.payload);
      persistPreferences({ theme: action.payload });
    },
    setAccentColor(state, action: PayloadAction<AccentColor>) {
      state.accentColor = action.payload;
      localStorage.setItem("agentx-accent-color", action.payload);
      persistPreferences({ accentColor: action.payload });
    },
    setFontSize(state, action: PayloadAction<FontSize>) {
      state.fontSize = action.payload;
      localStorage.setItem("agentx-font-size", action.payload);
      persistPreferences({ fontSize: action.payload });
    },
    setLayoutDensity(state, action: PayloadAction<LayoutDensity>) {
      state.layoutDensity = action.payload;
      localStorage.setItem("agentx-layout-density", action.payload);
      persistPreferences({ layoutDensity: action.payload });
    },
    setLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
      localStorage.setItem("agentx-language", action.payload);
      persistPreferences({ language: action.payload });
    },
    setProxyUrl(state, action: PayloadAction<string>) {
      state.proxyUrl = action.payload;
      persistPreferences({ proxyUrl: action.payload });
    },
    setWorkspacePath(state, action: PayloadAction<string>) {
      state.workspacePath = action.payload;
      persistPreferences({ workspacePath: action.payload });
    },
    setDataPath(state, action: PayloadAction<string>) {
      state.dataPath = action.payload;
      persistPreferences({ dataPath: action.payload });
    },
    setGlobalSystemPrompt(state, action: PayloadAction<string>) {
      state.globalSystemPrompt = action.payload;
      persistPreferences({ globalSystemPrompt: action.payload });
    },

    // Knowledge Base — synchronous reducers for instant UI updates
    upsertKBItem(state, action: PayloadAction<KnowledgeBaseItem>) {
      const item = action.payload;
      const idx = state.knowledgeBase.findIndex((k) => k.id === item.id);
      if (idx >= 0) {
        state.knowledgeBase[idx] = item;
      } else {
        state.knowledgeBase.push(item);
      }
      persistKBItem(item);
    },
    deleteKBItem(state, action: PayloadAction<string>) {
      state.knowledgeBase = state.knowledgeBase.filter((k) => k.id !== action.payload);
      persistKBRemove(action.payload);
    },

    // MCP Servers — synchronous reducers for instant UI updates
    upsertMCPServer(state, action: PayloadAction<MCPServerConfig>) {
      const config = action.payload;
      const idx = state.mcpServers.findIndex((m) => m.id === config.id);
      if (idx >= 0) {
        state.mcpServers[idx] = config;
      } else {
        state.mcpServers.push(config);
      }
      persistMCPServer(config);
    },
    deleteMCPServer(state, action: PayloadAction<string>) {
      state.mcpServers = state.mcpServers.filter((m) => m.id !== action.payload);
      persistMCPRemove(action.payload);
    },

    // Channels — synchronous reducers for instant UI updates
    upsertChannel(state, action: PayloadAction<ChannelConfig>) {
      const config = action.payload;
      const idx = state.channels.findIndex((c) => c.id === config.id);
      if (idx >= 0) {
        state.channels[idx] = config;
      } else {
        state.channels.push(config);
      }
      persistChannel(config);
    },
    deleteChannel(state, action: PayloadAction<string>) {
      state.channels = state.channels.filter((c) => c.id !== action.payload);
      persistChannelRemove(action.payload);
    },

    // Providers — synchronous reducers for instant UI updates
    upsertProvider(state, action: PayloadAction<ProviderConfig>) {
      const config = action.payload;
      const idx = state.providers.findIndex((p) => p.id === config.id);
      if (idx >= 0) {
        state.providers[idx] = config;
      } else {
        state.providers.push(config);
      }
      persistProvider(config);
    },
    deleteProvider(state, action: PayloadAction<string>) {
      state.providers = state.providers.filter((p) => p.id !== action.payload);
      persistProviderRemove(action.payload);
    },
    activateProvider(state, action: PayloadAction<string>) {
      for (const p of state.providers) {
        p.isActive = p.id === action.payload;
      }
      persistProviderSetActive(action.payload);
    },

    // Scheduled Tasks — synchronous reducers for instant UI updates
    upsertScheduledTask(state, action: PayloadAction<ScheduledTaskConfig>) {
      const task = action.payload;
      const idx = state.scheduledTasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        state.scheduledTasks[idx] = task;
      } else {
        state.scheduledTasks.push(task);
      }
      persistScheduledTask(task);
    },
    deleteScheduledTask(state, action: PayloadAction<string>) {
      state.scheduledTasks = state.scheduledTasks.filter((t) => t.id !== action.payload);
      persistScheduledTaskRemove(action.payload);
    },
    replaceScheduledTasks(state, action: PayloadAction<ScheduledTaskConfig[]>) {
      state.scheduledTasks = action.payload;
    },

    // Tool Permissions — synchronous reducer for instant UI updates
    updateToolPermissions(state, action: PayloadAction<Partial<ToolPermissionsState>>) {
      state.toolPermissions = { ...state.toolPermissions, ...action.payload };
      persistToolPermissions(state.toolPermissions);
    },

    // Skills — synchronous reducers for instant UI updates
    addInstalledSkill(state, action: PayloadAction<SkillDefinition>) {
      const skill = action.payload;
      const idx = state.installedSkills.findIndex((s) => s.id === skill.id);
      if (idx < 0) {
        state.installedSkills.push(skill);
      }
      persistSkillInstall(skill);
    },
    updateInstalledSkill(state, action: PayloadAction<SkillDefinition>) {
      const skill = action.payload;
      const idx = state.installedSkills.findIndex((s) => s.id === skill.id);
      if (idx >= 0) {
        state.installedSkills[idx] = skill;
      }
      persistSkillInstall(skill);
    },
    removeInstalledSkill(state, action: PayloadAction<string>) {
      state.installedSkills = state.installedSkills.filter((s) => s.id !== action.payload);
      persistSkillUninstall(action.payload);
    },

    // Voice settings — synchronous reducer for instant UI updates
    setVoiceSettings(state, action: PayloadAction<Partial<VoiceSettings>>) {
      state.voice = { ...state.voice, ...action.payload };
      persistPreferences({ voice: current(state.voice) });
    },

    // Folder CRUD — synchronous reducers with fire-and-forget persistence
    // NOTE: must use current() to snapshot Immer drafts before passing through IPC
    createFolder(state, action: PayloadAction<string>) {
      const folder: Folder = {
        id: uuidv4(),
        name: action.payload,
        order: state.folders.length,
      };
      state.folders.push(folder);
      state.lastCreatedFolderId = folder.id;
      persistPreferences({ folders: current(state.folders) });
    },
    clearLastCreatedFolderId(state) {
      state.lastCreatedFolderId = null;
    },
    renameFolder(state, action: PayloadAction<{ id: string; name: string }>) {
      const folder = state.folders.find((f) => f.id === action.payload.id);
      if (folder) {
        folder.name = action.payload.name;
        persistPreferences({ folders: current(state.folders) });
      }
    },
    deleteFolder(state, action: PayloadAction<string>) {
      const folderId = action.payload;
      // Snapshot plain data BEFORE mutations to avoid Immer current() issues
      // with reassigned draft fields containing detached draft proxies.
      const snap = current(state);
      const updatedFolders = snap.folders.filter((f) => f.id !== folderId);
      const updatedOrder = { ...snap.conversationOrder };
      delete updatedOrder.folders[folderId];

      state.folders = updatedFolders;
      state.conversationOrder = updatedOrder;

      persistPreferences({
        folders: updatedFolders,
        conversationOrder: updatedOrder,
      });
    },

    // Conversation ordering — reorder IDs within a section
    reorderConversations(
      state,
      action: PayloadAction<{ section: "favorites" | "ungrouped" | string; orderedIds: string[] }>,
    ) {
      const { section, orderedIds } = action.payload;
      if (section === "favorites") {
        state.conversationOrder.favorites = orderedIds;
      } else if (section === "ungrouped") {
        state.conversationOrder.ungrouped = orderedIds;
      } else {
        state.conversationOrder.folders[section] = orderedIds;
      }
      persistPreferences({ conversationOrder: current(state.conversationOrder) });
    },

    // Folder ordering — update order fields from sorted array
    reorderFolders(state, action: PayloadAction<Folder[]>) {
      // action.payload is already plain data (from arrayMove result)
      const plainFolders = action.payload.map((f) => ({ ...f }));
      state.folders = plainFolders;
      persistPreferences({ folders: plainFolders });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPreferences.fulfilled, (state, action) => {
        const prefs = action.payload;
        if (prefs.theme && ["light", "dark", "system"].includes(prefs.theme)) {
          state.theme = prefs.theme as SettingsState["theme"];
          localStorage.setItem("agentx-theme", prefs.theme);
        }
        if (
          prefs.accentColor &&
          ["cyan", "blue", "violet", "rose", "orange", "green", "teal"].includes(prefs.accentColor)
        ) {
          state.accentColor = prefs.accentColor as AccentColor;
          localStorage.setItem("agentx-accent-color", prefs.accentColor);
        }
        if (prefs.fontSize && ["small", "default", "large"].includes(prefs.fontSize)) {
          state.fontSize = prefs.fontSize as FontSize;
          localStorage.setItem("agentx-font-size", prefs.fontSize);
        }
        if (
          prefs.layoutDensity &&
          ["compact", "comfortable", "spacious"].includes(prefs.layoutDensity)
        ) {
          state.layoutDensity = prefs.layoutDensity as LayoutDensity;
          localStorage.setItem("agentx-layout-density", prefs.layoutDensity);
        }
        if (prefs.language) {
          state.language = prefs.language;
          localStorage.setItem("agentx-language", prefs.language);
        }
        if (typeof prefs.proxyUrl === "string") {
          state.proxyUrl = prefs.proxyUrl;
        }
        if (typeof prefs.workspacePath === "string") {
          state.workspacePath = prefs.workspacePath;
        }
        if (typeof prefs.dataPath === "string") {
          state.dataPath = prefs.dataPath;
        }
        if (typeof prefs.globalSystemPrompt === "string") {
          state.globalSystemPrompt = prefs.globalSystemPrompt;
        }
        if (prefs.voice && typeof prefs.voice === "object") {
          state.voice = { ...state.voice, ...prefs.voice };
        }
        if (Array.isArray(prefs.folders)) {
          state.folders = prefs.folders as Folder[];
        }
        if (prefs.conversationOrder && typeof prefs.conversationOrder === "object") {
          state.conversationOrder = {
            ...state.conversationOrder,
            ...(prefs.conversationOrder as ConversationOrder),
          };
        }
      })
      .addCase(loadProviders.fulfilled, (state, action) => {
        state.providers = action.payload;
      })
      .addCase(saveProvider.fulfilled, (state, action) => {
        const config = action.payload;
        const idx = state.providers.findIndex((p) => p.id === config.id);
        if (idx >= 0) {
          state.providers[idx] = config;
        } else {
          state.providers.push(config);
        }
      })
      .addCase(removeProvider.fulfilled, (state, action) => {
        state.providers = state.providers.filter((p) => p.id !== action.payload);
      })
      .addCase(setActiveProvider.fulfilled, (state, action) => {
        for (const p of state.providers) {
          p.isActive = p.id === action.payload;
        }
      })
      // Knowledge Base — load from disk
      .addCase(loadKnowledgeBase.fulfilled, (state, action) => {
        state.knowledgeBase = action.payload;
      })
      // MCP Servers — load from disk
      .addCase(loadMCPServers.fulfilled, (state, action) => {
        state.mcpServers = action.payload;
      })
      // Channels — load from disk
      .addCase(loadChannels.fulfilled, (state, action) => {
        state.channels = action.payload;
      })
      // Scheduled Tasks — load from disk
      .addCase(loadScheduledTasks.fulfilled, (state, action) => {
        state.scheduledTasks = action.payload;
      })
      // Installed Skills
      .addCase(loadInstalledSkills.fulfilled, (state, action) => {
        state.installedSkills = action.payload;
      })
      // Tool Permissions
      .addCase(loadToolPermissions.fulfilled, (state, action) => {
        state.toolPermissions = action.payload;
      })
      .addCase(saveToolPermissions.fulfilled, (state, action) => {
        state.toolPermissions = action.payload;
      })
      .addCase(resetAllSettings.fulfilled, (state) => {
        // Reset to defaults
        state.theme = "system";
        state.accentColor = "blue";
        state.fontSize = "default";
        state.layoutDensity = "comfortable";
        state.language = "en";
        state.proxyUrl = "";
        state.workspacePath = "";
        state.dataPath = "";
        state.globalSystemPrompt = "";
        state.providers = [];
        state.knowledgeBase = [];
        state.mcpServers = [];
        state.channels = [];
        state.scheduledTasks = [];
        state.installedSkills = [];
        state.folders = [];
        state.conversationOrder = { favorites: [], ungrouped: [], folders: {} };
        state.lastCreatedFolderId = null;
        state.toolPermissions = {
          approvalMode: "smart",
          fileRead: true,
          fileWrite: true,
          shellExecute: true,
          mcpCall: true,
          allowedPaths: [],
        };
        state.voice = {
          sttApiUrl: "",
          sttApiKey: "",
          sttLanguage: "",
          ttsVoice: "",
          ttsRate: 1.0,
          ttsPitch: 1.0,
          autoReadReplies: false,
        };
      });
  },
});

export const {
  setTheme,
  setAccentColor,
  setFontSize,
  setLayoutDensity,
  setLanguage,
  setProxyUrl,
  setWorkspacePath,
  setDataPath,
  setGlobalSystemPrompt,
  upsertKBItem,
  deleteKBItem,
  upsertMCPServer,
  deleteMCPServer,
  upsertChannel,
  deleteChannel,
  upsertProvider,
  deleteProvider,
  activateProvider,
  upsertScheduledTask,
  deleteScheduledTask,
  replaceScheduledTasks,
  addInstalledSkill,
  updateInstalledSkill,
  removeInstalledSkill,
  updateToolPermissions,
  setVoiceSettings,
  createFolder,
  renameFolder,
  deleteFolder,
  clearLastCreatedFolderId,
  reorderConversations,
  reorderFolders,
} = settingsSlice.actions;

export default settingsSlice.reducer;
