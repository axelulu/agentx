import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "destructive";
  disabled?: boolean;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the main menu
      if (menuRef.current && menuRef.current.contains(target)) return;
      // Check if click is inside a submenu portal (marked with data attribute)
      if (target instanceof HTMLElement && target.closest("[data-context-submenu]")) return;
      onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${Math.max(4, vw - rect.width - 4)}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${Math.max(4, vh - rect.height - 4)}px`;
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      data-floating-ui
      className="fixed min-w-[140px] py-0.5 rounded-lg bg-popover shadow-md overflow-hidden ring-1 ring-foreground/[0.06]"
      style={{ left: x, top: y, zIndex: "var(--z-popover)", pointerEvents: "auto" }}
    >
      {items.map((item, i) =>
        item.submenu && item.submenu.length > 0 ? (
          <SubmenuItem key={i} item={item} onClose={onClose} />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            className={cn(
              "flex items-center gap-1.5 w-full px-2.5 py-1 text-[12px] text-left transition-colors",
              item.disabled
                ? "text-muted-foreground/40 cursor-not-allowed"
                : item.variant === "destructive"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-popover-foreground hover:bg-accent",
            )}
          >
            {item.icon && (
              <span className="w-3.5 h-3.5 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{item.icon}</span>
            )}
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

function SubmenuItem({ item, onClose }: { item: ContextMenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };

  const hide = () => {
    timerRef.current = setTimeout(() => setOpen(false), 150);
  };

  // Position the submenu to the right (or left if no space)
  useEffect(() => {
    if (!open || !rowRef.current || !subRef.current) return;
    const rowRect = rowRef.current.getBoundingClientRect();
    const subEl = subRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer right side
    let left = rowRect.right + 2;
    if (left + subEl.offsetWidth > vw) {
      left = rowRect.left - subEl.offsetWidth - 2;
    }
    let top = rowRect.top;
    if (top + subEl.offsetHeight > vh) {
      top = Math.max(4, vh - subEl.offsetHeight - 4);
    }
    subEl.style.left = `${left}px`;
    subEl.style.top = `${top}px`;
  }, [open]);

  return (
    <div ref={rowRef} onMouseEnter={show} onMouseLeave={hide} className="relative">
      <div
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left transition-colors cursor-default",
          "text-popover-foreground hover:bg-accent",
        )}
      >
        {item.icon && (
          <span className="w-3.5 h-3.5 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{item.icon}</span>
        )}
        <span className="flex-1">{item.label}</span>
        <ChevronRightIcon className="w-3 h-3 text-muted-foreground/50 shrink-0" />
      </div>

      {open &&
        createPortal(
          <div
            ref={subRef}
            data-context-submenu
            onMouseEnter={show}
            onMouseLeave={hide}
            className="fixed min-w-[120px] py-0.5 rounded-lg bg-popover shadow-md overflow-hidden ring-1 ring-foreground/[0.06]"
            style={{ left: 0, top: 0, zIndex: "var(--z-popover-nested)", pointerEvents: "auto" }}
          >
            {item.submenu!.map((sub, j) => (
              <button
                key={j}
                disabled={sub.disabled}
                onClick={() => {
                  if (!sub.disabled) {
                    sub.onClick();
                    onClose();
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 w-full px-2.5 py-1 text-[12px] text-left transition-colors",
                  sub.disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : sub.variant === "destructive"
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-popover-foreground hover:bg-accent",
                )}
              >
                {sub.icon && <span className="w-4 h-4 shrink-0">{sub.icon}</span>}
                {sub.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export interface ContextMenuState {
  x: number;
  y: number;
  targetId: string;
}
