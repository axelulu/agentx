import { ipcMain, BrowserWindow, app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { DesktopRuntime } from "@workspace/desktop";
import type { DesktopProviderConfig } from "@workspace/desktop";

let runtime: DesktopRuntime;

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
    toolkitPath: join(app.getAppPath(), "resources", "toolkit"),
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

  // Agent execution
  ipcMain.handle("agent:send", async (event, conversationId: string, content: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    await runtime.sendMessage(conversationId, content, (evt) => {
      win?.webContents.send("agent:event", evt);
    });
  });
  ipcMain.on("agent:abort", (_event, conversationId: string) => runtime.abort(conversationId));

  // Provider management
  ipcMain.handle("provider:set", (_event, config: DesktopProviderConfig) => {
    runtime.setProviderConfig(config);
  });
  ipcMain.on("provider:remove", (_event, id: string) => runtime.removeProvider(id));
  ipcMain.on("provider:setActive", (_event, id: string) => runtime.setActiveProvider(id));
  ipcMain.handle("provider:list", () => runtime.getProviderConfigs());

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
}
