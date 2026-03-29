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
  /** When true, update was triggered silently (auto-update) — don't pop dialog */
  silent: boolean;
}

const initialState: UpdateSliceState = {
  state: "idle",
  version: null,
  progress: null,
  error: null,
  dialogOpen: false,
  silent: false,
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

/** Silent auto-update: check → download in background, no dialog */
export const silentAutoUpdate = createAsyncThunk("update/silentAutoUpdate", async () => {
  await window.api.updater.checkForUpdates();
});

const updateSlice = createSlice({
  name: "update",
  initialState,
  extraReducers: (builder) => {
    builder.addCase(downloadUpdate.pending, (state) => {
      state.state = "downloading";
      state.progress = { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 };
      state.error = null;
    });
    builder.addCase(silentAutoUpdate.pending, (state) => {
      state.silent = true;
    });
  },
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

      // Auto-open dialog only for non-silent updates
      if (!state.silent) {
        if (action.payload.state === "available" || action.payload.state === "downloaded") {
          state.dialogOpen = true;
        }
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
    setSilent(state, action: PayloadAction<boolean>) {
      state.silent = action.payload;
    },
  },
});

export const { setUpdateStatus, openUpdateDialog, closeUpdateDialog, resetUpdateState, setSilent } =
  updateSlice.actions;
export default updateSlice.reducer;
