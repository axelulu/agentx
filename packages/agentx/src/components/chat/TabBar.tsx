import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  toggleConversationFavorite,
  updateConversationTitle,
  removeConversation,
} from "@/slices/chatSlice";
import { l10n } from "@agentx/l10n";
import {
  Loader2Icon,
  EllipsisIcon,
  StarIcon,
  PencilIcon,
  DownloadIcon,
  TrashIcon,
  FileTextIcon,
  FileJsonIcon,
  FileIcon,
  EyeIcon,
  ChevronRightIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { toggleTerminal } from "@/slices/uiSlice";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { exportConversation, type ExportFormat } from "@/lib/performExport";
import { getConversationIcon } from "@/lib/conversationIcon";

export function TabBar() {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, conversations, currentConversationId, runningSessions } = useSelector(
    (state: RootState) => state.chat,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportSubOpen, setExportSubOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const conversation = conversations.find((c) => c.id === currentConversationId);
  const title = conversation?.title || l10n.t("Untitled");
  const isFavorite = !!conversation?.isFavorite;
  const isRunning = currentConversationId ? runningSessions.includes(currentConversationId) : false;

  // Focus rename input
  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  // Close on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setExportSubOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setExportSubOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  const handleToggleFavorite = useCallback(() => {
    if (!currentConversationId) return;
    setMenuOpen(false);
    dispatch(toggleConversationFavorite({ id: currentConversationId, isFavorite: !isFavorite }));
  }, [currentConversationId, isFavorite, dispatch]);

  const handleStartRename = useCallback(() => {
    setMenuOpen(false);
    setRenameValue(title);
    setRenaming(true);
  }, [title]);

  const commitRename = useCallback(() => {
    if (!currentConversationId) return;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) {
      dispatch(updateConversationTitle({ id: currentConversationId, title: trimmed }));
    }
    setRenaming(false);
  }, [currentConversationId, renameValue, title, dispatch]);

  const handleDelete = useCallback(() => {
    setMenuOpen(false);
    setDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!currentConversationId) return;
    dispatch(removeConversation(currentConversationId));
    setDeleteConfirm(false);
  }, [currentConversationId, dispatch]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setMenuOpen(false);
      setExportSubOpen(false);
      try {
        await exportConversation(messages, title, format);
      } catch (err) {
        console.error("[Export] Failed:", err);
      }
    },
    [messages, title],
  );

  return (
    <>
      <div
        className="flex items-center px-3 pt-1.5 pb-0.5 shrink-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* Title + more menu */}
        {currentConversationId && (
          <div
            className="flex items-center gap-1.5 min-w-0"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {/* Conversation icon */}
            {!renaming && (
              <div className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                {isRunning ? (
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin text-foreground/60" />
                ) : conversation?.icon ? (
                  <div
                    className="w-3.5 h-3.5 [&>svg]:w-full [&>svg]:h-full text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: conversation.icon }}
                  />
                ) : (
                  (() => {
                    const FallbackIcon = getConversationIcon(title);
                    return <FallbackIcon className="w-3.5 h-3.5 text-muted-foreground" />;
                  })()
                )}
              </div>
            )}

            {renaming ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === "Escape") {
                    setRenaming(false);
                  }
                }}
                className="text-[12px] font-medium text-foreground bg-transparent outline-none border-b border-foreground/30 max-w-[240px]"
              />
            ) : (
              <span className="text-[12px] font-medium text-foreground truncate max-w-[240px]">
                {isFavorite && (
                  <StarIcon className="w-3 h-3 inline-block mr-1 text-yellow-400 fill-yellow-400 -mt-0.5" />
                )}
                {title}
              </span>
            )}

            {/* More menu */}
            {!renaming && (
              <div ref={menuRef} className="relative shrink-0">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                >
                  <EllipsisIcon className="w-3.5 h-3.5" />
                </button>

                {menuOpen && (
                  <div
                    className="absolute left-0 top-full mt-1 min-w-[160px] rounded-xl bg-background border border-border shadow-lg overflow-hidden py-1"
                    style={{ zIndex: "var(--z-popover)" }}
                  >
                    {/* Favorite */}
                    <MenuItem
                      icon={StarIcon}
                      iconClassName={
                        isFavorite ? "w-3.5 h-3.5 fill-yellow-400 text-yellow-400" : undefined
                      }
                      label={
                        isFavorite ? l10n.t("Remove from Favorites") : l10n.t("Add to Favorites")
                      }
                      onClick={handleToggleFavorite}
                    />
                    {/* Rename */}
                    <MenuItem
                      icon={PencilIcon}
                      label={l10n.t("Rename")}
                      onClick={handleStartRename}
                    />
                    {/* Export submenu */}
                    {messages.length > 0 && (
                      <ExportSubmenu
                        open={exportSubOpen}
                        onOpenChange={setExportSubOpen}
                        onExport={handleExport}
                      />
                    )}
                    <div className="my-1 border-t border-border" />
                    {/* Delete */}
                    <MenuItem
                      icon={TrashIcon}
                      label={l10n.t("Delete")}
                      variant="destructive"
                      onClick={handleDelete}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Drag spacer */}
        <div className="flex-1" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />

        {/* Terminal toggle */}
        <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <TerminalToggle />
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(false)}
        title={l10n.t("Delete conversation")}
        confirmLabel={l10n.t("Delete")}
        variant="destructive"
        onConfirm={confirmDelete}
      >
        <p className="text-sm text-muted-foreground">
          {l10n.t("Are you sure you want to delete")}{" "}
          <span className="font-medium text-foreground">&ldquo;{title}&rdquo;</span>?{" "}
          {l10n.t("This action cannot be undone.")}
        </p>
      </ConfirmDialog>
    </>
  );
}

