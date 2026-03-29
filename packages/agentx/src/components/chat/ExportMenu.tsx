import { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { DownloadIcon, FileTextIcon, FileJsonIcon, FileIcon, EyeIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { l10n } from "@agentx/l10n";
import { exportConversation, type ExportFormat } from "@/lib/performExport";

export function ExportMenu() {
  const { messages, conversations, currentConversationId } = useSelector(
    (state: RootState) => state.chat,
  );
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title =
    conversations.find((c) => c.id === currentConversationId)?.title || l10n.t("Untitled");

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setOpen(false);
      try {
        await exportConversation(messages, title, format);
      } catch (err) {
        console.error("[Export] Failed:", err);
      }
    },
    [messages, title],
  );

  if (messages.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{l10n.t("Export")}</TooltipContent>
      </Tooltip>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border border-border bg-card shadow-lg py-1"
          style={{ zIndex: "var(--z-popover)" }}
        >
          <MenuItem
            icon={FileTextIcon}
            label={l10n.t("Export as Markdown")}
            onClick={() => handleExport("markdown")}
          />
          <MenuItem
            icon={FileJsonIcon}
            label={l10n.t("Export as JSON")}
            onClick={() => handleExport("json")}
          />
          <MenuItem
            icon={FileIcon}
            label={l10n.t("Export as PDF")}
            onClick={() => handleExport("pdf")}
          />
          <div className="my-1 border-t border-border" />
          <MenuItem
            icon={EyeIcon}
            label={l10n.t("Export for Quick Look")}
            onClick={() => handleExport("agentx")}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-foreground hover:bg-foreground/[0.06] transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      {label}
    </button>
  );
}
