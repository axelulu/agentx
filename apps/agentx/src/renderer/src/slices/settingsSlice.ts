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

export interface SettingsState {
  theme: "light" | "dark" | "system";
  language: string;
  providers: ProviderConfig[];
  knowledgeBase: KnowledgeBaseItem[];
  mcpServers: MCPServerConfig[];
}

// ---------------------------------------------------------------------------
// Async thunks — load only (read from main process)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// IPC persistence helpers (fire-and-forget, errors logged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const initialState: SettingsState = {
  theme: "dark",
  language: localStorage.getItem("agentx-language") || "en",
  providers: [],
  knowledgeBase: [],
  mcpServers: [],
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<"light" | "dark" | "system">) {
      state.theme = action.payload;
    },
    setLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
      localStorage.setItem("agentx-language", action.payload);
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
  },
  extraReducers: (builder) => {
    builder
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
      });
  },
});

export const {
  setTheme,
  setLanguage,
  upsertKBItem,
  deleteKBItem,
  upsertMCPServer,
  deleteMCPServer,
} = settingsSlice.actions;

export default settingsSlice.reducer;
