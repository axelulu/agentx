/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ToolPermissions {
  approvalMode: "auto" | "always-ask" | "smart";
  fileRead: boolean;
  fileWrite: boolean;
  shellExecute: boolean;
  allowedPaths: string[];
}

type SystemPermissionType =
  | "accessibility"
  | "screen"
  | "microphone"
  | "camera"
  | "full-disk-access"
  | "automation"
  | "notifications";

type SystemPermissionStatus =
  | "granted"
  | "denied"
  | "not-determined"
  | "restricted"
  | "limited"
  | "unknown";

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
  permissions: {
    checkAll: () => Promise<Record<SystemPermissionType, SystemPermissionStatus>>;
    check: (type: SystemPermissionType) => Promise<SystemPermissionStatus>;
    request: (
      type: SystemPermissionType,
    ) => Promise<{ status: SystemPermissionStatus; canRequestDirectly: boolean }>;
    openSettings: (type: SystemPermissionType) => Promise<void>;
  };
  toolPermissions: {
    get: () => Promise<ToolPermissions>;
    set: (permissions: ToolPermissions) => Promise<void>;
  };
  tool: {
    respondApproval: (approvalId: string, approved: boolean) => Promise<void>;
  };
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<boolean>;
    selectFile: (options?: { filters?: unknown[]; multi?: boolean }) => Promise<string[] | null>;
    selectDirectory: () => Promise<string | null>;
    stat: (path: string) => Promise<{ size: number; isDirectory: boolean; isFile: boolean } | null>;
    getDroppedPaths: () => string[];
  };
  updater: {
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onStatus: (callback: (status: unknown) => void) => () => void;
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
