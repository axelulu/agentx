/// <reference types="vite/client" />

interface ElectronAPI {
  ai: {
    chat: (request: unknown) => Promise<unknown>;
    stream: (request: unknown) => void;
    onStreamData: (callback: (data: { content: string }) => void) => () => void;
    onStreamDone: (callback: () => void) => () => void;
    onStreamError: (callback: (data: { error: string }) => void) => () => void;
    listModels: () => Promise<unknown>;
  };
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
  };
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<boolean>;
    selectFile: (options?: { filters?: unknown[]; multi?: boolean }) => Promise<string[] | null>;
    selectDirectory: () => Promise<string | null>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}

interface Window {
  api: ElectronAPI;
}
