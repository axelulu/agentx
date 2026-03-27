/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ContentPart {
  type: "text" | "image";
  text?: string;
  data?: string;
  mimeType?: string;
}

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

interface ScheduledTaskConfig {
  id: string;
  title: string;
  description: string;
  schedule: {
    type: "cron" | "interval" | "once";
    cron?: string;
    intervalMs?: number;
    runAt?: string;
  };
  action: {
    type: "shell" | "prompt";
    command?: string;
    prompt?: string;
    timeoutMs?: number;
  };
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunResult?: string;
  lastRunError?: string;
  nextRunAt?: number;
}

interface MemoryConfig {
  enabled: boolean;
  maxSummaries: number;
  maxFacts: number;
  autoExtract: boolean;
}

interface ConversationSummary {
  id: string;
  conversationId: string;
  title: string;
  summary: string;
  topics: string[];
  createdAt: number;
}

interface LearnedFact {
  id: string;
  category: "preference" | "project" | "pattern" | "instruction";
  content: string;
  sourceConversationId: string;
  createdAt: number;
  updatedAt: number;
}

type ChannelType = "telegram" | "discord";
type ChannelStatus = "stopped" | "starting" | "running" | "error";

interface ChannelConfigData {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

interface ChannelStateData {
  id: string;
  type: ChannelType;
  status: ChannelStatus;
  displayName?: string;
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

interface NativeAPI {
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
    send: (conversationId: string, content: string | ContentPart[]) => Promise<void>;
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
  channel: {
    list: () => Promise<ChannelConfigData[]>;
    set: (config: ChannelConfigData) => Promise<void>;
    remove: (id: string) => Promise<void>;
    status: () => Promise<ChannelStateData[]>;
    start: (id: string) => Promise<void>;
    stop: (id: string) => Promise<void>;
    onStatusUpdate: (callback: (states: ChannelStateData[]) => void) => () => void;
    onQRCode: (callback: (data: { channelId: string; qrDataUrl: string }) => void) => () => void;
    onConversationsChanged: (callback: () => void) => () => void;
  };
  scheduler: {
    list: () => Promise<ScheduledTaskConfig[]>;
    set: (task: ScheduledTaskConfig) => Promise<void>;
    remove: (id: string) => void;
    runNow: (id: string) => Promise<void>;
    onStatusUpdate: (callback: (tasks: ScheduledTaskConfig[]) => void) => () => void;
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
  memory: {
    getConfig: () => Promise<MemoryConfig>;
    setConfig: (config: MemoryConfig) => Promise<void>;
    getSummaries: () => Promise<ConversationSummary[]>;
    deleteSummary: (id: string) => Promise<void>;
    getFacts: () => Promise<LearnedFact[]>;
    deleteFact: (id: string) => Promise<void>;
    updateFact: (id: string, content: string) => Promise<LearnedFact | null>;
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
    readFileBase64: (path: string) => Promise<{ data: string; mimeType: string } | null>;
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
  screen: {
    capture: () => Promise<{ data: string; mimeType: string } | null>;
  };
  notifications: {
    onNavigateToConversation: (callback: (conversationId: string) => void) => () => void;
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
  api: NativeAPI;
}
