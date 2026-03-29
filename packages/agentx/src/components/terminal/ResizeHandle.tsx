import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { setTerminalHeight } from "@/slices/uiSlice";

export function ResizeHandle() {
  const dispatch = useDispatch();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const container = (e.target as HTMLElement).parentElement;
      if (!container) return;

      // The terminal panel is below us — get its current height
      const terminalEl = container.querySelector("[data-terminal-panel]") as HTMLElement | null;
      const startHeight = terminalEl?.offsetHeight ?? 250;

      // Reserve minimum 200px for chat area above
      const containerHeight = container.offsetHeight;
      const maxTermHeight = containerHeight - 200;

      const onMouseMove = (ev: MouseEvent) => {
        // Dragging up increases height, dragging down decreases
        const delta = startY - ev.clientY;
        const clamped = Math.max(100, Math.min(maxTermHeight, startHeight + delta));
        dispatch(setTerminalHeight(clamped));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [dispatch],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-px cursor-row-resize bg-border/40 hover:bg-primary/30 transition-colors shrink-0"
    />
  );
}
