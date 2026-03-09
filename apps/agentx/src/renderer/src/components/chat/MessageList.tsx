import type { Message } from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import { MessageBubble } from "./MessageBubble";
import { useEffect, useRef, useCallback, type RefObject } from "react";
import { BotIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NEAR_BOTTOM_THRESHOLD = 300;

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  streamingMessageId?: string | null;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onEditMessage?: (content: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
}

export function MessageList({
  messages,
  isStreaming,
  streamingMessageId,
  scrollContainerRef,
  onEditMessage,
  onRegenerateMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  /** Check if the scroll container is within NEAR_BOTTOM_THRESHOLD of the bottom. */
  const checkNearBottom = useCallback(() => {
    const el = scrollContainerRef?.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD;
  }, [scrollContainerRef]);

  // Track scroll position to update isNearBottom
  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;

    const onScroll = () => {
      isNearBottomRef.current = checkNearBottom();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef, checkNearBottom]);

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {l10n.t("Send a message to start chatting")}
      </div>
    );
  }

  // Show a standalone typing indicator when streaming but no assistant message yet
  const lastMessage = messages[messages.length - 1];
  const needsStandaloneIndicator = isStreaming && lastMessage?.role === "user";

  return (
    <div className="flex flex-col px-6 py-6 max-w-4xl mx-auto">
      {messages.map((message, idx) => {
        const prev = idx > 0 ? messages[idx - 1] : null;
        const isConsecutiveAssistant = message.role === "assistant" && prev?.role === "assistant";
        const isActiveStreamingMessage = isStreaming && message.id === streamingMessageId;
        return (
          <div
            key={message.id}
            className={cn(isConsecutiveAssistant ? "mt-1.5" : idx > 0 ? "mt-5" : "")}
          >
            <MessageBubble
              message={message}
              isStreaming={isStreaming}
              isActiveStreamingMessage={isActiveStreamingMessage}
              isConsecutiveAssistant={isConsecutiveAssistant}
              onEdit={onEditMessage}
              onRegenerate={onRegenerateMessage}
            />
          </div>
        );
      })}

      {/* Typing indicator before assistant message arrives */}
      {needsStandaloneIndicator && (
        <div className="flex gap-3 mt-5 animate-slide-up">
          <div className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 bg-foreground text-background">
            <BotIcon className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1 pt-1.5">
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
