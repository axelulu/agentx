import { createSlice, createAsyncThunk, type PayloadAction, current } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

// Types and persistence helpers extracted to settings/ modules
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
} from "./settings/types";

import type {
  ProviderConfig,
  KnowledgeBaseItem,
  MCPServerConfig,
  ChannelConfig,
  VoiceSettings,
  ToolPermissionsState,
  SkillDefinition,
  Folder,
  ConversationOrder,
  AccentColor,
  FontSize,
  LayoutDensity,
  SettingsState,
  PrefsPayload,
} from "./settings/types";

import {
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
} from "./settings/persistence";

// ---------------------------------------------------------------------------
// Async thunks — load only (read from main process)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Preferences (theme, language, sidebar — disk-persisted via main process)
// ---------------------------------------------------------------------------

export const loadPreferences = createAsyncThunk("settings/loadPreferences", async () => {
  let prefs: PrefsPayload = {};
  try {
    prefs = (await window.api.preferences.get()) as PrefsPayload;
  } catch {
    /* sidecar unavailable */
  }

  // If sidecar returned empty, try localStorage backup
  if (!prefs || Object.keys(prefs).length === 0) {
    prefs = lsGet<PrefsPayload>(LS_PREFERENCES, {});
  } else {
    // Sidecar succeeded — mirror to localStorage
    lsSet(LS_PREFERENCES, prefs);
  }
  return prefs;
});

export const loadProviders = createAsyncThunk("settings/loadProviders", async () => {
  let configs: ProviderConfig[] = [];
  try {
    configs = (await window.api.provider.list()) as ProviderConfig[];
  } catch {
    /* sidecar unavailable */
  }

  // If sidecar returned empty, try localStorage backup
  if (!configs || configs.length === 0) {
    const backup = lsGet<ProviderConfig[]>(LS_PROVIDERS, []);
    if (backup.length > 0) {
      configs = backup;
      // Re-sync to sidecar so runtime has the providers
      for (const c of configs) {
        window.api.provider.set(c).catch(() => {});
      }
    }
  } else {
    // Sidecar succeeded — mirror to localStorage
    lsSet(LS_PROVIDERS, configs);
  }
  return configs;
});

export const saveProvider = createAsyncThunk(
  "settings/saveProvider",
  async (config: ProviderConfig) => {
    lsUpsert(LS_PROVIDERS, config);
    await window.api.provider.set(config);
    return config;
  },
);

export const removeProvider = createAsyncThunk("settings/removeProvider", async (id: string) => {
  lsRemove(LS_PROVIDERS, id);
  await window.api.provider.remove(id);
  return id;
});

export const setActiveProvider = createAsyncThunk(
  "settings/setActiveProvider",
  async (id: string) => {
    const list = lsGet<ProviderConfig[]>(LS_PROVIDERS, []);
    for (const p of list) p.isActive = p.id === id;
    lsSet(LS_PROVIDERS, list);
    await window.api.provider.setActive(id);
    return id;
  },
);

export const loadKnowledgeBase = createAsyncThunk("settings/loadKnowledgeBase", async () => {
  let items: KnowledgeBaseItem[] = [];
  try {
    items = (await window.api.knowledgeBase.list()) as KnowledgeBaseItem[];
  } catch {
    /* sidecar unavailable */
  }
  if (!items || items.length === 0) {
    const backup = lsGet<KnowledgeBaseItem[]>(LS_KB, []);
    if (backup.length > 0) {
      items = backup;
      for (const it of items) window.api.knowledgeBase.set(it).catch(() => {});
    }
  } else {
    lsSet(LS_KB, items);
  }
  return items;
});

export const loadMCPServers = createAsyncThunk("settings/loadMCPServers", async () => {
  let configs: MCPServerConfig[] = [];
  try {
    configs = (await window.api.mcp.list()) as MCPServerConfig[];
  } catch {
    /* sidecar unavailable */
  }
  if (!configs || configs.length === 0) {
    const backup = lsGet<MCPServerConfig[]>(LS_MCP, []);
    if (backup.length > 0) {
      configs = backup;
      for (const c of configs) window.api.mcp.set(c).catch(() => {});
    }
  } else {
    lsSet(LS_MCP, configs);
  }
  return configs;
});

export const loadInstalledSkills = createAsyncThunk("settings/loadInstalledSkills", async () => {
  let skills: SkillDefinition[] = [];
  try {
    skills = (await window.api.skills.listInstalled()) as SkillDefinition[];
  } catch {
    /* sidecar unavailable */
  }
  if (!skills || skills.length === 0) {
    const backup = lsGet<SkillDefinition[]>(LS_SKILLS, []);
    if (backup.length > 0) {
      skills = backup;
      for (const s of skills) window.api.skills.install(s).catch(() => {});
    }
  } else {
    lsSet(LS_SKILLS, skills);
  }
  return skills;
});

