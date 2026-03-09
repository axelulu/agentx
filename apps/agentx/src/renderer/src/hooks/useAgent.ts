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
} from "@/slices/chatSlice";
import type { BranchInfoEntry } from "@/slices/chatSlice";
import { openTab } from "@/slices/uiSlice";

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
  const subscribedRef = useRef<Set<string>>(new Set());

  // Global event listener — always active
  useEffect(() => {
    const cleanup = window.api.agent.onEvent((event) => {
      dispatch(handleAgentEvent(event as Parameters<typeof handleAgentEvent>[0]));

      // Refresh branchInfo when an agent run ends for the current conversation
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
      }
    });
    return cleanup;
  }, [dispatch]);

  // Initialize running sessions on mount
  useEffect(() => {
    dispatch(initializeSessions());
  }, [dispatch]);

  // Subscribe to all open tabs that have running sessions + the current conversation
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

    const current = subscribedRef.current;

    // Subscribe to new ones
    for (const id of desired) {
      if (!current.has(id)) {
        window.api.agent.subscribe(id);
      }
    }

    // Unsubscribe from ones no longer needed
    for (const id of current) {
      if (!desired.has(id)) {
        window.api.agent.unsubscribe(id);
      }
    }

    subscribedRef.current = desired;

    // Cleanup on unmount: unsubscribe from all
    return () => {
      for (const id of subscribedRef.current) {
        window.api.agent.unsubscribe(id);
      }
      subscribedRef.current = new Set();
    };
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
    async (content: string) => {
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
        // Subscribe to receive events for this conversation
        await window.api.agent.subscribe(convId);
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
