import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface NotificationState {
  notifications: MacNotification[];
  config: NotificationIntelligenceConfig;
  loading: boolean;
  classifying: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  config: {
    enabled: false,
    pollingIntervalMs: 30000,
    autoClassify: true,
    rules: [],
  },
  loading: false,
  classifying: false,
};

export const loadNIConfig = createAsyncThunk("ni/loadConfig", async () => {
  return (await window.api.notificationIntelligence.getConfig()) as NotificationIntelligenceConfig;
});

export const saveNIConfig = createAsyncThunk(
  "ni/saveConfig",
  async (config: NotificationIntelligenceConfig) => {
    await window.api.notificationIntelligence.setConfig(config);
    return config;
  },
);

export const fetchNotifications = createAsyncThunk("ni/fetch", async () => {
  return (await window.api.notificationIntelligence.fetch()) as MacNotification[];
});

export const classifyNotifications = createAsyncThunk(
  "ni/classify",
  async (notifications: MacNotification[]) => {
    return (await window.api.notificationIntelligence.classify(notifications)) as MacNotification[];
  },
);

export const startNI = createAsyncThunk("ni/start", async () => {
  await window.api.notificationIntelligence.start();
});

export const stopNI = createAsyncThunk("ni/stop", async () => {
  await window.api.notificationIntelligence.stop();
});

export const markNotificationsRead = createAsyncThunk("ni/markRead", async (ids: string[]) => {
  await window.api.notificationIntelligence.markRead(ids);
  return ids;
});

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    replaceNotifications(state, action: PayloadAction<MacNotification[]>) {
      state.notifications = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadNIConfig.fulfilled, (state, action) => {
        state.config = action.payload;
      })
      .addCase(saveNIConfig.fulfilled, (state, action) => {
        state.config = action.payload;
      })
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload;
        state.loading = false;
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.loading = false;
      })
      .addCase(classifyNotifications.pending, (state) => {
        state.classifying = true;
      })
      .addCase(classifyNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload;
        state.classifying = false;
      })
      .addCase(classifyNotifications.rejected, (state) => {
        state.classifying = false;
      })
      .addCase(startNI.fulfilled, (state) => {
        state.config.enabled = true;
      })
      .addCase(stopNI.fulfilled, (state) => {
        state.config.enabled = false;
      })
      .addCase(markNotificationsRead.fulfilled, (state, action) => {
        const readIds = new Set(action.payload);
        for (const n of state.notifications) {
          if (readIds.has(n.id)) n.read = true;
        }
      });
  },
});

export const { replaceNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
