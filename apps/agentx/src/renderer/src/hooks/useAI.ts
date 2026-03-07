import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import {
  addMessage,
  appendToLastMessage,
  setIsStreaming,
  createConversation,
} from "@/slices/chatSlice";

export function useAI() {
  const dispatch = useDispatch();
  const { currentConversationId, conversations, isStreaming } = useSelector(
    (state: RootState) => state.chat
  );
  const settings = useSelector((state: RootState) => state.settings);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, []);

  const getActiveProvider = useCallback(() => {
    const entries = Object.entries(settings.providers);
    const active = entries.find(([, config]) => config.enabled && config.apiKey);
    if (!active) return null;
    return { id: active[0], ...active[1] };
  }, [settings.providers]);

  const sendMessage = useCallback(
    async (content: string) => {
      const provider = getActiveProvider();
      if (!provider) {
        throw new Error("No AI provider configured. Please add an API key in Settings.");
      }

      let conversationId = currentConversationId;
      if (!conversationId) {
        dispatch(createConversation());
        // Get the new conversation ID from state after creation
        // Since Redux dispatch is synchronous, we can read from the action
        const newConversation = { id: "" };
        // We need to create and then get the ID
        dispatch(createConversation());
        return;
      }

      // Add user message
      dispatch(
        addMessage({
          conversationId,
          message: { role: "user", content },
        })
      );

      // Add placeholder assistant message
      dispatch(
        addMessage({
          conversationId,
          message: { role: "assistant", content: "" },
        })
      );

      dispatch(setIsStreaming(true));

      // Get conversation messages for context
      const conversation = conversations.find((c) => c.id === conversationId);
      const messages =
        conversation?.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? [];

      // Remove the empty assistant message from context
      messages.pop();

      // Clean up previous listeners
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];

      const api = window.api;

      const removeData = api.ai.onStreamData((data) => {
        dispatch(
          appendToLastMessage({
            conversationId: conversationId!,
            content: data.content,
          })
        );
      });

      const removeDone = api.ai.onStreamDone(() => {
        dispatch(setIsStreaming(false));
        cleanupRef.current.forEach((fn) => fn());
        cleanupRef.current = [];
      });

      const removeError = api.ai.onStreamError((data) => {
        dispatch(
          appendToLastMessage({
            conversationId: conversationId!,
            content: `\n\nError: ${data.error}`,
          })
        );
        dispatch(setIsStreaming(false));
        cleanupRef.current.forEach((fn) => fn());
        cleanupRef.current = [];
      });

      cleanupRef.current = [removeData, removeDone, removeError];

      // Start streaming
      api.ai.stream({
        provider: provider.id,
        model: provider.selectedModel,
        apiKey: provider.apiKey,
        messages,
        stream: true,
      });
    },
    [
      currentConversationId,
      conversations,
      dispatch,
      getActiveProvider,
    ]
  );

  return {
    sendMessage,
    isStreaming,
    getActiveProvider,
  };
}
