/// <reference types="vite/client" />

interface ElectronAPI {
  conversation: {
    create: (title?: string) => Promise<unknown>;
    list: () => Promise<unknown[]>;
    delete: (id: string) => Promise<void>;
    messages: (id: string) => Promise<unknown[]>;
    updateTitle: (id: string, title: string) => Promise<unknown>;
  };
  agent: {
    send: (conversationId: string, content: string) => Promise<void>;
    abort: (conversationId: string) => void;
    onEvent: (callback: (event: unknown) => void) => () => void;
  };
  provider: {
    list: () => Promise<unknown[]>;
    set: (config: unknown) => Promise<void>;
    remove: (id: string) => void;
    setActive: (id: string) => void;
  };
  knowledgeBase: {
    list: () => Promise<unknown[]>;
    set: (item: unknown) => Promise<void>;
    remove: (id: string) => void;
  };
  mcp: {
    list: () => Promise<unknown[]>;
    set: (config: unknown) => Promise<void>;
    remove: (id: string) => void;
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
