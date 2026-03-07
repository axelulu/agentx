import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setCurrentConversation, removeConversation } from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import { cn } from "@/lib/utils";
import { TrashIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

export function ConversationList() {
  const dispatch = useDispatch<AppDispatch>();
  const { conversations, currentConversationId } = useSelector((state: RootState) => state.chat);

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/50">
        {l10n.t("No conversations yet")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px px-2">
      {conversations.map((conversation) => {
        const isActive = conversation.id === currentConversationId;
        return (
          <div
            key={conversation.id}
            className={cn(
              "group flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 text-[13px]",
              isActive
                ? "bg-foreground/[0.07] text-foreground font-medium"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
            onClick={() => dispatch(setCurrentConversation(conversation.id))}
          >
            <span className="truncate flex-1">{conversation.title}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(removeConversation(conversation.id));
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-foreground/10 transition-all text-muted-foreground hover:text-foreground"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{l10n.t("Delete")}</TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
