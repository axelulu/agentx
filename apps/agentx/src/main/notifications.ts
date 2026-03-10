import { Notification, BrowserWindow } from "electron";
import { readFileSync, existsSync } from "fs";

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

interface NotificationPreferences {
  enabled: boolean;
  scheduledTasks: boolean;
  agentCompletion: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  scheduledTasks: true,
  agentCompletion: true,
};

let prefs: NotificationPreferences = { ...DEFAULT_PREFS };

/**
 * Load notification preferences from the preferences.json file on disk.
 * Called once during initDesktopRuntime().
 */
export function loadNotificationPreferences(prefsPath: string): void {
  try {
    if (existsSync(prefsPath)) {
      const raw = JSON.parse(readFileSync(prefsPath, "utf-8"));
      if (raw.notifications && typeof raw.notifications === "object") {
        prefs = { ...DEFAULT_PREFS, ...raw.notifications };
      }
    }
  } catch {
    // corrupted file — keep defaults
  }
}

/**
 * Called from the preferences:set IPC handler when the renderer updates
 * notification settings. Keeps the in-memory cache in sync.
 */
export function updateNotificationPreferences(updated: Partial<NotificationPreferences>): void {
  prefs = { ...prefs, ...updated };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAnyWindowFocused(): boolean {
  return BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.isFocused());
}

function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function sendToAllWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

// ---------------------------------------------------------------------------
// Notification triggers
// ---------------------------------------------------------------------------

interface ScheduledTaskInfo {
  title: string;
  lastRunResult?: string;
  lastRunError?: string;
}

/**
 * Show a macOS notification when a scheduled task finishes.
 * Only fires when no app window is focused.
 */
export function notifyScheduledTaskCompleted(task: ScheduledTaskInfo): void {
  if (!prefs.enabled || !prefs.scheduledTasks) return;
  if (isAnyWindowFocused()) return;

  const isError = !!task.lastRunError;
  const title = isError ? `\u274C ${task.title}` : `\u2705 ${task.title}`;
  const body = isError
    ? (task.lastRunError ?? "Task failed").slice(0, 120)
    : (task.lastRunResult ?? "Completed successfully").slice(0, 120);

  const notification = new Notification({ title, body });
  notification.on("click", () => {
    focusMainWindow();
  });
  notification.show();
}

/**
 * Show a macOS notification when an agent session completes.
 * Only fires when no app window is focused.
 */
export function notifyAgentCompleted(conversationId: string): void {
  if (!prefs.enabled || !prefs.agentCompletion) return;
  if (isAnyWindowFocused()) return;

  const notification = new Notification({
    title: "Agent Finished",
    body: "Response ready",
  });
  notification.on("click", () => {
    focusMainWindow();
    sendToAllWindows("notification:navigateToConversation", conversationId);
  });
  notification.show();
}
