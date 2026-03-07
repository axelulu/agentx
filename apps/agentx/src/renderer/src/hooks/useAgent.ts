import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  handleAgentEvent,
  addUserMessage,
  setError,
  createNewConversation,
} from "@/slices/chatSlice";

export function useAgent() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentConversationId, isStreaming } = useSelector((state: RootState) => state.chat);

  // Register global agent:event listener (once)
  useEffect(() => {
    const cleanup = window.api.agent.onEvent((event) => {
      dispatch(handleAgentEvent(event as Parameters<typeof handleAgentEvent>[0]));
    });
    return cleanup;
  }, [dispatch]);

  const sendMessage = useCallback(
    async (content: string) => {
      let convId = currentConversationId;
      if (!convId) {
        const conv = await dispatch(createNewConversation()).unwrap();
        convId = conv.id;
      }

      // Optimistically add user message to UI
      dispatch(addUserMessage({ conversationId: convId, content }));

      // Send via IPC — events come back through agent:event listener
      try {
        await window.api.agent.send(convId, content);
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
