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

interface SystemHealthSnapshot {
  timestamp: number;
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
    temperatureCelsius: number | null;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
    swapUsedBytes: number;
    swapTotalBytes: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
    mountPoint: string;
  };
  battery: {
    present: boolean;
    percent: number;
    charging: boolean;
    timeRemaining: string | null;
  } | null;
  network: {
    interfaceName: string;
    bytesIn: number;
    bytesOut: number;
  }[];
  topProcesses: {
    pid: number;
    name: string;
    cpuPercent: number;
    memoryMB: number;
  }[];
  loadAverage: number[];
  uptime: string;
}

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
    onMetadataUpdated: (callback: (data: { conversationId: string }) => void) => () => void;
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
    remove: (id: string) => Promise<void>;
    setActive: (id: string) => Promise<void>;
  };
  knowledgeBase: {
    list: () => Promise<unknown[]>;
    set: (item: unknown) => Promise<void>;
    remove: (id: string) => Promise<void>;
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
    remove: (id: string) => Promise<void>;
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
    remove: (id: string) => Promise<void>;
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
    reset: (type: SystemPermissionType) => Promise<{ tccutilOk: boolean; needsRestart: boolean }>;
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
    listDir: (path: string) => Promise<string[]>;
    stat: (path: string) => Promise<{ size: number; isDirectory: boolean; isFile: boolean } | null>;
    openPath: (path: string) => Promise<{ success: boolean; error: string | null }>;
    showItemInFolder: (path: string) => Promise<boolean>;
    getDroppedPaths: () => string[];
    onNativeDrop: (cb: (paths: string[]) => void) => () => void;
    onNativeDragOver: (cb: (hovering: boolean) => void) => () => void;
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
  ocr: {
    /** Run OCR on base64 image data, returns recognized text */
    recognize: (imageBase64: string) => Promise<{ text: string }>;
    /** Listen for OCR shortcut trigger (Option+O) */
    onTrigger: (callback: () => void) => () => void;
  };
  notifications: {
    onNavigateToConversation: (callback: (conversationId: string) => void) => () => void;
  };
  notificationIntelligence: {
    getConfig: () => Promise<NotificationIntelligenceConfig>;
    setConfig: (config: NotificationIntelligenceConfig) => Promise<void>;
    fetch: () => Promise<MacNotification[]>;
    classify: (notifications: MacNotification[]) => Promise<MacNotification[]>;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    markRead: (ids: string[]) => Promise<void>;
    openApp: (bundleId: string) => Promise<{ success: boolean; error?: string }>;
    onUpdate: (callback: (notifications: MacNotification[]) => void) => () => void;
  };
  updater: {
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onStatus: (callback: (status: unknown) => void) => () => void;
  };
  systemHealth: {
    snapshot: () => Promise<SystemHealthSnapshot>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  shortcut: {
    getPalette: () => Promise<string>;
    setPalette: (shortcut: string) => Promise<void>;
    set: (id: string, shortcut: string) => Promise<void>;
    check: (shortcut: string) => Promise<boolean>;
    validate: (shortcut: string) => Promise<boolean>;
    listAll: () => Promise<
      { id: string; shortcut: string; defaultShortcut: string; label: string }[]
    >;
  };
  terminal: {
    create: (sessionId: string, cols: number, rows: number, cwd?: string) => Promise<void>;
    write: (sessionId: string, data: string) => void;
    resize: (sessionId: string, cols: number, rows: number) => void;
    destroy: (sessionId: string) => Promise<void>;
    onData: (cb: (event: { sessionId: string; data: string }) => void) => () => void;
    onExit: (cb: (event: { sessionId: string; exitCode: number }) => void) => () => void;
  };
  share: {
    isInstalled: () => Promise<boolean>;
    checkPending: () => Promise<void>;
    onAction: (
      callback: (action: {
        timestamp: number;
        items: Array<{
          type: string;
          text?: string;
          url?: string;
          path?: string;
          name?: string;
        }>;
      }) => void,
    ) => () => void;
  };
  finder: {
    isInstalled: () => Promise<boolean>;
    install: () => Promise<void>;
    uninstall: () => Promise<void>;
    checkPending: () => Promise<void>;
    onAction: (callback: (action: { action: string; files: string[] }) => void) => () => void;
  };
  fileTags: {
    get: (path: string) => Promise<FileTagsInfo>;
    set: (path: string, tags: string[]) => Promise<void>;
    setComment: (path: string, comment: string) => Promise<void>;
    getMetadata: (path: string) => Promise<Record<string, string>>;
    analyze: (path: string) => Promise<FileAnalysisResult>;
    analyzeBatch: (paths: string[]) => Promise<Record<string, FileAnalysisResult>>;
  };
  dropDetect: {
    detectContentType: (
      text?: string,
      filePaths?: string[],
      html?: string,
    ) => Promise<DropContentDetection>;
  };
}

// ---------------------------------------------------------------------------
// Notification Intelligence types
// ---------------------------------------------------------------------------

type NotificationCategory = "urgent" | "important" | "normal" | "spam";

interface MacNotification {
  id: string;
  appId: string;
  appName: string;
  title: string;
  subtitle: string;
  body: string;
  deliveredAt: number;
  category?: NotificationCategory;
  categoryReason?: string;
  read: boolean;
}

interface NotificationIntelligenceConfig {
  enabled: boolean;
  pollingIntervalMs: number;
  autoClassify: boolean;
  rules: NotificationRule[];
}

interface NotificationRule {
  id: string;
  appId?: string;
  keyword?: string;
  category: NotificationCategory;
}

// ---------------------------------------------------------------------------
// File Tags & Spotlight types
// ---------------------------------------------------------------------------

interface FileTagsInfo {
  tags: string[];
  comment: string;
  agentxAnalysis: FileAnalysisResult | null;
}

interface FileAnalysisResult {
  tags: string[];
  summary: string;
  category: string;
  language?: string;
  topics?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Drop Content Detection types
// ---------------------------------------------------------------------------

type DropContentType = "files" | "url" | "code" | "text" | "html" | "unknown";

type DropAction =
  | "explain"
  | "optimize"
  | "review"
  | "debug"
  | "convert"
  | "describe"
  | "edit"
  | "analyze"
  | "tag"
  | "summarize"
  | "translate"
  | "rewrite"
  | "expand"
  | "fetch"
  | "bookmark"
  | "extract_text";

interface DropContentDetection {
  contentType: DropContentType;
  actions: DropAction[];
  info: Record<string, unknown>;
}

interface Window {
  api: NativeAPI;
}
