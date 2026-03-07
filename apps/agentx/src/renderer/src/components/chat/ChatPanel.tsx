import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { loadConversations, loadMessages } from "@/slices/chatSlice";
import { loadProviders, loadKnowledgeBase, loadMCPServers } from "@/slices/settingsSlice";
import { l10n } from "@workspace/l10n";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentConversationId, messages } = useSelector((state: RootState) => state.chat);

  useEffect(() => {
    dispatch(loadConversations());
    dispatch(loadProviders());
    dispatch(loadKnowledgeBase());
    dispatch(loadMCPServers());
  }, [dispatch]);

  useEffect(() => {
    if (currentConversationId) {
      dispatch(loadMessages(currentConversationId));
    }
  }, [currentConversationId, dispatch]);

  return (
    <div className="flex flex-col h-full">
      {currentConversationId ? (
        <>
          <div className="flex-1 overflow-y-auto">
            <MessageList messages={messages} />
          </div>
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
