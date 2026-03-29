import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loadPreferences } from "./settingsSlice";
import { removeConversation, removeConversations } from "./chatSlice";

export type SettingsSection =
  | "general"
  | "voice"
  | "systemPrompt"
  | "providers"
  | "knowledgeBase"
  | "mcp"
  | "channels"
  | "memory"
  | "permissions"
  | "systemHealth"
  | "about";

export interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  activePanel: "chat" | "settings";
  activeView: "chat" | "automation" | "skills" | "notifications";
  searchOpen: boolean;
  clipboardOpen: boolean;
  wechatImportOpen: boolean;
  openTabs: string[];
  collapsedFolderIds: string[];
  terminalOpen: boolean;
  terminalHeight: number;
}

function persistSidebar(open: boolean): void {
  window.api.preferences.set({ sidebarOpen: open }).catch((err: unknown) => {
    console.error("[Preferences] Failed to persist sidebar:", err);
  });
}

const initialState: UIState = {
  sidebarOpen: true,
  settingsOpen: false,
  settingsSection: "providers",
  activePanel: "chat",
  activeView: "chat",
  searchOpen: false,
  clipboardOpen: false,
  wechatImportOpen: false,
  openTabs: [],
  collapsedFolderIds: [],
  terminalOpen: false,
  terminalHeight: 250,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
      persistSidebar(state.sidebarOpen);
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
      persistSidebar(action.payload);
    },
    toggleSettings(state) {
      state.settingsOpen = !state.settingsOpen;
    },
    setSettingsOpen(state, action: PayloadAction<boolean>) {
      state.settingsOpen = action.payload;
    },
    openSettingsSection(state, action: PayloadAction<SettingsSection>) {
      state.settingsSection = action.payload;
      state.settingsOpen = true;
    },
    setActivePanel(state, action: PayloadAction<"chat" | "settings">) {
      state.activePanel = action.payload;
    },
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload;
    },
    toggleSearch(state) {
      state.searchOpen = !state.searchOpen;
    },
    setActiveView(
      state,
      action: PayloadAction<"chat" | "automation" | "skills" | "notifications">,
    ) {
      state.activeView = action.payload;
    },
    setClipboardOpen(state, action: PayloadAction<boolean>) {
      state.clipboardOpen = action.payload;
    },
    toggleClipboard(state) {
      state.clipboardOpen = !state.clipboardOpen;
    },
    setWeChatImportOpen(state, action: PayloadAction<boolean>) {
      state.wechatImportOpen = action.payload;
    },

    // Tab management — single tab only (replaces previous)
    openTab(state, action: PayloadAction<string>) {
      state.openTabs = [action.payload];
    },
    closeTab(state, action: PayloadAction<string>) {
      state.openTabs = state.openTabs.filter((id) => id !== action.payload);
    },
    toggleTerminal(state) {
      state.terminalOpen = !state.terminalOpen;
    },
    setTerminalOpen(state, action: PayloadAction<boolean>) {
      state.terminalOpen = action.payload;
    },
    setTerminalHeight(state, action: PayloadAction<number>) {
      state.terminalHeight = Math.max(100, Math.min(600, action.payload));
    },
    toggleFolderCollapsed(state, action: PayloadAction<string>) {
      const idx = state.collapsedFolderIds.indexOf(action.payload);
      if (idx >= 0) {
        state.collapsedFolderIds.splice(idx, 1);
      } else {
        state.collapsedFolderIds.push(action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPreferences.fulfilled, (state, action) => {
        if (typeof action.payload.sidebarOpen === "boolean") {
          state.sidebarOpen = action.payload.sidebarOpen;
        }
      })
      // Auto-close tabs when conversations are deleted
      .addCase(removeConversation.fulfilled, (state, action) => {
        state.openTabs = state.openTabs.filter((id) => id !== action.payload);
      })
      .addCase(removeConversations.fulfilled, (state, action) => {
        const deleted = new Set(action.payload);
        state.openTabs = state.openTabs.filter((id) => !deleted.has(id));
      });
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSettings,
  setSettingsOpen,
  openSettingsSection,
  setActivePanel,
  setSearchOpen,
  toggleSearch,
  setActiveView,
  setClipboardOpen,
  toggleClipboard,
  setWeChatImportOpen,
  openTab,
  closeTab,
  toggleFolderCollapsed,
  toggleTerminal,
  setTerminalOpen,
  setTerminalHeight,
} = uiSlice.actions;

export default uiSlice.reducer;
