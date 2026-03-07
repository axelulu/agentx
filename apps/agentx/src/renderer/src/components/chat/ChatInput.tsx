import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import {
  setInputValue,
  createConversation,
  addMessage,
  appendToLastMessage,
  setIsStreaming,
} from "@/slices/chatSlice";
import { SendIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCallback, useRef, useEffect, type KeyboardEvent } from "react";

export function ChatInput() {
  const dispatch = useDispatch();
  const { inputValue, isStreaming, currentConversationId, conversations } =
    useSelector((state: RootState) => state.chat);
  const settings = useSelector((state: RootState) => state.settings);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const getActiveProvider = useCallback(() => {
    const entries = Object.entries(settings.providers);
    const active = entries.find(([, config]) => config.enabled && config.apiKey);
    if (!active) return null;
    return { id: active[0], ...active[1] };
  }, [settings.providers]);

  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    const provider = getActiveProvider();
    if (!provider) {
      alert("Please configure an AI provider in Settings first.");
      return;
    }

    let conversationId = currentConversationId;
    if (!conversationId) {
      dispatch(createConversation());
      // We need to get the ID from the store after dispatch
      // Since createConversation generates the ID in the reducer,
      // we'll read it back on next render. For now, use a workaround.
      return;
    }

    dispatch(setInputValue(""));

    // Add user message
    dispatch(
      addMessage({
        conversationId,
        message: { role: "user", content },
      })
    );

    // Add empty assistant message
    dispatch(
      addMessage({
        conversationId,
        message: { role: "assistant", content: "" },
      })
    );

    dispatch(setIsStreaming(true));

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

    // Build messages array for context from current Redux state
    const conversation = conversations.find((c) => c.id === conversationId);
    const existingMessages =
      conversation?.messages?.map((m) => ({ role: m.role, content: m.content })) ?? [];

    // Add the new user message (Redux dispatch is sync but state won't update until re-render)
    const messages = [...existingMessages, { role: "user" as const, content }];

    api.ai.stream({
      provider: provider.id,
      model: provider.selectedModel,
      apiKey: provider.apiKey,
      messages,
      stream: true,
    });
  }, [
    inputValue,
    isStreaming,
    currentConversationId,
    conversations,
    dispatch,
    getActiveProvider,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-end gap-2 max-w-3xl mx-auto bg-secondary rounded-2xl px-4 py-3">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => dispatch(setInputValue(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground max-h-[200px]"
          disabled={isStreaming}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming}
          className="shrink-0 h-8 w-8 rounded-full"
        >
          {isStreaming ? (
            <LoaderIcon className="w-4 h-4 animate-spin" />
          ) : (
            <SendIcon className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
