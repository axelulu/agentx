import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Placement = "top" | "bottom" | "top-start" | "bottom-start" | "top-end" | "bottom-end";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Ref to the anchor element that triggers this popover */
  anchorRef: RefObject<HTMLElement | null>;
  /** Where to position relative to anchor */
  placement?: Placement;
  /** Extra CSS class for the popover panel */
  className?: string;
  children: ReactNode;
}

/**
 * Reusable portal-based popover with outside-click/Escape dismiss
 * and viewport-aware positioning.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  placement = "top-start",
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open, onClose, anchorRef]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Position the panel
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return;
    positionPanel(anchorRef.current, panelRef.current, placement);
  }, [open, placement, anchorRef]);

  // Also reposition on scroll/resize
  const reposition = useCallback(() => {
    if (!open || !anchorRef.current || !panelRef.current) return;
    positionPanel(anchorRef.current, panelRef.current, placement);
  }, [open, placement, anchorRef]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-floating-ui
      className={cn(
        "fixed rounded-xl border border-border bg-popover shadow-lg overflow-hidden",
        className,
      )}
      style={{ zIndex: "var(--z-popover)", pointerEvents: "auto" }}
    >
      {children}
    </div>,
    document.body,
  );
}

function positionPanel(anchor: HTMLElement, panel: HTMLElement, placement: Placement) {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const gap = 6;

  let top: number;
  let left: number;

  // Vertical
  const wantsTop = placement.startsWith("top");
  if (wantsTop) {
    top = rect.top - ph - gap;
    if (top < 8) top = rect.bottom + gap; // flip to bottom
  } else {
    top = rect.bottom + gap;
    if (top + ph > vh - 8) top = rect.top - ph - gap; // flip to top
  }

  // Horizontal
  if (placement.endsWith("end")) {
    left = rect.right - pw;
  } else if (placement === "top" || placement === "bottom") {
    left = rect.left + rect.width / 2 - pw / 2;
  } else {
    left = rect.left;
  }

  // Clamp within viewport
  if (left + pw > vw - 8) left = vw - pw - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}
