import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { loadConversations, setInputValue } from "@/slices/chatSlice";
import {
  loadPreferences,
  loadProviders,
  loadKnowledgeBase,
  loadMCPServers,
  loadToolPermissions,
} from "@/slices/settingsSlice";
import { useAgent, useAgentEventListener } from "@/hooks/useAgent";
import { l10n } from "@workspace/l10n";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ToolApprovalBanner } from "./ToolApprovalBanner";

export function ChatPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentConversationId, messages, isStreaming, streamingMessageId } = useSelector(
    (state: RootState) => state.chat,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Register the IPC event listener exactly once here
  useAgentEventListener();

  const { sendMessage } = useAgent();

  useEffect(() => {
    dispatch(loadPreferences());
    dispatch(loadConversations());
    dispatch(loadProviders());
    dispatch(loadKnowledgeBase());
    dispatch(loadMCPServers());
    dispatch(loadToolPermissions());
  }, [dispatch]);

  // Edit: populate input with the user message content
  const handleEdit = useCallback(
    (content: string) => {
      dispatch(setInputValue(content));
    },
    [dispatch],
  );

  // Regenerate: find the last user message before this assistant message and resend
  const handleRegenerate = useCallback(
    (assistantMessageId: string) => {
      const idx = messages.findIndex((m) => m.id === assistantMessageId);
      if (idx < 0) return;
      // Walk backwards to find the preceding user message
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === "user" && messages[i].content) {
          sendMessage(messages[i].content!);
          return;
        }
      }
    },
    [messages, sendMessage],
  );

  return (
    <div className="flex flex-col h-full">
      {currentConversationId ? (
        <>
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingMessageId={streamingMessageId}
              scrollContainerRef={scrollContainerRef}
              onEditMessage={handleEdit}
              onRegenerateMessage={handleRegenerate}
            />
          </div>
          <ToolApprovalBanner />
          <ChatInput />
        </>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center space-y-1.5">
              <h2 className="text-base font-medium text-foreground/80 tracking-tight">
                {l10n.t("AgentX")}
              </h2>
              <p className="text-[13px] text-muted-foreground/70">
                {l10n.t("Start a new conversation to begin.")}
              </p>
            </div>
          </div>
          <ChatInput />
        </>
      )}
    </div>
  );
}
