/**
 * Tauri IPC Bridge — implements the NativeAPI interface
 * using @tauri-apps/api for Tauri IPC communication.
 */

import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ask } from "@tauri-apps/plugin-dialog";

// ---------------------------------------------------------------------------
// Drag-and-drop: Tauri intercepts native file drops at the window level,
// so browser onDrop events may NOT fire for files dragged from Finder.
// We use Tauri's onDragDropEvent as the primary mechanism and emit
// custom DOM events for components to listen to.
// ---------------------------------------------------------------------------
let _droppedPaths: string[] = [];
type DropCallback = (paths: string[]) => void;
type DragOverCallback = (hovering: boolean) => void;
const _dropCallbacks: Set<DropCallback> = new Set();
const _dragOverCallbacks: Set<DragOverCallback> = new Set();

async function setupDragDrop(): Promise<void> {
  const currentWindow = getCurrentWebviewWindow();
  await currentWindow.onDragDropEvent((event) => {
    const type = event.payload.type;
    if (type === "drop") {
      _droppedPaths = event.payload.paths;
      for (const cb of _dropCallbacks) cb(event.payload.paths);
      for (const cb of _dragOverCallbacks) cb(false);
    } else if (type === "enter") {
      for (const cb of _dragOverCallbacks) cb(true);
    } else if (type === "leave") {
      for (const cb of _dragOverCallbacks) cb(false);
    }
    // "over" fires continuously during drag — ignore to avoid re-renders
  });
}

function onNativeDrop(cb: DropCallback): () => void {
  _dropCallbacks.add(cb);
  return () => {
    _dropCallbacks.delete(cb);
  };
}

