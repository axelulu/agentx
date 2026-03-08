import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateSliceState {
  state: UpdateState;
  version: string | null;
  progress: UpdateProgress | null;
  error: string | null;
  dismissed: boolean;
}

const initialState: UpdateSliceState = {
  state: "idle",
  version: null,
  progress: null,
  error: null,
  dismissed: false,
};

export const checkForUpdates = createAsyncThunk("update/checkForUpdates", async () => {
  await window.api.updater.checkForUpdates();
});

export const downloadUpdate = createAsyncThunk("update/downloadUpdate", async () => {
  await window.api.updater.downloadUpdate();
});

export const installUpdate = createAsyncThunk("update/installUpdate", async () => {
  await window.api.updater.installUpdate();
});

const updateSlice = createSlice({
  name: "update",
  initialState,
  reducers: {
    setUpdateStatus(
      state,
      action: PayloadAction<{
        state: UpdateState;
        version?: string;
        progress?: UpdateProgress;
        error?: string;
      }>,
    ) {
      const prev = state.state;
      state.state = action.payload.state;
      state.version = action.payload.version ?? state.version;
      state.progress = action.payload.progress ?? null;
      state.error = action.payload.error ?? null;
      // Un-dismiss when state changes to a new actionable state
      if (
        prev !== action.payload.state &&
        ["available", "downloaded"].includes(action.payload.state)
      ) {
        state.dismissed = false;
      }
    },
    dismissUpdate(state) {
      state.dismissed = true;
    },
    resetUpdateState() {
      return initialState;
    },
  },
});

export const { setUpdateStatus, dismissUpdate, resetUpdateState } = updateSlice.actions;
export default updateSlice.reducer;
