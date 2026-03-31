/**
 * useStoreSync — Global reactive store synchronization hook.
 *
 * Listens for `{domain}:changed` events from the sidecar and automatically
 * updates Redux state + localStorage mirror. This ensures the UI stays in
 * sync when data is mutated on the sidecar side (e.g., channel auto-config
 * updates, scheduler status changes, cross-process modifications).
 *
 * Must be called once in a top-level component (e.g., ChatPanel).
 */

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { listen } from "@tauri-apps/api/event";
import type { AppDispatch } from "@/slices/store";

// localStorage helpers (mirrors settingsSlice)
const LS_PROVIDERS = "agentx-providers";
const LS_KB = "agentx-knowledgebase";
const LS_MCP = "agentx-mcpservers";
const LS_SKILLS = "agentx-skills";
const LS_CHANNELS = "agentx-channels";
const LS_SCHEDULED = "agentx-scheduled-tasks";
const LS_TOOL_PERMS = "agentx-tool-permissions";
const LS_PREFERENCES = "agentx-preferences";

function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota exceeded — ignore */
  }
}

interface SyncConfig {
  event: string;
  lsKey: string;
  actionType: string;
}

const COLLECTION_SYNCS: SyncConfig[] = [
  { event: "provider:changed", lsKey: LS_PROVIDERS, actionType: "settings/syncProviders" },
  { event: "kb:changed", lsKey: LS_KB, actionType: "settings/syncKnowledgeBase" },
  { event: "mcp:changed", lsKey: LS_MCP, actionType: "settings/syncMCPServers" },
  { event: "skills:changed", lsKey: LS_SKILLS, actionType: "settings/syncInstalledSkills" },
  { event: "channel:changed", lsKey: LS_CHANNELS, actionType: "settings/syncChannels" },
  { event: "scheduler:changed", lsKey: LS_SCHEDULED, actionType: "settings/syncScheduledTasks" },
  {
    event: "toolPermissions:changed",
    lsKey: LS_TOOL_PERMS,
    actionType: "settings/syncToolPermissions",
  },
  {
    event: "preferences:changed",
    lsKey: LS_PREFERENCES,
    actionType: "settings/syncPreferences",
  },
];

export function useStoreSync(): void {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    for (const sync of COLLECTION_SYNCS) {
      listen(sync.event, (event) => {
        const payload = event.payload;
        // Mirror to localStorage
        lsSet(sync.lsKey, payload);
        // Dispatch sync action to Redux
        dispatch({ type: sync.actionType, payload });
      }).then((unlisten) => {
        unlisteners.push(unlisten);
      });
    }

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [dispatch]);
}
