import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Position the dropdown
  useEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panel = panelRef.current;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top = rect.bottom + 4;
    let left = rect.left;

    // Flip upward if not enough space below
    if (top + panel.offsetHeight > vh - 8) {
      top = rect.top - panel.offsetHeight - 4;
    }
    // Keep within viewport horizontally
    if (left + panel.offsetWidth > vw - 8) {
      left = vw - panel.offsetWidth - 8;
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.style.minWidth = `${rect.width}px`;
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground outline-none transition-colors hover:border-border focus:ring-1 focus:ring-ring",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <ChevronDownIcon
          className={cn(
            "w-3 h-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            data-floating-ui
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed rounded-xl border border-border shadow-lg overflow-hidden"
            style={{
              zIndex: "var(--z-popover)",
              pointerEvents: "auto",
              background: "var(--background)",
            }}
          >
            <div className="max-h-[240px] overflow-y-auto py-1">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      close();
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-left transition-colors",
                      isSelected
                        ? "text-foreground bg-foreground/[0.05]"
                        : "text-foreground/80 hover:bg-foreground/[0.04]",
                    )}
                  >
                    <CheckIcon
                      className={cn("w-3 h-3 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
