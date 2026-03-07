import type { Message } from "@/slices/chatSlice";
import { cn } from "@/lib/utils";
import { BotIcon, UserIcon } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
          isUser ? "bg-primary" : "bg-secondary"
        )}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4 text-primary-foreground" />
        ) : (
          <BotIcon className="w-4 h-4 text-secondary-foreground" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content || (
            <span className="inline-block w-2 h-4 bg-current animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}