export const searchSkillStore = createAsyncThunk(
  "settings/searchSkillStore",
  async ({ query, category }: { query: string; category?: string }) => {
    const result = await window.api.skills.search(query, category, 30);
    return result.skills as SkillDefinition[];
  },
);

export const loadChannels = createAsyncThunk("settings/loadChannels", async () => {
  let configs: ChannelConfig[] = [];
  try {
    configs = (await window.api.channel.list()) as ChannelConfig[];
  } catch {
    /* sidecar unavailable */
  }
  if (!configs || configs.length === 0) {
    const backup = lsGet<ChannelConfig[]>(LS_CHANNELS, []);
    if (backup.length > 0) {
      configs = backup;
      for (const c of configs) window.api.channel.set(c).catch(() => {});
    }
  } else {
    lsSet(LS_CHANNELS, configs);
  }
  return configs;
});

export const loadScheduledTasks = createAsyncThunk("settings/loadScheduledTasks", async () => {
  let tasks: ScheduledTaskConfig[] = [];
  try {
    tasks = (await window.api.scheduler.list()) as ScheduledTaskConfig[];
  } catch {
    /* sidecar unavailable */
  }
  if (!tasks || tasks.length === 0) {
    const backup = lsGet<ScheduledTaskConfig[]>(LS_SCHEDULED, []);
    if (backup.length > 0) {
      tasks = backup;
      for (const t of tasks) window.api.scheduler.set(t).catch(() => {});
    }
  } else {
    lsSet(LS_SCHEDULED, tasks);
  }
  return tasks;
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
        await window.api.provider.remove(p.id);
      } catch {}
    }
    // Remove all KB items
    for (const k of state.knowledgeBase) {
      try {
        await window.api.knowledgeBase.remove(k.id);
      } catch {}
    }
    // Remove all MCP servers
    for (const m of state.mcpServers) {
      try {
        await window.api.mcp.remove(m.id);
      } catch {}
    }
    // Remove all scheduled tasks
    for (const t of state.scheduledTasks) {
      try {
        await window.api.scheduler.remove(t.id);
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

    // Clear localStorage (UI settings + data mirrors)
    localStorage.removeItem("agentx-theme");
    localStorage.removeItem("agentx-accent-color");
    localStorage.removeItem("agentx-font-size");
    localStorage.removeItem("agentx-layout-density");
    localStorage.removeItem("agentx-language");
    localStorage.removeItem("agentx-open-tabs");
    localStorage.removeItem("agentx-collapsed-folders");
    localStorage.removeItem("agentx-terminal-height");
    localStorage.removeItem(LS_PROVIDERS);
    localStorage.removeItem(LS_PREFERENCES);
    localStorage.removeItem(LS_KB);
    localStorage.removeItem(LS_MCP);
    localStorage.removeItem(LS_SKILLS);
    localStorage.removeItem(LS_CHANNELS);
    localStorage.removeItem(LS_SCHEDULED);
    localStorage.removeItem(LS_TOOL_PERMS);
  },
);

export const loadToolPermissions = createAsyncThunk("settings/loadToolPermissions", async () => {
  let perms: ToolPermissionsState | null = null;
  try {
    perms = (await window.api.toolPermissions.get()) as ToolPermissionsState;
  } catch {
    /* sidecar unavailable */
  }
  if (!perms || !perms.approvalMode) {
    const backup = lsGet<ToolPermissionsState | null>(LS_TOOL_PERMS, null);
    if (backup && backup.approvalMode) {
      perms = backup;
      window.api.toolPermissions.set(backup).catch(() => {});
    }
  } else {
    lsSet(LS_TOOL_PERMS, perms);
  }
  return perms as ToolPermissionsState;
});

