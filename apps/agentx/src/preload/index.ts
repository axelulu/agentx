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
          const p = webUtils.getPathForFile(files[i]);
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
  },
  agent: {
    send: (conversationId: string, content: string) =>
      ipcRenderer.invoke("agent:send", conversationId, content),
    abort: (conversationId: string) => ipcRenderer.send("agent:abort", conversationId),
    onEvent: (callback: (event: unknown) => void) => {
      const listener = (_: unknown, event: unknown) => callback(event);
      ipcRenderer.on("agent:event", listener);
      return () => {
        ipcRenderer.removeListener("agent:event", listener);
      };
    },
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
    getDroppedPaths: () => _droppedPaths,
  },
  knowledgeBase: {
    list: () => ipcRenderer.invoke("kb:list"),
    set: (item: unknown) => ipcRenderer.invoke("kb:set", item),
    remove: (id: string) => ipcRenderer.send("kb:remove", id),
  },
  mcp: {
    list: () => ipcRenderer.invoke("mcp:list"),
    set: (config: unknown) => ipcRenderer.invoke("mcp:set", config),
    remove: (id: string) => ipcRenderer.send("mcp:remove", id),
  },
  permissions: {
    checkAll: () => ipcRenderer.invoke("permissions:checkAll"),
    check: (type: string) => ipcRenderer.invoke("permissions:check", type),
    request: (type: string) => ipcRenderer.invoke("permissions:request", type),
    openSettings: (type: string) => ipcRenderer.invoke("permissions:openSettings", type),
  },
  toolPermissions: {
    get: () => ipcRenderer.invoke("toolPermissions:get"),
    set: (permissions: unknown) => ipcRenderer.invoke("toolPermissions:set", permissions),
  },
  tool: {
    respondApproval: (approvalId: string, approved: boolean) =>
      ipcRenderer.invoke("tool:respondApproval", approvalId, approved),
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
