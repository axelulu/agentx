import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { loadPreferences } from "./settingsSlice";
import {
  switchConversation,
  resetToWelcome,
  removeConversation,
  removeConversations,
} from "./chatSlice";

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
  | "about";

export interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  activePanel: "chat" | "settings";
  activeView: "chat" | "automation" | "skills";
  searchOpen: boolean;
  openTabs: string[];
  collapsedFolderIds: string[];
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
  openTabs: [],
  collapsedFolderIds: [],
};

export const closeTabAndSwitch = createAsyncThunk(
  "ui/closeTabAndSwitch",
  async (tabId: string, { getState, dispatch }) => {
    const state = getState() as { ui: UIState; chat: { currentConversationId: string | null } };
    const { openTabs } = state.ui;
    const currentId = state.chat.currentConversationId;
    const idx = openTabs.indexOf(tabId);

    // If closing the active tab, switch to an adjacent one or go to welcome
    if (tabId === currentId && idx !== -1) {
      if (openTabs.length > 1) {
        const nextIdx = idx === openTabs.length - 1 ? idx - 1 : idx + 1;
        const nextId = openTabs[nextIdx];
        if (nextId) {
          dispatch(switchConversation(nextId));
        }
      } else {
        dispatch(resetToWelcome());
      }
    }

    return tabId;
  },
);

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
    setActiveView(state, action: PayloadAction<"chat" | "automation" | "skills">) {
      state.activeView = action.payload;
    },

    // Tab management
    openTab(state, action: PayloadAction<string>) {
      if (!state.openTabs.includes(action.payload)) {
        state.openTabs.push(action.payload);
      }
    },
    closeTab(state, action: PayloadAction<string>) {
      state.openTabs = state.openTabs.filter((id) => id !== action.payload);
    },
    closeOtherTabs(state, action: PayloadAction<string>) {
      state.openTabs = state.openTabs.includes(action.payload) ? [action.payload] : [];
    },
    closeAllTabs(state) {
      state.openTabs = [];
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
      .addCase(closeTabAndSwitch.fulfilled, (state, action) => {
        state.openTabs = state.openTabs.filter((id) => id !== action.payload);
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
  openTab,
  closeTab,
  closeOtherTabs,
  closeAllTabs,
  toggleFolderCollapsed,
} = uiSlice.actions;

export default uiSlice.reducer;
