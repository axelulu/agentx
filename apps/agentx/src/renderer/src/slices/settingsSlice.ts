import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ProviderConfig {
  apiKey: string;
  selectedModel: string;
  enabled: boolean;
}

export interface SettingsState {
  theme: "light" | "dark" | "system";
  language: string;
  providers: Record<string, ProviderConfig>;
}

const initialState: SettingsState = {
  theme: "dark",
  language: "en",
  providers: {
    openai: { apiKey: "", selectedModel: "gpt-4o", enabled: false },
    anthropic: {
      apiKey: "",
      selectedModel: "claude-sonnet-4-20250514",
      enabled: false,
    },
    gemini: {
      apiKey: "",
      selectedModel: "gemini-2.5-flash",
      enabled: false,
    },
    openrouter: { apiKey: "", selectedModel: "", enabled: false },
  },
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
    },
    setProviderConfig(
      state,
      action: PayloadAction<{
        provider: string;
        config: Partial<ProviderConfig>;
      }>
    ) {
      const { provider, config } = action.payload;
      if (state.providers[provider]) {
        Object.assign(state.providers[provider], config);
      }
    },
    loadSettings(_state, action: PayloadAction<SettingsState>) {
      return action.payload;
    },
  },
});

export const { setTheme, setLanguage, setProviderConfig, loadSettings } =
  settingsSlice.actions;

export default settingsSlice.reducer;
