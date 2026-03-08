import { ipcMain, BrowserWindow } from "electron";
import { is } from "@electron-toolkit/utils";

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | {
      state: "downloading";
      progress: { percent: number; bytesPerSecond: number; transferred: number; total: number };
    }
  | { state: "downloaded"; version: string }
  | { state: "error"; error: string };

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_DELAY_MS = 10 * 1000; // 10 seconds after launch

function sendStatus(status: UpdateStatus): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send("updater:status", status);
  }
}

export function registerUpdaterHandlers(): void {
  if (is.dev) {
    // In dev mode, register stub handlers so IPC channels exist
    ipcMain.handle("updater:checkForUpdates", () => {
      sendStatus({ state: "checking" });
      setTimeout(() => sendStatus({ state: "not-available" }), 1000);
    });
    ipcMain.handle("updater:downloadUpdate", () => {
      // no-op in dev
    });
    ipcMain.handle("updater:installUpdate", () => {
      // no-op in dev
    });
    console.log("[Updater] Dev mode – stub handlers registered");
    return;
  }

  // Dynamic import to avoid requiring electron-updater in dev (it may fail without packaged app context)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } = require("electron-updater");

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // ---- Event forwarding ----
  autoUpdater.on("checking-for-update", () => {
    sendStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info: { version: string }) => {
    sendStatus({ state: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus({ state: "not-available" });
  });

  autoUpdater.on(
    "download-progress",
    (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => {
      sendStatus({
        state: "downloading",
        progress: {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        },
      });
    },
  );

  autoUpdater.on("update-downloaded", (info: { version: string }) => {
    sendStatus({ state: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (err: Error) => {
    sendStatus({ state: "error", error: err.message });
  });

  // ---- IPC handlers ----
  ipcMain.handle("updater:checkForUpdates", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      console.error("[Updater] Check failed:", err);
    }
  });

  ipcMain.handle("updater:downloadUpdate", async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      console.error("[Updater] Download failed:", err);
    }
  });

  ipcMain.handle("updater:installUpdate", () => {
    setImmediate(() => autoUpdater.quitAndInstall());
  });

  // ---- Scheduled checks ----
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error("[Updater] Initial check failed:", err);
    });
  }, INITIAL_DELAY_MS);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error("[Updater] Periodic check failed:", err);
    });
  }, CHECK_INTERVAL_MS);

  console.log("[Updater] Production handlers registered");
}
