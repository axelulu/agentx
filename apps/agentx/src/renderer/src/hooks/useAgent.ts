import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  handleAgentEvent,
  addUserMessage,
  setError,
  createNewConversation,
  initializeSessions,
} from "@/slices/chatSlice";

/**
 * Register the global agent:event IPC listener exactly ONCE.
 * Call this from a single top-level component (e.g. ChatPanel).
 * Do NOT call from multiple components — it would cause duplicate dispatches.
 *
 * Also handles subscribe/unsubscribe lifecycle when switching conversations,
 * and initializes running session tracking on mount.
 */
export function useAgentEventListener() {
  const dispatch = useDispatch<AppDispatch>();
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);
  const prevConvIdRef = useRef<string | null>(null);

  // Global event listener — always active
  useEffect(() => {
    const cleanup = window.api.agent.onEvent((event) => {
      dispatch(handleAgentEvent(event as Parameters<typeof handleAgentEvent>[0]));
    });
    return cleanup;
  }, [dispatch]);

  // Initialize running sessions on mount
  useEffect(() => {
    dispatch(initializeSessions());
  }, [dispatch]);

  // Subscribe/unsubscribe when conversation changes
  useEffect(() => {
    const prevId = prevConvIdRef.current;

    // Unsubscribe from previous conversation
    if (prevId && prevId !== currentConversationId) {
      window.api.agent.unsubscribe(prevId);
    }

    prevConvIdRef.current = currentConversationId;

    // Cleanup on unmount: unsubscribe from current
    return () => {
      if (currentConversationId) {
        window.api.agent.unsubscribe(currentConversationId);
      }
    };
  }, [currentConversationId]);
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
