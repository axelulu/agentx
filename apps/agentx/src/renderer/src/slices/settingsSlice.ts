import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

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

export type ToolApprovalMode = "auto" | "always-ask" | "smart";

export interface ToolPermissionsState {
  approvalMode: ToolApprovalMode;
  fileRead: boolean;
  fileWrite: boolean;
  shellExecute: boolean;
  allowedPaths: string[];
}

export interface SettingsState {
  theme: "light" | "dark" | "system";
  language: string;
  proxyUrl: string;
  providers: ProviderConfig[];
  knowledgeBase: KnowledgeBaseItem[];
  mcpServers: MCPServerConfig[];
  toolPermissions: ToolPermissionsState;
}

// ---------------------------------------------------------------------------
// Async thunks — load only (read from main process)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Preferences (theme, language, sidebar — disk-persisted via main process)
// ---------------------------------------------------------------------------

export const loadPreferences = createAsyncThunk("settings/loadPreferences", async () => {
  const prefs = await window.api.preferences.get();
  return prefs as { theme?: string; language?: string; sidebarOpen?: boolean; proxyUrl?: string };
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
  window.api.preferences.set(prefs).catch((err: unknown) => {
    console.error("[Preferences] Failed to persist:", err);
  });
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
  providers: [],
  knowledgeBase: [],
  mcpServers: [],
  toolPermissions: {
    approvalMode: "smart",
    fileRead: true,
    fileWrite: true,
    shellExecute: true,
    allowedPaths: [],
  },
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
  upsertKBItem,
  deleteKBItem,
  upsertMCPServer,
  deleteMCPServer,
  updateToolPermissions,
} = settingsSlice.actions;

export default settingsSlice.reducer;
