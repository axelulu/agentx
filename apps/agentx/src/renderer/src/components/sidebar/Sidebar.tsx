import { useDispatch } from "react-redux";
import { createConversation } from "@/slices/chatSlice";
import { ConversationList } from "./ConversationList";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Sidebar() {
  const dispatch = useDispatch();

  return (
    <div className="flex flex-col h-full w-[260px] bg-background">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => dispatch(createConversation())}
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConversationList />
      </div>
    </div>
  );
}
