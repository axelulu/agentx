/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ToolPermissions {
  approvalMode: "auto" | "always-ask" | "smart";
  fileRead: boolean;
  fileWrite: boolean;
  shellExecute: boolean;
  mcpCall: boolean;
  allowedPaths: string[];
}

interface MCPServerState {
  id: string;
  name: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  toolCount: number;
  error?: string;
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
    search: (query: string) => Promise<unknown[]>;
    getSystemPrompt: (id: string) => Promise<string>;
    setSystemPrompt: (id: string, prompt: string) => Promise<void>;
    setFolder: (id: string, folderId: string | null) => Promise<void>;
    setFavorite: (id: string, isFavorite: boolean) => Promise<void>;
    branchInfo: (
      id: string,
    ) => Promise<Record<string, { siblings: string[]; activeIndex: number }>>;
    switchBranch: (id: string, targetMessageId: string) => Promise<void>;
  };
  agent: {
    send: (conversationId: string, content: string) => Promise<void>;
    regenerate: (conversationId: string, assistantMessageId: string) => Promise<void>;
    abort: (conversationId: string) => void;
    onEvent: (callback: (event: unknown) => void) => () => void;
    subscribe: (conversationId: string) => Promise<void>;
    unsubscribe: (conversationId: string) => void;
    status: (conversationId?: string) => Promise<unknown>;
    runningConversations: () => Promise<string[]>;
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
  skills: {
    search: (
      query: string,
      tag?: string,
      perPage?: number,
    ) => Promise<{ skills: unknown[]; total: number }>;
    listInstalled: () => Promise<unknown[]>;
    install: (skill: unknown) => Promise<void>;
    uninstall: (id: string) => Promise<void>;
    getEnabled: (conversationId: string) => Promise<string[]>;
    setEnabled: (conversationId: string, skillIds: string[]) => Promise<void>;
  };
  mcp: {
    list: () => Promise<unknown[]>;
    set: (config: unknown) => Promise<void>;
    remove: (id: string) => void;
    status: () => Promise<MCPServerState[]>;
    reconnect: (id?: string) => Promise<void>;
    onStatusUpdate: (callback: (states: MCPServerState[]) => void) => () => void;
  };
  permissions: {
    checkAll: () => Promise<Record<SystemPermissionType, SystemPermissionStatus>>;
    check: (type: SystemPermissionType) => Promise<SystemPermissionStatus>;
    request: (
      type: SystemPermissionType,
    ) => Promise<{ status: SystemPermissionStatus; canRequestDirectly: boolean }>;
    openSettings: (type: SystemPermissionType) => Promise<void>;
    reset: (type: SystemPermissionType) => Promise<{ success: boolean; requiresManual: boolean }>;
  };
  toolPermissions: {
    get: () => Promise<ToolPermissions>;
    set: (permissions: ToolPermissions) => Promise<void>;
  };
  tool: {
    respondApproval: (
      conversationId: string,
      approvalId: string,
      approved: boolean,
    ) => Promise<void>;
  };
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<boolean>;
    selectFile: (options?: { filters?: unknown[]; multi?: boolean }) => Promise<string[] | null>;
    selectDirectory: () => Promise<string | null>;
    stat: (path: string) => Promise<{ size: number; isDirectory: boolean; isFile: boolean } | null>;
    openPath: (path: string) => Promise<{ success: boolean; error: string | null }>;
    showItemInFolder: (path: string) => Promise<boolean>;
    getDroppedPaths: () => string[];
    showSaveDialog: (options: {
      defaultPath?: string;
      filters?: unknown[];
      title?: string;
    }) => Promise<string | null>;
    writeFileBinary: (path: string, base64Data: string) => Promise<boolean>;
  };
  export: {
    printToPDF: (html: string) => Promise<string>;
  };
  shortcuts: {
    onNewConversation: (cb: () => void) => () => void;
    onSearch: (cb: () => void) => () => void;
    onSettings: (cb: () => void) => () => void;
  };
  preferences: {
    get: () => Promise<Record<string, unknown>>;
    set: (prefs: Record<string, unknown>) => Promise<void>;
  };
  proxy: {
    apply: (url: string | null) => Promise<void>;
  };
  voice: {
    transcribe: (
      audioBuffer: ArrayBuffer,
      language?: string,
    ) => Promise<{ text: string } | { error: string }>;
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
