/**
 * Hook to fetch recent conversations for the Dynamic Island expanded view.
 * Uses window.api bridge directly (standalone window, no Redux).
 */
import { useState, useEffect, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface RecentConversation {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  isFavorite?: boolean;
  source?: string;
  icon?: string;
}

export function useRecentConversations(limit = 6) {
  const [conversations, setConversations] = useState<RecentConversation[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const raw = (await window.api.conversation.list()) as unknown;
      if (!Array.isArray(raw)) return;
      const sorted = (raw as RecentConversation[])
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
      setConversations(sorted);
    } catch {
      // sidecar not ready
    }
  }, [limit]);

  useEffect(() => {
    fetchConversations();

    // Refresh when the island becomes visible
    const win = getCurrentWebviewWindow();
    const unlisten = win.listen("island:ready", () => {
      fetchConversations();
    });

    // Refresh when conversation metadata changes
    const unlistenMeta = window.api.conversation.onMetadataUpdated(() => {
      fetchConversations();
    });

    // Periodic refresh
    const interval = setInterval(fetchConversations, 10000);

    return () => {
      unlisten.then((fn) => fn());
      unlistenMeta();
      clearInterval(interval);
    };
  }, [fetchConversations]);

  return conversations;
}
