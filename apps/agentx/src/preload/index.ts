import { contextBridge, ipcRenderer } from "electron";

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
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
