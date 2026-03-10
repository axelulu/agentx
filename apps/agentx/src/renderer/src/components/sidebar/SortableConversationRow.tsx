import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface SortableConversationRowProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}

export function SortableConversationRow({ id, disabled, children }: SortableConversationRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    data: { type: "conversation" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "opacity-40 z-50")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
