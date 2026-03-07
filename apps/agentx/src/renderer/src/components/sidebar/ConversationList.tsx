import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import {
  setCurrentConversation,
  deleteConversation,
} from "@/slices/chatSlice";
import { cn } from "@/lib/utils";
import { MessageSquareIcon, TrashIcon } from "lucide-react";

export function ConversationList() {
  const dispatch = useDispatch();
  const { conversations, currentConversationId } = useSelector(
    (state: RootState) => state.chat
  );

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={cn(
            "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
            conversation.id === currentConversationId
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50 text-muted-foreground"
          )}
          onClick={() =>
            dispatch(setCurrentConversation(conversation.id))
          }
        >
          <MessageSquareIcon className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{conversation.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch(deleteConversation(conversation.id));
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-all"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
