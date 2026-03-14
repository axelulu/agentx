/**
 * Tauri IPC Bridge — implements the NativeAPI interface
 * using @tauri-apps/api for Tauri IPC communication.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// ---------------------------------------------------------------------------
// Drag-and-drop path extraction for Tauri
// ---------------------------------------------------------------------------
let _droppedPaths: string[] = [];

async function setupDragDrop(): Promise<void> {
  const currentWindow = getCurrentWebviewWindow();
  await currentWindow.onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      _droppedPaths = event.payload.paths;
    }
  });
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
    remove: (id: string) => {
      invoke("provider_remove", { id });
    },
    setActive: (id: string) => {
      invoke("provider_set_active", { id });
    },
  },

  knowledgeBase: {
    list: () => invoke("kb_list"),
    set: (item: unknown) => invoke("kb_set", { item }),
    remove: (id: string) => {
      invoke("kb_remove", { id });
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
  },

  mcp: {
    list: () => invoke("mcp_list"),
    set: (config: unknown) => invoke("mcp_set", { config }),
    remove: (id: string) => {
      invoke("mcp_remove", { id });
    },
    status: () => invoke("mcp_status"),
    reconnect: (id?: string) => invoke("mcp_reconnect", { id }),
    onStatusUpdate: (callback: (states: MCPServerState[]) => void) => {
      return createEventListener("mcp:statusUpdate", callback as (...args: unknown[]) => void);
    },
  },

  scheduler: {
    list: () => invoke("scheduler_list"),
    set: (task: ScheduledTaskConfig) => invoke("scheduler_set", { task }),
    remove: (id: string) => {
      invoke("scheduler_remove", { id });
    },
    runNow: (id: string) => invoke("scheduler_run_now", { id }),
    onStatusUpdate: (callback: (tasks: ScheduledTaskConfig[]) => void) => {
      return createEventListener(
        "scheduler:statusUpdate",
        callback as (...args: unknown[]) => void,
      );
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
    stat: (path: string) => invoke("fs_stat", { path }),
    openPath: (path: string) => invoke("fs_open_path", { path }),
    showItemInFolder: (path: string) => invoke("fs_show_item_in_folder", { path }),
    getDroppedPaths: () => _droppedPaths,
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

  notifications: {
    onNavigateToConversation: (callback: (conversationId: string) => void) => {
      return createEventListener(
        "notification:navigateToConversation",
        callback as (...args: unknown[]) => void,
      );
    },
  },

  updater: {
    checkForUpdates: () => invoke("updater_check"),
    downloadUpdate: () => invoke("updater_install"),
    installUpdate: () => invoke("updater_install"),
    onStatus: (callback: (status: unknown) => void) => {
      return createEventListener("updater:status", callback);
    },
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
};

// ---------------------------------------------------------------------------
// Initialize the bridge
// ---------------------------------------------------------------------------
export function initBridge(): void {
  (window as unknown as { api: NativeAPI }).api = bridge;

  setupDragDrop().catch((err) => {
    console.error("[Bridge] Failed to setup drag-drop:", err);
  });

  console.log("[Bridge] Initialized");
}
