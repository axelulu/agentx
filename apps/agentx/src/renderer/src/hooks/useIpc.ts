import { useCallback } from "react";

export function useIpc() {
  const api = window.api;

  const store = {
    get: useCallback((key: string) => api.store.get(key), [api]),
    set: useCallback(
      (key: string, value: unknown) => api.store.set(key, value),
      [api]
    ),
    delete: useCallback((key: string) => api.store.delete(key), [api]),
    clear: useCallback(() => api.store.clear(), [api]),
  };

  const fs = {
    readFile: useCallback((path: string) => api.fs.readFile(path), [api]),
    writeFile: useCallback(
      (path: string, content: string) => api.fs.writeFile(path, content),
      [api]
    ),
    selectFile: useCallback(
      (options?: { filters?: unknown[]; multi?: boolean }) =>
        api.fs.selectFile(options),
      [api]
    ),
    selectDirectory: useCallback(() => api.fs.selectDirectory(), [api]),
  };

  return { store, fs };
}
