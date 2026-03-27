import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  handleAgentEvent,
  addUserMessage,
  setError,
  createNewConversation,
  initializeSessions,
  setBranchInfo,
  loadConversations,
} from "@/slices/chatSlice";
import type { BranchInfoEntry } from "@/slices/chatSlice";
import { openTab } from "@/slices/uiSlice";

// ---------------------------------------------------------------------------
// Module-level subscription tracking shared between hooks.
// This prevents useAgentEventListener and useAgent from double-subscribing
// (which would replay all events and duplicate streaming content).
// ---------------------------------------------------------------------------
const activeSubscriptions = new Set<string>();

/**
 * Register the global agent:event IPC listener exactly ONCE.
 * Call this from a single top-level component (e.g. ChatPanel).
 * Do NOT call from multiple components — it would cause duplicate dispatches.
 *
 * Also handles subscribe/unsubscribe lifecycle for all open tabs
 * with running sessions, and initializes running session tracking on mount.
 */
export function useAgentEventListener() {
  const dispatch = useDispatch<AppDispatch>();
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);
  const openTabs = useSelector((state: RootState) => state.ui.openTabs);
  const runningSessions = useSelector((state: RootState) => state.chat.runningSessions);

  // Global event listener — always active
  useEffect(() => {
    const cleanup = window.api.agent.onEvent((event) => {
      dispatch(handleAgentEvent(event as Parameters<typeof handleAgentEvent>[0]));

      // Refresh branchInfo and conversation list when an agent run ends
      const e = event as { type: string; conversationId?: string };
      if (e.type === "agent_end" && e.conversationId) {
        window.api.conversation
          .branchInfo(e.conversationId)
          .then((info) => {
            dispatch(setBranchInfo((info ?? {}) as Record<string, BranchInfoEntry>));
          })
          .catch(() => {
            /* ignore */
          });

        // Title/icon already generated before agent_end — refresh immediately
        dispatch(loadConversations());
      }
    });
    return cleanup;
  }, [dispatch]);

  // Listen for conversation metadata updates (auto-generated title/icon)
  useEffect(() => {
    const cleanup = window.api.conversation.onMetadataUpdated((data) => {
      console.log("[useAgent] conversation:metadataUpdated received", data);
      dispatch(loadConversations());
    });
    return cleanup;
  }, [dispatch]);

  // Initialize running sessions on mount
  useEffect(() => {
    dispatch(initializeSessions());
  }, [dispatch]);

  // Unmount-only cleanup: unsubscribe from everything
  useEffect(() => {
    return () => {
      for (const id of activeSubscriptions) {
        window.api.agent.unsubscribe(id);
      }
      activeSubscriptions.clear();
    };
  }, []);

  // Subscribe to all open tabs that have running sessions + the current conversation.
  // Uses purely incremental logic — NO cleanup-then-resubscribe cycle, which would
  // cause runtime.subscribe to replay all events and duplicate streaming content.
  useEffect(() => {
    const desired = new Set<string>();

    // Always subscribe to current conversation if it's running
    if (currentConversationId && runningSessions.includes(currentConversationId)) {
      desired.add(currentConversationId);
    }

    // Subscribe to all open tabs with running sessions
    for (const tabId of openTabs) {
      if (runningSessions.includes(tabId)) {
        desired.add(tabId);
      }
    }

    // Subscribe to new ones (skip if already subscribed via sendMessage or prior effect)
    for (const id of desired) {
      if (!activeSubscriptions.has(id)) {
        window.api.agent.subscribe(id);
        activeSubscriptions.add(id);
      }
    }

    // Unsubscribe from ones no longer needed
    for (const id of activeSubscriptions) {
      if (!desired.has(id)) {
        window.api.agent.unsubscribe(id);
        activeSubscriptions.delete(id);
      }
    }
  }, [currentConversationId, openTabs, runningSessions]);
}

/**
 * Provides sendMessage / abort actions and streaming state.
 * Does NOT register event listeners — use useAgentEventListener() for that.
 */
export function useAgent() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentConversationId, isStreaming } = useSelector((state: RootState) => state.chat);

  const sendMessage = useCallback(
    async (content: string | ContentPart[]) => {
      let convId = currentConversationId;
      if (!convId) {
        const conv = await dispatch(createNewConversation()).unwrap();
        convId = conv.id;
        dispatch(openTab(convId));
      }

      // Optimistically add user message to UI
      dispatch(addUserMessage({ conversationId: convId, content }));

      // Fire-and-forget send — events come back through subscriber
      try {
        await window.api.agent.send(convId, content);
        // Subscribe to receive events for this conversation.
        // Uses shared tracking to prevent duplicate subscriptions from the useEffect.
        if (!activeSubscriptions.has(convId)) {
          await window.api.agent.subscribe(convId);
          activeSubscriptions.add(convId);
        }
      } catch (e) {
        dispatch(setError(e instanceof Error ? e.message : String(e)));
      }
    },
    [currentConversationId, dispatch],
  );

  const abort = useCallback(() => {
    if (currentConversationId) {
      window.api.agent.abort(currentConversationId);
    }
  }, [currentConversationId]);

  return { sendMessage, abort, isStreaming };
}