export const saveToolPermissions = createAsyncThunk(
  "settings/saveToolPermissions",
  async (permissions: ToolPermissionsState) => {
    lsSet(LS_TOOL_PERMS, permissions);
    await window.api.toolPermissions.set(permissions);
    return permissions;
  },
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const initialState: SettingsState = {
  theme: (localStorage.getItem("agentx-theme") as SettingsState["theme"]) || "system",
  accentColor: (localStorage.getItem("agentx-accent-color") as AccentColor) || "cyan",
  fontSize: (localStorage.getItem("agentx-font-size") as FontSize) || "default",
  layoutDensity: (localStorage.getItem("agentx-layout-density") as LayoutDensity) || "comfortable",
  language: localStorage.getItem("agentx-language") || "en",
  proxyUrl: lsGet<PrefsPayload>(LS_PREFERENCES, {}).proxyUrl ?? "",
  workspacePath: lsGet<PrefsPayload>(LS_PREFERENCES, {}).workspacePath ?? "",
  dataPath: lsGet<PrefsPayload>(LS_PREFERENCES, {}).dataPath ?? "",
  globalSystemPrompt: lsGet<PrefsPayload>(LS_PREFERENCES, {}).globalSystemPrompt ?? "",
  providers: lsGet<ProviderConfig[]>(LS_PROVIDERS, []),
  knowledgeBase: lsGet<KnowledgeBaseItem[]>(LS_KB, []),
  mcpServers: lsGet<MCPServerConfig[]>(LS_MCP, []),
  channels: lsGet<ChannelConfig[]>(LS_CHANNELS, []),
  scheduledTasks: lsGet<ScheduledTaskConfig[]>(LS_SCHEDULED, []),
  toolPermissions: lsGet<ToolPermissionsState>(LS_TOOL_PERMS, {
    approvalMode: "smart",
    fileRead: true,
    fileWrite: true,
    shellExecute: true,
    mcpCall: true,
    allowedPaths: [],
  }),
  voice: {
    sttApiUrl: "",
    sttApiKey: "",
    sttLanguage: "",
    ttsVoice: "",
    ttsRate: 1.0,
    ttsPitch: 1.0,
    autoReadReplies: false,
  },
  installedSkills: lsGet<SkillDefinition[]>(LS_SKILLS, []),
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
      // Auto-activate if no other provider is active and this one has an API key
      const hasActive = state.providers.some((p) => p.isActive && p.apiKey);
      if (!hasActive && config.apiKey) {
        for (const p of state.providers) {
          p.isActive = p.id === config.id;
        }
        persistProviderSetActive(config.id);
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

    // -----------------------------------------------------------------------
    // Reactive sync reducers — called by useStoreSync when sidecar emits
    // `{domain}:changed` events. These replace the entire collection with
    // the authoritative data from the sidecar.
    // -----------------------------------------------------------------------
    syncProviders(state, action: PayloadAction<ProviderConfig[]>) {
      state.providers = action.payload;
    },
    syncKnowledgeBase(state, action: PayloadAction<KnowledgeBaseItem[]>) {
      state.knowledgeBase = action.payload;
    },
    syncMCPServers(state, action: PayloadAction<MCPServerConfig[]>) {
      state.mcpServers = action.payload;
    },
    syncInstalledSkills(state, action: PayloadAction<SkillDefinition[]>) {
      state.installedSkills = action.payload;
    },
    syncChannels(state, action: PayloadAction<ChannelConfig[]>) {
      state.channels = action.payload;
    },
    syncScheduledTasks(state, action: PayloadAction<ScheduledTaskConfig[]>) {
      state.scheduledTasks = action.payload;
    },
    syncToolPermissions(state, action: PayloadAction<ToolPermissionsState>) {
      state.toolPermissions = action.payload;
    },
    syncPreferences(state, action: PayloadAction<PrefsPayload>) {
      const prefs = action.payload;
      if (prefs.theme && ["light", "dark", "system"].includes(prefs.theme)) {
        state.theme = prefs.theme as SettingsState["theme"];
      }
      if (prefs.accentColor) state.accentColor = prefs.accentColor as AccentColor;
      if (prefs.fontSize) state.fontSize = prefs.fontSize as FontSize;
      if (prefs.layoutDensity) state.layoutDensity = prefs.layoutDensity as LayoutDensity;
      if (prefs.language) state.language = prefs.language;
      if (typeof prefs.proxyUrl === "string") state.proxyUrl = prefs.proxyUrl;
      if (typeof prefs.workspacePath === "string") state.workspacePath = prefs.workspacePath;
      if (typeof prefs.dataPath === "string") state.dataPath = prefs.dataPath;
      if (typeof prefs.globalSystemPrompt === "string")
        state.globalSystemPrompt = prefs.globalSystemPrompt;
      if (prefs.voice && typeof prefs.voice === "object")
        state.voice = { ...state.voice, ...prefs.voice };
      if (Array.isArray(prefs.folders)) state.folders = prefs.folders as Folder[];
      if (prefs.conversationOrder && typeof prefs.conversationOrder === "object") {
        state.conversationOrder = {
          ...state.conversationOrder,
          ...(prefs.conversationOrder as ConversationOrder),
        };
      }
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
  syncProviders,
  syncKnowledgeBase,
  syncMCPServers,
  syncInstalledSkills,
  syncChannels,
  syncScheduledTasks,
  syncToolPermissions,
  syncPreferences,
} = settingsSlice.actions;

export default settingsSlice.reducer;
