import { contextBridge, ipcRenderer } from "electron";

const api = {
  ai: {
    chat: (request: unknown) => ipcRenderer.invoke("ai:chat", request),
    stream: (request: unknown) => {
      ipcRenderer.send("ai:stream", request);
    },
    onStreamData: (callback: (data: { content: string }) => void) => {
      const listener = (_event: unknown, data: { content: string }) =>
        callback(data);
      ipcRenderer.on("ai:stream:data", listener);
      return () => ipcRenderer.removeListener("ai:stream:data", listener);
    },
    onStreamDone: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("ai:stream:done", listener);
      return () => ipcRenderer.removeListener("ai:stream:done", listener);
    },
    onStreamError: (callback: (data: { error: string }) => void) => {
      const listener = (_event: unknown, data: { error: string }) =>
        callback(data);
      ipcRenderer.on("ai:stream:error", listener);
      return () => ipcRenderer.removeListener("ai:stream:error", listener);
    },
    listModels: () => ipcRenderer.invoke("ai:list-models"),
  },
  store: {
    get: (key: string) => ipcRenderer.invoke("store:get", key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke("store:set", key, value),
    delete: (key: string) => ipcRenderer.invoke("store:delete", key),
    clear: () => ipcRenderer.invoke("store:clear"),
  },
  fs: {
    readFile: (path: string) => ipcRenderer.invoke("fs:readFile", path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke("fs:writeFile", path, content),
    selectFile: (options?: { filters?: unknown[]; multi?: boolean }) =>
      ipcRenderer.invoke("fs:selectFile", options),
    selectDirectory: () => ipcRenderer.invoke("fs:selectDirectory"),
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
