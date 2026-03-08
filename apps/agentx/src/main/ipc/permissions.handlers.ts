import { ipcMain, systemPreferences, shell, Notification, desktopCapturer } from "electron";
import { readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { exec } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionType =
  | "accessibility"
  | "screen"
  | "microphone"
  | "camera"
  | "full-disk-access"
  | "automation"
  | "notifications";

export type PermissionStatus =
  | "granted"
  | "denied"
  | "not-determined"
  | "restricted"
  | "limited"
  | "unknown";

// ---------------------------------------------------------------------------
// System Preferences URLs (macOS)
// ---------------------------------------------------------------------------

// macOS 13+ (Ventura/Sonoma/Sequoia) uses the new System Settings URL scheme.
// The old `com.apple.preference.security` scheme silently fails on macOS 15.
const SYSTEM_SETTINGS_URLS: Record<PermissionType, string> = {
  accessibility:
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility",
  screen:
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture",
  microphone:
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
  camera: "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Camera",
  "full-disk-access":
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
  automation:
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation",
  notifications:
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Notifications",
};

// ---------------------------------------------------------------------------
// Permission check functions
// ---------------------------------------------------------------------------

function checkAccessibility(): PermissionStatus {
  try {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    return trusted ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

function checkScreenRecording(): PermissionStatus {
  try {
    const status = systemPreferences.getMediaAccessStatus("screen");
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    if (status === "restricted") return "restricted";
    return "not-determined";
  } catch {
    return "unknown";
  }
}

function checkMicrophone(): PermissionStatus {
  try {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    if (status === "restricted") return "restricted";
    return "not-determined";
  } catch {
    return "unknown";
  }
}

function checkCamera(): PermissionStatus {
  try {
    const status = systemPreferences.getMediaAccessStatus("camera");
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    if (status === "restricted") return "restricted";
    return "not-determined";
  } catch {
    return "unknown";
  }
}

function checkFullDiskAccess(): PermissionStatus {
  try {
    // Try to read a TCC-protected directory
    // ~/Library/Safari is protected by Full Disk Access on macOS Mojave+
    const protectedPath = join(homedir(), "Library", "Safari");
    readdirSync(protectedPath);
    return "granted";
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EPERM" || e.code === "EACCES") {
      return "denied";
    }
    // Directory doesn't exist (e.g., Safari not installed) — try another path
    try {
      const altPath = join(homedir(), "Library", "Mail");
      readdirSync(altPath);
      return "granted";
    } catch (err2) {
      const e2 = err2 as NodeJS.ErrnoException;
      if (e2.code === "EPERM" || e2.code === "EACCES") {
        return "denied";
      }
      // Can't determine — fallback
      return "unknown";
    }
  }
}

function checkAutomation(): Promise<PermissionStatus> {
  return new Promise((resolve) => {
    // Try a simple AppleScript that requires Automation permission (non-blocking)
    exec(
      "osascript -e 'tell application \"System Events\" to get name of first process' 2>/dev/null",
      { timeout: 3000 },
      (err) => {
        resolve(err ? "denied" : "granted");
      },
    );
  });
}

function checkNotifications(): PermissionStatus {
  try {
    if (Notification.isSupported()) {
      // Electron doesn't provide a direct API to check notification permission status
      // On macOS, if Notification is supported, it's generally "allowed" unless user disabled it
      return "granted";
    }
    return "denied";
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Check a single permission
// ---------------------------------------------------------------------------

async function checkPermission(type: PermissionType): Promise<PermissionStatus> {
  if (process.platform !== "darwin") return "granted";

  switch (type) {
    case "accessibility":
      return checkAccessibility();
    case "screen":
      return checkScreenRecording();
    case "microphone":
      return checkMicrophone();
    case "camera":
      return checkCamera();
    case "full-disk-access":
      return checkFullDiskAccess();
    case "automation":
      return checkAutomation();
    case "notifications":
      return checkNotifications();
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Check all permissions
// ---------------------------------------------------------------------------

const ALL_TYPES: PermissionType[] = [
  "accessibility",
  "screen",
  "microphone",
  "camera",
  "full-disk-access",
  "automation",
  "notifications",
];

async function checkAllPermissions(): Promise<Record<PermissionType, PermissionStatus>> {
  const result = {} as Record<PermissionType, PermissionStatus>;
  for (const type of ALL_TYPES) {
    result[type] = await checkPermission(type);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Request a permission (programmatic or open settings)
// ---------------------------------------------------------------------------

async function requestPermission(
  type: PermissionType,
): Promise<{ status: PermissionStatus; canRequestDirectly: boolean }> {
  if (process.platform !== "darwin") {
    return { status: "granted", canRequestDirectly: true };
  }

  switch (type) {
    case "microphone": {
      try {
        const granted = await systemPreferences.askForMediaAccess("microphone");
        return { status: granted ? "granted" : "denied", canRequestDirectly: true };
      } catch {
        return { status: "denied", canRequestDirectly: false };
      }
    }
    case "camera": {
      try {
        const granted = await systemPreferences.askForMediaAccess("camera");
        return { status: granted ? "granted" : "denied", canRequestDirectly: true };
      } catch {
        return { status: "denied", canRequestDirectly: false };
      }
    }
    case "accessibility": {
      try {
        // isTrustedAccessibilityClient(true) prompts the user and adds the app to the list
        const trusted = systemPreferences.isTrustedAccessibilityClient(true);
        return { status: trusted ? "granted" : "denied", canRequestDirectly: true };
      } catch {
        return { status: "denied", canRequestDirectly: false };
      }
    }
    case "screen": {
      try {
        // Attempting to get screen sources triggers the screen recording permission dialog
        // This will add the app to the Screen Recording list in System Settings
        await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 1, height: 1 },
        });
        const status = checkScreenRecording();
        return { status, canRequestDirectly: true };
      } catch {
        return { status: "denied", canRequestDirectly: false };
      }
    }
    case "automation": {
      try {
        // Running an AppleScript command triggers the Automation permission dialog
        // This will add the app to the Automation list in System Settings
        await new Promise<void>((resolve, reject) => {
          exec(
            "osascript -e 'tell application \"System Events\" to get name of first process'",
            { timeout: 10000 },
            (err) => {
              if (err) reject(err);
              else resolve();
            },
          );
        });
        return { status: "granted", canRequestDirectly: true };
      } catch {
        // The dialog was shown but user may have denied — still counts as "can request directly"
        return { status: "denied", canRequestDirectly: true };
      }
    }
    // These permissions can only be granted via System Settings manually
    case "full-disk-access":
    case "notifications": {
      const status = await checkPermission(type);
      return { status, canRequestDirectly: false };
    }
    default:
      return { status: "unknown", canRequestDirectly: false };
  }
}

// ---------------------------------------------------------------------------
// Open System Preferences to a specific permission pane
// ---------------------------------------------------------------------------

async function openSettings(type: PermissionType): Promise<void> {
  if (process.platform !== "darwin") return;
  const url = SYSTEM_SETTINGS_URLS[type];
  if (!url) return;

  console.log(`[Permissions] Opening System Settings for ${type}: ${url}`);

  // Method 1: exec('open ...') — most reliable on macOS 13+
  try {
    await new Promise<void>((resolve, reject) => {
      exec(`open "${url}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[Permissions] exec open succeeded for ${type}`);
    return;
  } catch (err) {
    console.error(`[Permissions] exec open failed for ${type}:`, err);
  }

  // Method 2: shell.openExternal — Electron built-in
  try {
    await shell.openExternal(url);
    console.log(`[Permissions] shell.openExternal succeeded for ${type}`);
    return;
  } catch (err) {
    console.error(`[Permissions] shell.openExternal failed for ${type}:`, err);
  }

  // Method 3: open general Privacy & Security pane
  try {
    const fallbackUrl = "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension";
    await new Promise<void>((resolve, reject) => {
      exec(`open "${fallbackUrl}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[Permissions] Fallback to general Privacy pane succeeded`);
    return;
  } catch (err) {
    console.error(`[Permissions] All methods failed for ${type}:`, err);
    throw new Error(`Failed to open System Settings for ${type}`);
  }
}

// ---------------------------------------------------------------------------
// Register IPC handlers
// ---------------------------------------------------------------------------

export function registerPermissionsHandlers(): void {
  ipcMain.handle("permissions:checkAll", async () => {
    try {
      return await checkAllPermissions();
    } catch (err) {
      console.error("[Permissions] checkAll failed:", err);
      const fallback = {} as Record<PermissionType, PermissionStatus>;
      for (const type of ALL_TYPES) fallback[type] = "unknown";
      return fallback;
    }
  });

  ipcMain.handle("permissions:check", async (_event, type: PermissionType) => {
    try {
      return await checkPermission(type);
    } catch (err) {
      console.error(`[Permissions] check(${type}) failed:`, err);
      return "unknown";
    }
  });

  ipcMain.handle("permissions:request", async (_event, type: PermissionType) => {
    try {
      return await requestPermission(type);
    } catch (err) {
      console.error(`[Permissions] request(${type}) failed:`, err);
      return { status: "unknown" };
    }
  });

  ipcMain.handle("permissions:openSettings", async (_event, type: PermissionType) => {
    console.log(`[Permissions] IPC permissions:openSettings called with type: ${type}`);
    try {
      await openSettings(type);
    } catch (err) {
      console.error(`[Permissions] openSettings handler failed for ${type}:`, err);
      throw err; // Propagate to renderer so user sees error
    }
  });
}
