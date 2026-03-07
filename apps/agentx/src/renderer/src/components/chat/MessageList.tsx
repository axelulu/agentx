import type { Message } from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import { MessageBubble } from "./MessageBubble";
import { useEffect, useRef } from "react";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {l10n.t("Send a message to start chatting")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-6 py-6 max-w-4xl mx-auto">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
