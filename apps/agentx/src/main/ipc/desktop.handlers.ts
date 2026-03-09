import { ipcMain, BrowserWindow, app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { is } from "@electron-toolkit/utils";
import { DesktopRuntime } from "@workspace/desktop";
import type { DesktopProviderConfig, ToolPermissions } from "@workspace/desktop";
import { setGlobalDispatcher, ProxyAgent, Agent } from "undici";

let runtime: DesktopRuntime;

// ---------------------------------------------------------------------------
// Proxy support — route all main-process fetch() through a proxy
// ---------------------------------------------------------------------------

function applyProxy(url: string | null): void {
  if (url) {
    setGlobalDispatcher(new ProxyAgent(url));
    console.log("[Proxy] Enabled:", url);
  } else {
    setGlobalDispatcher(new Agent());
    console.log("[Proxy] Disabled (direct connection)");
  }
}

// ---------------------------------------------------------------------------
// JSON file helpers for simple key-value stores
// ---------------------------------------------------------------------------

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // corrupted file — return fallback
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function initDesktopRuntime(): Promise<void> {
  runtime = new DesktopRuntime({
    toolkitPath: is.dev
      ? join(app.getAppPath(), "resources", "toolkit")
      : join(process.resourcesPath, "toolkit"),
    language: "en",
    workspacePath: app.getPath("documents"),
    dataPath: join(app.getPath("userData"), "conversations"),
  });
  try {
    await runtime.initialize();
  } catch (err) {
    console.error("[DesktopRuntime] Initialization failed:", err);
    // Re-throw so the caller knows init failed — but IPC handlers are still
    // registered so the window can open and show an appropriate error state.
    throw err;
  }

  // Browser automation: set paths for child processes
  const browserScriptPath = is.dev
    ? join(app.getAppPath(), "resources", "browser", "browser-run.cjs")
    : join(process.resourcesPath, "browser", "browser-run.cjs");
  process.env.AGENTX_BROWSER_SCRIPT = browserScriptPath;

  // Use Electron's own embedded Node.js to run child scripts.
  // In packaged apps, system `node` is often not in PATH (macOS GUI apps
  // don't inherit the user's shell env). ELECTRON_RUN_AS_NODE=1 makes the
  // Electron binary behave as plain Node.js. This env var is checked at
  // process startup, so setting it here only affects child processes —
  // the current Electron main process is already running and unaffected.
  process.env.AGENTX_NODE = process.execPath;
  process.env.ELECTRON_RUN_AS_NODE = "1";

  // Ensure child processes can require('playwright-core')
  const appNodeModules = app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked", "node_modules")
    : join(app.getAppPath(), "node_modules");
  const existingNodePath = process.env.NODE_PATH || "";
  process.env.NODE_PATH = [appNodeModules, existingNodePath]
    .filter(Boolean)
    .join(process.platform === "win32" ? ";" : ":");

  // Restore proxy setting from preferences
  const startupPrefsPath = join(app.getPath("userData"), "preferences.json");
  const startupPrefs = readJsonFile<Record<string, unknown>>(startupPrefsPath, {});
  if (typeof startupPrefs.proxyUrl === "string" && startupPrefs.proxyUrl) {
    applyProxy(startupPrefs.proxyUrl);
  }

  // Restore persisted provider configs into runtime
  const providersPath = join(app.getPath("userData"), "providers.json");
  const savedProviders = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
  for (const config of savedProviders) {
    runtime.setProviderConfig(config);
  }
  const activeProvider = savedProviders.find((p) => p.isActive);
  if (activeProvider) {
    runtime.setActiveProvider(activeProvider.id);
  }
}

export function registerDesktopHandlers(): void {
  // Conversation CRUD
  ipcMain.handle("conversation:create", (_event, title?: string) =>
    runtime.createConversation(title),
  );
  ipcMain.handle("conversation:list", () => runtime.listConversations());
  ipcMain.handle("conversation:delete", (_event, id: string) => runtime.deleteConversation(id));
  ipcMain.handle("conversation:messages", (_event, id: string) => runtime.getMessages(id));
  ipcMain.handle("conversation:updateTitle", (_event, id: string, title: string) =>
    runtime.updateConversationTitle(id, title),
  );

  // ---------------------------------------------------------------------------
  // Agent execution — fire-and-forget send, subscriber-based events
  // ---------------------------------------------------------------------------

  ipcMain.handle("agent:send", async (_event, conversationId: string, content: string) => {
    await runtime.sendMessage(conversationId, content);
  });

  ipcMain.on("agent:abort", (_event, conversationId: string) => runtime.abort(conversationId));

  ipcMain.handle("agent:subscribe", (event, conversationId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    runtime.subscribe(conversationId, (evt) => {
      if (!win.isDestroyed()) {
        win.webContents.send("agent:event", evt);
      }
    });
  });

  ipcMain.on("agent:unsubscribe", (_event, conversationId: string) => {
    runtime.unsubscribe(conversationId);
  });

  ipcMain.handle("agent:status", (_event, conversationId?: string) => {
    return runtime.getSessionStatus(conversationId);
  });

  ipcMain.handle("agent:runningConversations", () => {
    return runtime.getRunningConversations();
  });

  // ---------------------------------------------------------------------------
  // Provider management (JSON file persistence)
  // ---------------------------------------------------------------------------

  const providersPath = join(app.getPath("userData"), "providers.json");

  ipcMain.handle("provider:list", () => {
    return readJsonFile<DesktopProviderConfig[]>(providersPath, []);
  });

  ipcMain.handle("provider:set", (_event, config: DesktopProviderConfig) => {
    const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
    const idx = configs.findIndex((p) => p.id === config.id);
    if (idx >= 0) {
      configs[idx] = config;
    } else {
      configs.push(config);
    }
    writeJsonFile(providersPath, configs);
    runtime.setProviderConfig(config);
  });

  ipcMain.on("provider:remove", (_event, id: string) => {
    const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
    writeJsonFile(
      providersPath,
      configs.filter((p) => p.id !== id),
    );
    runtime.removeProvider(id);
  });

  ipcMain.on("provider:setActive", (_event, id: string) => {
    const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
    for (const p of configs) {
      p.isActive = p.id === id;
    }
    writeJsonFile(providersPath, configs);
    runtime.setActiveProvider(id);
  });

  // ---------------------------------------------------------------------------
  // Knowledge Base (JSON file persistence)
  // ---------------------------------------------------------------------------

  const kbPath = join(app.getPath("userData"), "knowledgebase.json");

  ipcMain.handle("kb:list", () => {
    return readJsonFile<unknown[]>(kbPath, []);
  });

  ipcMain.handle("kb:set", (_event, item: { id: string }) => {
    const items = readJsonFile<{ id: string }[]>(kbPath, []);
    const idx = items.findIndex((k) => k.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    writeJsonFile(kbPath, items);
  });

  ipcMain.on("kb:remove", (_event, id: string) => {
    const items = readJsonFile<{ id: string }[]>(kbPath, []);
    writeJsonFile(
      kbPath,
      items.filter((k) => k.id !== id),
    );
  });

  // ---------------------------------------------------------------------------
  // MCP Servers (JSON file persistence)
  // ---------------------------------------------------------------------------

  const mcpPath = join(app.getPath("userData"), "mcpservers.json");

  ipcMain.handle("mcp:list", () => {
    return readJsonFile<unknown[]>(mcpPath, []);
  });

  ipcMain.handle("mcp:set", (_event, config: { id: string }) => {
    const configs = readJsonFile<{ id: string }[]>(mcpPath, []);
    const idx = configs.findIndex((m) => m.id === config.id);
    if (idx >= 0) {
      configs[idx] = config;
    } else {
      configs.push(config);
    }
    writeJsonFile(mcpPath, configs);
  });

  ipcMain.on("mcp:remove", (_event, id: string) => {
    const configs = readJsonFile<{ id: string }[]>(mcpPath, []);
    writeJsonFile(
      mcpPath,
      configs.filter((m) => m.id !== id),
    );
  });

  // ---------------------------------------------------------------------------
  // Tool Permissions (JSON file persistence — works even if runtime init failed)
  // ---------------------------------------------------------------------------

  const toolPermsPath = join(app.getPath("userData"), "tool-permissions.json");
  const defaultToolPerms: ToolPermissions = {
    approvalMode: "smart",
    fileRead: true,
    fileWrite: true,
    shellExecute: true,
    allowedPaths: [],
  };

  ipcMain.handle("toolPermissions:get", () => {
    return readJsonFile<ToolPermissions>(toolPermsPath, defaultToolPerms);
  });

  ipcMain.handle("toolPermissions:set", (_event, permissions: ToolPermissions) => {
    writeJsonFile(toolPermsPath, permissions);
    // Sync to runtime if available
    try {
      runtime?.setToolPermissions(permissions);
    } catch (err) {
      console.error("[Desktop] Failed to sync tool permissions to runtime:", err);
    }
  });

  // ---------------------------------------------------------------------------
  // User Preferences (theme, language, sidebar — JSON file persistence)
  // ---------------------------------------------------------------------------

  const prefsPath = join(app.getPath("userData"), "preferences.json");
  const defaultPrefs = { theme: "system", language: "en", sidebarOpen: true };

  ipcMain.handle("preferences:get", () => {
    return readJsonFile(prefsPath, defaultPrefs);
  });

  ipcMain.handle("preferences:set", (_event, prefs: Record<string, unknown>) => {
    const current = readJsonFile(prefsPath, defaultPrefs);
    writeJsonFile(prefsPath, { ...current, ...prefs });
    // Apply proxy when proxyUrl preference changes
    if ("proxyUrl" in prefs) {
      applyProxy((prefs.proxyUrl as string) || null);
    }
  });

  // ---------------------------------------------------------------------------
  // Proxy (runtime application)
  // ---------------------------------------------------------------------------

  ipcMain.handle("proxy:apply", (_event, url: string | null) => {
    applyProxy(url || null);
  });

  // ---------------------------------------------------------------------------
  // Tool Approval (renderer responds to approval requests)
  // ---------------------------------------------------------------------------

  ipcMain.handle(
    "tool:respondApproval",
    (_event, conversationId: string, approvalId: string, approved: boolean) => {
      try {
        runtime?.resolveToolApproval(conversationId, approvalId, approved);
      } catch (err) {
        console.error("[Desktop] respondApproval failed:", err);
      }
    },
  );
}
