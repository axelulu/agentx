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
  dialogOpen: boolean;
}

const initialState: UpdateSliceState = {
  state: "idle",
  version: null,
  progress: null,
  error: null,
  dialogOpen: false,
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
      state.state = action.payload.state;
      state.version = action.payload.version ?? state.version;
      state.progress = action.payload.progress ?? null;
      state.error = action.payload.error ?? null;

      // Auto-open dialog when update is available (from periodic checks)
      if (action.payload.state === "available" || action.payload.state === "downloaded") {
        state.dialogOpen = true;
      }
    },
    openUpdateDialog(state) {
      state.dialogOpen = true;
    },
    closeUpdateDialog(state) {
      state.dialogOpen = false;
    },
    resetUpdateState() {
      return initialState;
    },
  },
});

export const { setUpdateStatus, openUpdateDialog, closeUpdateDialog, resetUpdateState } =
  updateSlice.actions;
export default updateSlice.reducer;
