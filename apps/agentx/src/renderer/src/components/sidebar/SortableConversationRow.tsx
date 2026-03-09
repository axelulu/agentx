import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
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
      className={cn("relative group/sortable", isDragging && "opacity-40 z-50")}
      {...attributes}
    >
      {!disabled && (
        <button
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 p-0.5 rounded opacity-0 group-hover/sortable:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground transition-opacity"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVerticalIcon className="w-3 h-3" />
        </button>
      )}
      {children}
    </div>
  );
}
