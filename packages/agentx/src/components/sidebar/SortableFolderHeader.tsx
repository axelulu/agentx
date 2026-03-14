import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface SortableFolderHeaderProps {
  id: string;
  folderId: string;
  disabled?: boolean;
  isOverDroppable?: boolean;
  children: ReactNode;
}

export function SortableFolderHeader({
  id,
  folderId,
  disabled,
  isOverDroppable,
  children,
}: SortableFolderHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    data: { type: "folder" },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop::${folderId}`,
    data: { droppableSection: folderId },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const showHighlight = isOver || isOverDroppable;

  return (
    <div
      ref={(node) => {
        setSortableRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-40 z-50",
        showHighlight && "ring-2 ring-primary/30 rounded-md",
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
