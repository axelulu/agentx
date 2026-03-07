import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { BotIcon } from "lucide-react";

export function ChatPanel() {
  const { currentConversationId, conversations } = useSelector(
    (state: RootState) => state.chat
  );

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  return (
    <div className="flex flex-col h-full">
      {currentConversation ? (
        <>
          <div className="flex-1 overflow-y-auto">
            <MessageList messages={currentConversation.messages} />
          </div>
          <ChatInput />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <BotIcon className="w-12 h-12 opacity-30" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Welcome to AgentX
            </h2>
            <p className="text-sm">
              Start a new conversation or select one from the sidebar.
            </p>
          </div>
          <ChatInput />
        </div>
      )}
    </div>
  );
}
