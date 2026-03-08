import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loadPreferences } from "./settingsSlice";

export interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  activePanel: "chat" | "settings";
}

function persistSidebar(open: boolean): void {
  window.api.preferences.set({ sidebarOpen: open }).catch((err: unknown) => {
    console.error("[Preferences] Failed to persist sidebar:", err);
  });
}

const initialState: UIState = {
  sidebarOpen: true,
  settingsOpen: false,
  activePanel: "chat",
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
    setActivePanel(state, action: PayloadAction<"chat" | "settings">) {
      state.activePanel = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadPreferences.fulfilled, (state, action) => {
      if (typeof action.payload.sidebarOpen === "boolean") {
        state.sidebarOpen = action.payload.sidebarOpen;
      }
    });
  },
});

export const { toggleSidebar, setSidebarOpen, toggleSettings, setSettingsOpen, setActivePanel } =
  uiSlice.actions;

export default uiSlice.reducer;