function onNativeDragOver(cb: DragOverCallback): () => void {
  _dragOverCallbacks.add(cb);
  return () => {
    _dragOverCallbacks.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// Helper to create event listeners
// ---------------------------------------------------------------------------
function createEventListener(
  eventName: string,
  callback: (...args: unknown[]) => void,
): () => void {
  let unlisten: UnlistenFn | null = null;

  listen(eventName, (event) => {
    callback(event.payload);
  }).then((fn) => {
    unlisten = fn;
  });

  return () => {
    unlisten?.();
  };
}

// ---------------------------------------------------------------------------
// The native bridge
// ---------------------------------------------------------------------------
const bridge: NativeAPI = {
  conversation: {
    create: (title?: string) => invoke("conversation_create", { title }),
    list: () => invoke("conversation_list"),
    delete: (id: string) => invoke("conversation_delete", { id }),
    messages: (id: string) => invoke("conversation_messages", { id }),
    updateTitle: (id: string, title: string) => invoke("conversation_update_title", { id, title }),
    search: (query: string) => invoke("conversation_search", { query }),
    getSystemPrompt: (id: string) => invoke("conversation_get_system_prompt", { id }),
    setSystemPrompt: (id: string, prompt: string) =>
      invoke("conversation_set_system_prompt", { id, prompt }),
    setFolder: (id: string, folderId: string | null) =>
      invoke("conversation_set_folder", { id, folderId }),
    setFavorite: (id: string, isFavorite: boolean) =>
      invoke("conversation_set_favorite", { id, isFavorite }),
    branchInfo: (id: string) => invoke("conversation_branch_info", { id }),
    switchBranch: (id: string, targetMessageId: string) =>
      invoke("conversation_switch_branch", { id, targetMessageId }),
    onMetadataUpdated: (callback: (data: { conversationId: string }) => void) => {
      return createEventListener(
        "conversation:metadataUpdated",
        callback as (...args: unknown[]) => void,
      );
    },
  },

  agent: {
    send: (conversationId: string, content: string | ContentPart[]) =>
      invoke("agent_send", { conversationId, content }),
    regenerate: (conversationId: string, assistantMessageId: string) =>
      invoke("agent_regenerate", { conversationId, assistantMessageId }),
    abort: (conversationId: string) => {
      invoke("agent_abort", { conversationId });
    },
    onEvent: (callback: (event: unknown) => void) => {
      return createEventListener("agent:event", callback);
    },
    subscribe: (conversationId: string) => invoke("agent_subscribe", { conversationId }),
    unsubscribe: (conversationId: string) => {
      invoke("agent_unsubscribe", { conversationId });
    },
    status: (conversationId?: string) => invoke("agent_status", { conversationId }),
    runningConversations: () => invoke("agent_running_conversations"),
  },

  provider: {
    list: () => invoke("provider_list"),
    set: (config: unknown) => invoke("provider_set", { config }),
    remove: (id: string) => invoke("provider_remove", { id }),
    setActive: (id: string) => invoke("provider_set_active", { id }),
    onChanged: (callback: (items: unknown[]) => void) => {
      return createEventListener("provider:changed", callback as (...args: unknown[]) => void);
    },
  },

  knowledgeBase: {
    list: () => invoke("kb_list"),
    set: (item: unknown) => invoke("kb_set", { item }),
    remove: (id: string) => invoke("kb_remove", { id }),
    onChanged: (callback: (items: unknown[]) => void) => {
      return createEventListener("kb:changed", callback as (...args: unknown[]) => void);
    },
  },

  skills: {
    search: (query: string, tag?: string, perPage?: number) =>
      invoke("skills_search", { query, tag, perPage }),
    listInstalled: () => invoke("skills_list_installed"),
    install: (skill: unknown) => invoke("skills_install", { skill }),
    uninstall: (id: string) => invoke("skills_uninstall", { id }),
    getEnabled: (conversationId: string) => invoke("skills_get_enabled", { conversationId }),
    setEnabled: (conversationId: string, skillIds: string[]) =>
      invoke("skills_set_enabled", { conversationId, skillIds }),
    onChanged: (callback: (items: unknown[]) => void) => {
      return createEventListener("skills:changed", callback as (...args: unknown[]) => void);
    },
  },

  mcp: {
    list: () => invoke("mcp_list"),
    set: (config: unknown) => invoke("mcp_set", { config }),
    remove: (id: string) => invoke("mcp_remove", { id }),
    status: () => invoke("mcp_status"),
    reconnect: (id?: string) => invoke("mcp_reconnect", { id }),
    onStatusUpdate: (callback: (states: MCPServerState[]) => void) => {
      return createEventListener("mcp:statusUpdate", callback as (...args: unknown[]) => void);
    },
    onChanged: (callback: (items: unknown[]) => void) => {
      return createEventListener("mcp:changed", callback as (...args: unknown[]) => void);
    },
  },

  channel: {
    list: () => invoke("channel_list"),
    set: (config: ChannelConfigData) => invoke("channel_set", { config }),
    remove: (id: string) => invoke("channel_remove", { id }),
    status: () => invoke("channel_status"),
    start: (id: string) => invoke("channel_start", { id }),
    stop: (id: string) => invoke("channel_stop", { id }),
    onStatusUpdate: (callback: (states: ChannelStateData[]) => void) => {
      return createEventListener("channel:statusUpdate", callback as (...args: unknown[]) => void);
    },
    onQRCode: (callback: (data: { channelId: string; qrDataUrl: string }) => void) => {
      return createEventListener("channel:qrCode", callback as (...args: unknown[]) => void);
    },
    onConversationsChanged: (callback: () => void) => {
      return createEventListener(
        "channel:conversationsChanged",
        callback as (...args: unknown[]) => void,
      );
    },
    onChanged: (callback: (items: unknown[]) => void) => {
      return createEventListener("channel:changed", callback as (...args: unknown[]) => void);
    },
  },

  scheduler: {
    list: () => invoke("scheduler_list"),
    set: (task: ScheduledTaskConfig) => invoke("scheduler_set", { task }),
    remove: (id: string) => invoke("scheduler_remove", { id }),
    runNow: (id: string) => invoke("scheduler_run_now", { id }),
    onStatusUpdate: (callback: (tasks: ScheduledTaskConfig[]) => void) => {
      return createEventListener(
        "scheduler:statusUpdate",
        callback as (...args: unknown[]) => void,
      );
    },
    onChanged: (callback: (items: unknown[]) => void) => {
      return createEventListener("scheduler:changed", callback as (...args: unknown[]) => void);
    },
  },

  permissions: {
    checkAll: () => invoke("permissions_check_all"),
    check: (type: SystemPermissionType) => invoke("permissions_check", { permType: type }),
    request: (type: SystemPermissionType) => invoke("permissions_request", { permType: type }),
    openSettings: (type: SystemPermissionType) =>
      invoke("permissions_open_settings", { permType: type }),
    reset: (type: SystemPermissionType) => invoke("permissions_reset", { permType: type }),
  },

  toolPermissions: {
    get: () => invoke("tool_permissions_get"),
    set: (permissions: ToolPermissions) => invoke("tool_permissions_set", { permissions }),
    onChanged: (callback: (value: unknown) => void) => {
      return createEventListener(
        "toolPermissions:changed",
        callback as (...args: unknown[]) => void,
      );
    },
  },

  memory: {
    getConfig: () => invoke("memory_get_config"),
    setConfig: (config: MemoryConfig) => invoke("memory_set_config", { config }),
    getSummaries: () => invoke("memory_get_summaries"),
    deleteSummary: (id: string) => invoke("memory_delete_summary", { id }),
    getFacts: () => invoke("memory_get_facts"),
    deleteFact: (id: string) => invoke("memory_delete_fact", { id }),
    updateFact: (id: string, content: string) => invoke("memory_update_fact", { id, content }),
  },

  tool: {
    respondApproval: (conversationId: string, approvalId: string, approved: boolean) =>
      invoke("tool_respond_approval", { conversationId, approvalId, approved }),
  },

  fs: {
    readFile: (path: string) => invoke("fs_read_file", { path }),
    writeFile: (path: string, content: string) => invoke("fs_write_file", { path, content }),
    selectFile: (options?: { filters?: unknown[]; multi?: boolean }) =>
      invoke("fs_select_file", { filters: options?.filters, multi: options?.multi }),
    selectDirectory: () => invoke("fs_select_directory"),
    listDir: (path: string) => invoke("fs_list_dir", { path }) as Promise<string[]>,
    stat: (path: string) => invoke("fs_stat", { path }),
    openPath: (path: string) => invoke("fs_open_path", { path }),
    showItemInFolder: (path: string) => invoke("fs_show_item_in_folder", { path }),
    getDroppedPaths: () => _droppedPaths,
    onNativeDrop: (cb: (paths: string[]) => void) => onNativeDrop(cb),
    onNativeDragOver: (cb: (hovering: boolean) => void) => onNativeDragOver(cb),
    showSaveDialog: (options: { defaultPath?: string; filters?: unknown[]; title?: string }) =>
      invoke("fs_show_save_dialog", {
        defaultPath: options.defaultPath,
        title: options.title,
      }),
    writeFileBinary: (path: string, base64Data: string) =>
      invoke("fs_write_file_binary", { path, base64Data }),
    readFileBase64: (path: string) => invoke("fs_read_file_base64", { path }),
  },

  export: {
    printToPDF: async (_html: string) => {
      // In Tauri, use window.print() for PDF export
      window.print();
      return "";
    },
  },

  shortcuts: {
    onNewConversation: (cb: () => void) => {
      return createEventListener("shortcut:new-conversation", cb);
    },
    onSearch: (cb: () => void) => {
      return createEventListener("shortcut:search", cb);
    },
    onSettings: (cb: () => void) => {
      return createEventListener("shortcut:settings", cb);
    },
  },

  preferences: {
    get: () => invoke("preferences_get"),
    set: (prefs: Record<string, unknown>) => invoke("preferences_set", { prefs }),
    onChanged: (callback: (value: unknown) => void) => {
      return createEventListener("preferences:changed", callback as (...args: unknown[]) => void);
    },
  },

  proxy: {
    apply: (url: string | null) => invoke("proxy_apply", { url }),
  },

  voice: {
    transcribe: async (audioBuffer: ArrayBuffer, language?: string) => {
      // Convert ArrayBuffer to base64 for transport
      const bytes = new Uint8Array(audioBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const audioBase64 = btoa(binary);
      return invoke("voice_transcribe", { audioBase64, language });
    },
  },

  screen: {
    capture: () => invoke("screen_capture"),
  },

  ocr: {
    recognize: (imageBase64: string) => invoke("ocr_recognize", { imageBase64 }),
    onTrigger: (callback: () => void) => {
      return createEventListener("ocr:trigger", callback as (...args: unknown[]) => void);
    },
  },

  notifications: {
    onNavigateToConversation: (callback: (conversationId: string) => void) => {
      return createEventListener(
        "notification:navigateToConversation",
        callback as (...args: unknown[]) => void,
      );
    },
  },

  notificationIntelligence: {
    getConfig: () => invoke("ni_get_config"),
    setConfig: (config: NotificationIntelligenceConfig) => invoke("ni_set_config", { config }),
    fetch: () => invoke("ni_fetch"),
    classify: (notifications: MacNotification[]) => invoke("ni_classify", { notifications }),
    start: () => invoke("ni_start"),
    stop: () => invoke("ni_stop"),
    markRead: (ids: string[]) => invoke("ni_mark_read", { ids }),
    openApp: (bundleId: string) => invoke("ni_open_app", { bundleId }),
    onUpdate: (callback: (notifications: MacNotification[]) => void) => {
      return createEventListener("ni:update", callback as (...args: unknown[]) => void);
    },
  },

  updater: {
    checkForUpdates: () => invoke("updater_check"),
    downloadUpdate: () => invoke("updater_install"),
    installUpdate: () => invoke("updater_restart"),
    onStatus: (callback: (status: unknown) => void) => {
      return createEventListener("updater:status", callback);
    },
  },

  systemHealth: {
    snapshot: () => invoke("system_health_snapshot"),
  },

  window: {
    minimize: () => {
      invoke("window_minimize");
    },
    maximize: () => {
      invoke("window_maximize");
    },
    close: () => {
      invoke("window_close");
    },
  },

  shortcut: {
    getPalette: () => invoke("shortcut_get_palette") as Promise<string>,
    setPalette: (shortcut: string) => invoke("shortcut_set_palette", { shortcut }) as Promise<void>,
    set: (id: string, shortcut: string) =>
      invoke("shortcut_set", { id, shortcut }) as Promise<void>,
    check: (shortcut: string) => invoke("shortcut_check", { shortcut }) as Promise<boolean>,
    validate: (shortcut: string) => invoke("shortcut_validate", { shortcut }) as Promise<boolean>,
    listAll: () =>
      invoke("shortcut_list_all") as Promise<
        { id: string; shortcut: string; defaultShortcut: string; label: string }[]
      >,
  },

  terminal: {
    create: (sessionId: string, cols: number, rows: number, cwd?: string) =>
      invoke("terminal_create", { sessionId, cols, rows, cwd }) as Promise<void>,
    write: (sessionId: string, data: string) => {
      invoke("terminal_write", { sessionId, data });
    },
    resize: (sessionId: string, cols: number, rows: number) => {
      invoke("terminal_resize", { sessionId, cols, rows });
    },
    destroy: (sessionId: string) => invoke("terminal_destroy", { sessionId }) as Promise<void>,
    onData: (cb: (event: { sessionId: string; data: string }) => void) => {
      return createEventListener("terminal:data", cb as (...args: unknown[]) => void);
    },
    onExit: (cb: (event: { sessionId: string; exitCode: number }) => void) => {
      return createEventListener("terminal:exit", cb as (...args: unknown[]) => void);
    },
  },

  share: {
    isInstalled: () => invoke("share_is_installed") as Promise<boolean>,
    checkPending: () => invoke("share_check_pending") as Promise<void>,
    onAction: (
      callback: (action: {
        timestamp: number;
        items: Array<{ type: string; text?: string; url?: string; path?: string; name?: string }>;
      }) => void,
    ) => {
      return createEventListener("share:action", callback as (...args: unknown[]) => void);
    },
  },

  finder: {
    isInstalled: () => invoke("finder_is_installed") as Promise<boolean>,
    install: () => invoke("finder_install") as Promise<void>,
    uninstall: () => invoke("finder_uninstall") as Promise<void>,
    checkPending: () => invoke("finder_check_pending") as Promise<void>,
    onAction: (callback: (action: { action: string; files: string[] }) => void) => {
      return createEventListener("finder:action", callback as (...args: unknown[]) => void);
    },
  },

  fileTags: {
    get: (path: string) => invoke("file_tags_get", { path }),
    set: (path: string, tags: string[]) => invoke("file_tags_set", { path, tags }),
    setComment: (path: string, comment: string) =>
      invoke("file_tags_set_comment", { path, comment }),
    getMetadata: (path: string) => invoke("file_tags_get_metadata", { path }),
    analyze: (path: string) => invoke("file_tags_analyze", { path }),
    analyzeBatch: (paths: string[]) => invoke("file_tags_analyze_batch", { paths }),
  },

  dropDetect: {
    detectContentType: (text?: string, filePaths?: string[], html?: string) =>
      invoke("detect_drop_content_type", { text, filePaths, html }),
  },
};

// ---------------------------------------------------------------------------
// Initialize the bridge
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Quit confirmation — listens for app:quit-confirm from Rust, shows a
// native dialog with localised strings, and emits app:quit-confirmed if
// the user agrees.
// ---------------------------------------------------------------------------
async function setupQuitConfirmation(): Promise<void> {
  // Only listen in the main window to avoid duplicate dialogs
  if (getCurrentWebviewWindow().label !== "main") return;
  const { l10n } = await import("@agentx/l10n");
  await listen("app:quit-confirm", async () => {
    const confirmed = await ask(
      l10n.t(
        "Quitting AgentX will stop all background automations, channels, and scheduled tasks.",
      ),
      {
        title: l10n.t("Quit AgentX"),
        kind: "warning",
        okLabel: l10n.t("Quit"),
        cancelLabel: l10n.t("Cancel"),
      },
    );
    if (confirmed) {
      await emit("app:quit-confirmed", {});
    }
  });
}

// ---------------------------------------------------------------------------
// Sidecar readiness — the frontend must wait for this before loading data
// ---------------------------------------------------------------------------

let _sidecarReady = false;
let _sidecarReadyResolvers: Array<() => void> = [];
let _sidecarReadyCallbacks: Array<() => void> = [];

/** Returns a promise that resolves when the sidecar is ready. */
export function waitForSidecar(): Promise<void> {
  if (_sidecarReady) return Promise.resolve();
  return new Promise<void>((resolve) => {
    _sidecarReadyResolvers.push(resolve);
  });
}

/** Register a callback that fires on every sidecar:ready (including restarts). */
export function onSidecarReady(cb: () => void): () => void {
  _sidecarReadyCallbacks.push(cb);
  return () => {
    _sidecarReadyCallbacks = _sidecarReadyCallbacks.filter((c) => c !== cb);
  };
}

function markSidecarReady(): void {
  _sidecarReady = true;
  for (const resolve of _sidecarReadyResolvers) resolve();
  _sidecarReadyResolvers = [];
  for (const cb of _sidecarReadyCallbacks) {
    try {
      cb();
    } catch {}
  }
}

function setupSidecarReady(): void {
  listen("sidecar:ready", () => {
    console.log("[Bridge] Sidecar ready");
    markSidecarReady();
  });

  // Fallback: if sidecar:ready event doesn't arrive within 15s, resolve anyway
  // (the sidecar's wait_ready mechanism will still block IPC calls until ready)
  setTimeout(() => {
    if (!_sidecarReady) {
      console.warn("[Bridge] Sidecar ready timeout — proceeding anyway");
      markSidecarReady();
    }
  }, 15000);
}

export function initBridge(): void {
  (window as unknown as { api: NativeAPI }).api = bridge;

  setupSidecarReady();

  setupDragDrop().catch((err) => {
    console.error("[Bridge] Failed to setup drag-drop:", err);
  });

  setupQuitConfirmation().catch((err) => {
    console.error("[Bridge] Failed to setup quit confirmation:", err);
  });

  console.log("[Bridge] Initialized");
}
