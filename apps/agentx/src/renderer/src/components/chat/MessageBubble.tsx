import { useState } from "react";
import type { Message } from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import { cn } from "@/lib/utils";
import { BotIcon, UserIcon, WrenchIcon, ChevronRightIcon } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  if (isTool) {
    return <ToolResultBubble message={message} />;
  }

  return (
    <div className="flex gap-3 animate-slide-up">
      {/* Avatar */}
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5",
          isUser ? "bg-foreground/[0.08]" : "bg-foreground text-background",
        )}
      >
        {isUser ? (
          <UserIcon className="w-3 h-3 text-foreground/50" />
        ) : (
          <BotIcon className="w-3 h-3" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.toolCalls.map((tc) => (
              <span
                key={tc.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-foreground/[0.05] text-muted-foreground"
              >
                <WrenchIcon className="w-2.5 h-2.5" />
                {tc.name}
              </span>
            ))}
          </div>
        )}

        {/* Message text */}
        <div
          className={cn(
            "text-[13px] leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "bg-foreground/[0.05] rounded-2xl rounded-tl-md px-4 py-2.5 w-fit max-w-[90%]"
              : "text-foreground",
          )}
        >
          {message.content || (
            <span className="inline-block w-1.5 h-4 bg-foreground/30 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolResultBubble({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const content = message.content ?? "";
  const isLong = content.length > 200;

  return (
    <div className="flex gap-3 animate-slide-up">
      {/* Avatar spacer */}
      <div className="w-6 shrink-0" />

      <div
        className={cn(
          "rounded-lg px-3 py-2 text-xs max-w-[90%]",
          message.isError
            ? "bg-destructive/[0.06] text-destructive"
            : "bg-foreground/[0.03] text-muted-foreground",
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 font-medium mb-0.5"
        >
          <ChevronRightIcon
            className={cn("w-3 h-3 transition-transform duration-150", expanded && "rotate-90")}
          />
          {l10n.t("Tool result")}
        </button>
        {(expanded || !isLong) && (
          <div className="whitespace-pre-wrap break-words font-mono mt-1 text-[11px] leading-relaxed opacity-80">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