function TerminalToggle() {
  const dispatch = useDispatch();
  const terminalOpen = useSelector((s: RootState) => s.ui.terminalOpen);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => dispatch(toggleTerminal())}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
            terminalOpen
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
          }`}
        >
          <TerminalSquareIcon className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{l10n.t("Terminal")}</TooltipContent>
    </Tooltip>
  );
}

function ExportSubmenu({
  open,
  onOpenChange,
  onExport,
}: {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  onExport: (format: ExportFormat) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !rowRef.current || !subRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const sub = subRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right + 4;
    if (left + sub.offsetWidth > vw) left = rect.left - sub.offsetWidth - 4;
    let top = rect.top;
    if (top + sub.offsetHeight > vh) top = Math.max(4, vh - sub.offsetHeight - 4);
    sub.style.left = `${left}px`;
    sub.style.top = `${top}px`;
  }, [open]);

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-foreground hover:bg-foreground/[0.06] transition-colors">
        <DownloadIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="flex-1 text-left">{l10n.t("Export")}</span>
        <ChevronRightIcon className="w-3 h-3 text-muted-foreground" />
      </button>
      {open &&
        createPortal(
          <div
            ref={subRef}
            onMouseEnter={() => onOpenChange(true)}
            onMouseLeave={() => onOpenChange(false)}
            className="fixed min-w-[120px] rounded-xl bg-background border border-border shadow-lg overflow-hidden py-1"
            style={{ left: 0, top: 0, zIndex: "var(--z-popover)" }}
          >
            <MenuItem
              icon={FileTextIcon}
              label={l10n.t("Markdown")}
              onClick={() => onExport("markdown")}
            />
            <MenuItem icon={FileJsonIcon} label={l10n.t("JSON")} onClick={() => onExport("json")} />
            <MenuItem icon={FileIcon} label={l10n.t("PDF")} onClick={() => onExport("pdf")} />
            <MenuItem
              icon={EyeIcon}
              label={l10n.t("Quick Look")}
              onClick={() => onExport("agentx")}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  iconClassName,
  label,
  onClick,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  label: string;
  onClick: () => void;
  variant?: "destructive";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-[12px] transition-colors ${
        variant === "destructive"
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-foreground/[0.06]"
      }`}
    >
      <Icon
        className={
          iconClassName || `w-3.5 h-3.5 ${variant === "destructive" ? "" : "text-muted-foreground"}`
        }
      />
      {label}
    </button>
  );
}
