import { contextBridge, ipcRenderer, webUtils } from "electron";

// ---------------------------------------------------------------------------
// Drag-and-drop path extraction
// ---------------------------------------------------------------------------
// File objects are structurally cloned across the contextBridge boundary,
// which strips Electron's internal path metadata. We intercept the drop event
// in the preload context (capture phase, before the renderer's handler) where
// webUtils.getPathForFile() works on the *original* File objects, cache the
// paths, and let the renderer retrieve them synchronously via getDroppedPaths().
// ---------------------------------------------------------------------------
let _droppedPaths: string[] = [];

// Prevent Electron's default file-drop navigation globally.
// Without this, the browser doesn't treat the window as a valid drop target
// and the `drop` event never fires.
document.addEventListener("dragover", (e) => e.preventDefault(), true);

document.addEventListener(
  "drop",
  (e) => {
    e.preventDefault(); // prevent navigation to the dropped file

    _droppedPaths = [];
    const files = e.dataTransfer?.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        try {
          const p = webUtils.getPathForFile(files[i]!);
          if (p) _droppedPaths.push(p);
        } catch {
          // ignore
        }
      }
    }
  },
  true, // capture phase — runs before renderer's onDrop
);

const api = {
  conversation: {
    create: (title?: string) => ipcRenderer.invoke("conversation:create", title),
    list: () => ipcRenderer.invoke("conversation:list"),
    delete: (id: string) => ipcRenderer.invoke("conversation:delete", id),
    messages: (id: string) => ipcRenderer.invoke("conversation:messages", id),
    updateTitle: (id: string, title: string) =>
      ipcRenderer.invoke("conversation:updateTitle", id, title),
    search: (query: string) => ipcRenderer.invoke("conversation:search", query),
    getSystemPrompt: (id: string) => ipcRenderer.invoke("conversation:getSystemPrompt", id),
    setSystemPrompt: (id: string, prompt: string) =>
      ipcRenderer.invoke("conversation:setSystemPrompt", id, prompt),
    setFolder: (id: string, folderId: string | null) =>
      ipcRenderer.invoke("conversation:setFolder", id, folderId),
    setFavorite: (id: string, isFavorite: boolean) =>
      ipcRenderer.invoke("conversation:setFavorite", id, isFavorite),
    branchInfo: (id: string) => ipcRenderer.invoke("conversation:branchInfo", id),
    switchBranch: (id: string, targetMessageId: string) =>
      ipcRenderer.invoke("conversation:switchBranch", id, targetMessageId),
  },
  agent: {
    send: (conversationId: string, content: string) =>
      ipcRenderer.invoke("agent:send", conversationId, content),
    regenerate: (conversationId: string, assistantMessageId: string) =>
      ipcRenderer.invoke("agent:regenerate", conversationId, assistantMessageId),
    abort: (conversationId: string) => ipcRenderer.send("agent:abort", conversationId),
    onEvent: (callback: (event: unknown) => void) => {
      const listener = (_: unknown, event: unknown) => callback(event);
      ipcRenderer.on("agent:event", listener);
      return () => {
        ipcRenderer.removeListener("agent:event", listener);
      };
    },
    subscribe: (conversationId: string) => ipcRenderer.invoke("agent:subscribe", conversationId),
    unsubscribe: (conversationId: string) => ipcRenderer.send("agent:unsubscribe", conversationId),
    status: (conversationId?: string) => ipcRenderer.invoke("agent:status", conversationId),
    runningConversations: () => ipcRenderer.invoke("agent:runningConversations"),
  },
  provider: {
    list: () => ipcRenderer.invoke("provider:list"),
    set: (config: unknown) => ipcRenderer.invoke("provider:set", config),
    remove: (id: string) => ipcRenderer.send("provider:remove", id),
    setActive: (id: string) => ipcRenderer.send("provider:setActive", id),
  },
  fs: {
    readFile: (path: string) => ipcRenderer.invoke("fs:readFile", path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke("fs:writeFile", path, content),
    selectFile: (options?: { filters?: unknown[]; multi?: boolean }) =>
      ipcRenderer.invoke("fs:selectFile", options),
    selectDirectory: () => ipcRenderer.invoke("fs:selectDirectory"),
    stat: (path: string) => ipcRenderer.invoke("fs:stat", path),
    openPath: (path: string) =>
      ipcRenderer.invoke("fs:openPath", path) as Promise<{
        success: boolean;
        error: string | null;
      }>,
    showItemInFolder: (path: string) => ipcRenderer.invoke("fs:showItemInFolder", path),
    getDroppedPaths: () => _droppedPaths,
    showSaveDialog: (options: { defaultPath?: string; filters?: unknown[]; title?: string }) =>
      ipcRenderer.invoke("fs:showSaveDialog", options) as Promise<string | null>,
    writeFileBinary: (path: string, base64Data: string) =>
      ipcRenderer.invoke("fs:writeFileBinary", path, base64Data) as Promise<boolean>,
  },
  export: {
    printToPDF: (html: string) => ipcRenderer.invoke("export:printToPDF", html) as Promise<string>,
  },
  shortcuts: {
    onNewConversation: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on("shortcut:new-conversation", listener);
      return () => {
        ipcRenderer.removeListener("shortcut:new-conversation", listener);
      };
    },
    onSearch: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on("shortcut:search", listener);
      return () => {
        ipcRenderer.removeListener("shortcut:search", listener);
      };
    },
    onSettings: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on("shortcut:settings", listener);
      return () => {
        ipcRenderer.removeListener("shortcut:settings", listener);
      };
    },
  },
  knowledgeBase: {
    list: () => ipcRenderer.invoke("kb:list"),
    set: (item: unknown) => ipcRenderer.invoke("kb:set", item),
    remove: (id: string) => ipcRenderer.send("kb:remove", id),
  },
  skills: {
    search: (query: string, tag?: string, perPage?: number) =>
      ipcRenderer.invoke("skills:search", query, tag, perPage),
    listInstalled: () => ipcRenderer.invoke("skills:listInstalled"),
    install: (skill: unknown) => ipcRenderer.invoke("skills:install", skill),
    uninstall: (id: string) => ipcRenderer.invoke("skills:uninstall", id),
    getEnabled: (conversationId: string) => ipcRenderer.invoke("skills:getEnabled", conversationId),
    setEnabled: (conversationId: string, skillIds: string[]) =>
      ipcRenderer.invoke("skills:setEnabled", conversationId, skillIds),
  },
  mcp: {
    list: () => ipcRenderer.invoke("mcp:list"),
    set: (config: unknown) => ipcRenderer.invoke("mcp:set", config),
    remove: (id: string) => ipcRenderer.send("mcp:remove", id),
    status: () => ipcRenderer.invoke("mcp:status"),
    reconnect: (id?: string) => ipcRenderer.invoke("mcp:reconnect", id),
    onStatusUpdate: (callback: (states: unknown[]) => void) => {
      const listener = (_: unknown, states: unknown[]) => callback(states);
      ipcRenderer.on("mcp:statusUpdate", listener);
      return () => {
        ipcRenderer.removeListener("mcp:statusUpdate", listener);
      };
    },
  },
  permissions: {
    checkAll: () => ipcRenderer.invoke("permissions:checkAll"),
    check: (type: string) => ipcRenderer.invoke("permissions:check", type),
    request: (type: string) => ipcRenderer.invoke("permissions:request", type),
    openSettings: (type: string) => ipcRenderer.invoke("permissions:openSettings", type),
    reset: (type: string) =>
      ipcRenderer.invoke("permissions:reset", type) as Promise<{
        success: boolean;
        requiresManual: boolean;
      }>,
  },
  toolPermissions: {
    get: () => ipcRenderer.invoke("toolPermissions:get"),
    set: (permissions: unknown) => ipcRenderer.invoke("toolPermissions:set", permissions),
  },
  tool: {
    respondApproval: (conversationId: string, approvalId: string, approved: boolean) =>
      ipcRenderer.invoke("tool:respondApproval", conversationId, approvalId, approved),
  },
  preferences: {
    get: () => ipcRenderer.invoke("preferences:get"),
    set: (prefs: Record<string, unknown>) => ipcRenderer.invoke("preferences:set", prefs),
  },
  proxy: {
    apply: (url: string | null) => ipcRenderer.invoke("proxy:apply", url),
  },
  voice: {
    transcribe: (audioBuffer: ArrayBuffer, language?: string) =>
      ipcRenderer.invoke("voice:transcribe", audioBuffer, language),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke("updater:checkForUpdates"),
    downloadUpdate: () => ipcRenderer.invoke("updater:downloadUpdate"),
    installUpdate: () => ipcRenderer.invoke("updater:installUpdate"),
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_: unknown, status: unknown) => callback(status);
      ipcRenderer.on("updater:status", listener);
      return () => {
        ipcRenderer.removeListener("updater:status", listener);
      };
    },
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
