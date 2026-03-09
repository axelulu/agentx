import { createSlice, createAsyncThunk, type PayloadAction, current } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types (mirrors DesktopProviderConfig from @workspace/desktop)
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

export interface SettingsState {
  theme: "light" | "dark" | "system";
  language: string;
  proxyUrl: string;
  workspacePath: string;
  dataPath: string;
  globalSystemPrompt: string;
  providers: ProviderConfig[];
  knowledgeBase: KnowledgeBaseItem[];
  mcpServers: MCPServerConfig[];
  toolPermissions: ToolPermissionsState;
  voice: VoiceSettings;
  installedSkills: SkillDefinition[];
  folders: Folder[];
  conversationOrder: ConversationOrder;
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
  language: localStorage.getItem("agentx-language") || "en",
  proxyUrl: "",
  workspacePath: "",
  dataPath: "",
  globalSystemPrompt: "",
  providers: [],
  knowledgeBase: [],
  mcpServers: [],
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
      persistPreferences({ folders: current(state.folders) });
    },
    renameFolder(state, action: PayloadAction<{ id: string; name: string }>) {
      const folder = state.folders.find((f) => f.id === action.payload.id);
      if (folder) {
        folder.name = action.payload.name;
        persistPreferences({ folders: current(state.folders) });
      }
    },
    deleteFolder(state, action: PayloadAction<string>) {
      state.folders = state.folders.filter((f) => f.id !== action.payload);
      // Clean up ordering for the deleted folder
      delete state.conversationOrder.folders[action.payload];
      persistPreferences({
        folders: current(state.folders),
        conversationOrder: current(state.conversationOrder),
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
      state.folders = action.payload;
      persistPreferences({ folders: current(state.folders) });
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
      });
  },
});

export const {
  setTheme,
  setLanguage,
  setProxyUrl,
  setWorkspacePath,
  setDataPath,
  setGlobalSystemPrompt,
  upsertKBItem,
  deleteKBItem,
  upsertMCPServer,
  deleteMCPServer,
  addInstalledSkill,
  removeInstalledSkill,
  updateToolPermissions,
  setVoiceSettings,
  createFolder,
  renameFolder,
  deleteFolder,
  reorderConversations,
  reorderFolders,
} = settingsSlice.actions;

export default settingsSlice.reducer;
