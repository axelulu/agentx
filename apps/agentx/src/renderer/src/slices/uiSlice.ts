import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  activePanel: "chat" | "settings";
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
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
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
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSettings,
  setSettingsOpen,
  setActivePanel,
} = uiSlice.actions;

export default uiSlice.reducer;
