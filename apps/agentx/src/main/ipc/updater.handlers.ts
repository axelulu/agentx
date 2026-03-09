import { ipcMain, BrowserWindow, app } from "electron";
import { is } from "@electron-toolkit/utils";
import { spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

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

// ---------------------------------------------------------------------------
// macOS manual update installer
// ---------------------------------------------------------------------------
// Squirrel.Mac (Electron's native autoUpdater) validates code signatures,
// which fails for unsigned apps. Instead we manually extract the downloaded
// ZIP, replace the running .app bundle, and relaunch via a helper script.
// ---------------------------------------------------------------------------

function findDownloadedZip(): string | null {
  // electron-updater stores downloaded files in:
  //   ~/Library/Caches/{appName}-updater/pending/
  const cacheDir = join(
    app.getPath("userData"),
    "..",
    "Caches",
    `${app.getName()}-updater`,
    "pending",
  );
  if (!existsSync(cacheDir)) return null;
  const files = readdirSync(cacheDir).filter((f) => f.endsWith(".zip"));
  if (files.length === 0) return null;
  return join(cacheDir, files[0]!);
}

function macManualInstall(): void {
  const zipPath = findDownloadedZip();
  if (!zipPath) {
    console.error("[Updater] No downloaded ZIP found for manual install");
    return;
  }

  const currentAppPath = app.getAppPath();
  // app.getAppPath() returns something like /Applications/AgentX.app/Contents/Resources/app.asar
  // We need the .app bundle path
  const appBundlePath = currentAppPath.replace(/\/Contents\/.*$/, "");
  const appDir = join(appBundlePath, "..");
  const tempExtractDir = join(app.getPath("temp"), "agentx-update");

  // Shell script that:
  // 1. Waits for the current process to exit
  // 2. Extracts the ZIP to a temp dir
  // 3. Removes quarantine attributes
  // 4. Replaces the old .app with the new one
  // 5. Relaunches the app
  const script = `
    PID=${process.pid}
    # Wait for the app to quit
    while kill -0 $PID 2>/dev/null; do sleep 0.2; done
    # Clean up previous extraction
    rm -rf "${tempExtractDir}"
    mkdir -p "${tempExtractDir}"
    # Extract the update ZIP
    ditto -x -k "${zipPath}" "${tempExtractDir}"
    # Find the .app inside extracted dir
    APP_NAME=$(ls -d "${tempExtractDir}"/*.app 2>/dev/null | head -1)
    if [ -z "$APP_NAME" ]; then
      echo "[Updater] No .app found in extracted ZIP"
      exit 1
    fi
    # Remove quarantine
    xattr -cr "$APP_NAME"
    # Replace old app
    rm -rf "${appBundlePath}"
    mv "$APP_NAME" "${appDir}/"
    # Clean up
    rm -rf "${tempExtractDir}"
    # Relaunch
    INSTALLED_APP="${appDir}/$(basename "$APP_NAME")"
    open "$INSTALLED_APP"
  `;

  const child = spawn("/bin/bash", ["-c", script], { detached: true, stdio: "ignore" });
  child.unref();

  // Quit the app so the script can replace it
  app.quit();
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
  // On macOS, disable autoInstallOnAppQuit to prevent Squirrel.Mac from
  // trying to verify the code signature during download phase.
  autoUpdater.autoInstallOnAppQuit = process.platform !== "darwin";

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
    if (process.platform === "darwin") {
      // Bypass Squirrel.Mac entirely — manual ZIP extract + replace + relaunch
      setImmediate(() => macManualInstall());
    } else {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    }
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
