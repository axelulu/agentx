import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover } from "./Popover";

export interface DropdownMenuItem {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  iconClassName?: string;
}

interface DropdownMenuProps {
  /** The trigger element — receives ref and onClick */
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement | null>;
    onClick: () => void;
    isOpen: boolean;
  }) => ReactNode;
  items: DropdownMenuItem[];
  placement?: "top-start" | "bottom-start" | "top-end" | "bottom-end";
  className?: string;
}

/**
 * A styled dropdown menu built on the Popover primitive.
 * Handles open/close state, renders items with icons.
 */
export function DropdownMenu({
  trigger,
  items,
  placement = "top-start",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {trigger({ ref: btnRef, onClick: () => setOpen(!open), isOpen: open })}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        placement={placement}
        className={cn("min-w-[180px] py-1.5", className)}
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              item.onClick();
              setOpen(false);
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-foreground/70 hover:text-foreground/90 hover:bg-foreground/[0.05] transition-colors"
          >
            {item.icon && (
              <item.icon className={cn("w-4 h-4 text-muted-foreground/60", item.iconClassName)} />
            )}
            {item.label}
          </button>
        ))}
      </Popover>
    </>
  );
}
