import { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  switchConversation,
  removeConversation,
  updateConversationTitle,
} from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import { cn } from "@/lib/utils";
import {
  TrashIcon,
  MessageSquareIcon,
  CodeIcon,
  BugIcon,
  LightbulbIcon,
  FileTextIcon,
  SearchIcon,
  WrenchIcon,
  RocketIcon,
  PaletteIcon,
  DatabaseIcon,
  GlobeIcon,
  ShieldIcon,
  ZapIcon,
  BookOpenIcon,
  LayersIcon,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ---------------------------------------------------------------------------
// Icon inference from conversation title
// ---------------------------------------------------------------------------

const ICON_RULES: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ["bug", "fix", "error", "issue", "debug", "crash"], icon: BugIcon },
  {
    keywords: ["code", "function", "implement", "refactor", "class", "typescript", "javascript"],
    icon: CodeIcon,
  },
  { keywords: ["design", "ui", "style", "css", "layout", "color", "theme"], icon: PaletteIcon },
  { keywords: ["search", "find", "query", "lookup", "filter"], icon: SearchIcon },
  { keywords: ["deploy", "build", "release", "launch", "ship", "ci", "cd"], icon: RocketIcon },
  { keywords: ["config", "setup", "install", "tool", "setting"], icon: WrenchIcon },
  { keywords: ["data", "database", "sql", "schema", "migration", "table"], icon: DatabaseIcon },
  { keywords: ["api", "http", "endpoint", "request", "rest", "graphql", "web"], icon: GlobeIcon },
  { keywords: ["security", "auth", "password", "token", "permission"], icon: ShieldIcon },
  { keywords: ["performance", "optimize", "fast", "speed", "cache"], icon: ZapIcon },
  { keywords: ["doc", "readme", "write", "text", "markdown", "comment"], icon: FileTextIcon },
  { keywords: ["learn", "explain", "how", "what", "why", "tutorial", "guide"], icon: BookOpenIcon },
  { keywords: ["idea", "suggest", "plan", "think", "brainstorm"], icon: LightbulbIcon },
  { keywords: ["test", "spec", "assert", "coverage", "unit", "e2e"], icon: LayersIcon },
];

function getConversationIcon(title: string): LucideIcon {
  const lower = title.toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.icon;
    }
  }
  return MessageSquareIcon;
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (days > 0) return `${days}${l10n.t("d ago")}`;
  if (hours > 0) return `${hours}${l10n.t("h ago")}`;
  if (minutes > 0) return `${minutes}${l10n.t("m ago")}`;
  return l10n.t("Just now");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationList() {
  const dispatch = useDispatch<AppDispatch>();
  const { conversations, currentConversationId } = useSelector((state: RootState) => state.chat);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conversations.find((c) => c.id === editingId)?.title) {
      dispatch(updateConversationTitle({ id: editingId, title: trimmed }));
    }
    setEditingId(null);
  }, [editingId, editValue, conversations, dispatch]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <MessageSquareIcon className="w-8 h-8 text-muted-foreground/20 mb-3" />
        <p className="text-[13px] text-muted-foreground/50">{l10n.t("No conversations yet")}</p>
        <p className="text-[11px] text-muted-foreground/30 mt-1">
          {l10n.t("Start a new chat to begin")}
        </p>
      </div>
    );
  }

  const handleDelete = () => {
    if (deleteTarget) {
      dispatch(removeConversation(deleteTarget.id));
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-0.5 px-2">
        {conversations.map((conversation) => {
          const isActive = conversation.id === currentConversationId;
          const isEditing = editingId === conversation.id;
          const Icon = getConversationIcon(conversation.title);
          return (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-[13px]",
                isActive
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
              )}
              onClick={() => !isEditing && dispatch(switchConversation(conversation.id))}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingId(conversation.id);
                setEditValue(conversation.title);
              }}
            >
              {/* Icon */}
              <div
                className={cn(
                  "shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-md transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-foreground/[0.05] text-muted-foreground group-hover:bg-foreground/[0.08] group-hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent outline-none text-[13px] leading-snug font-medium border-b border-primary/50 py-0"
                  />
                ) : (
                  <p
                    className={cn(
                      "truncate leading-snug",
                      isActive ? "font-medium" : "font-normal",
                    )}
                  >
                    {conversation.title}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-tight">
                  {formatRelativeTime(conversation.updatedAt)}
                  {conversation.messageCount > 0 && (
                    <span className="ml-1.5">
                      &middot; {conversation.messageCount}{" "}
                      {conversation.messageCount === 1 ? l10n.t("msg") : l10n.t("msgs")}
                    </span>
                  )}
                </p>
              </div>

              {/* Delete button */}
              {!isEditing && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: conversation.id, title: conversation.title });
                      }}
                      className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/15 hover:text-destructive transition-all text-muted-foreground/60"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{l10n.t("Delete")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={l10n.t("Delete conversation")}
        confirmLabel={l10n.t("Delete")}
        variant="destructive"
        onConfirm={handleDelete}
      >
        <p className="text-sm text-muted-foreground">
          {l10n.t("Are you sure you want to delete")}{" "}
          <span className="font-medium text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>?{" "}
          {l10n.t("This action cannot be undone.")}
        </p>
      </ConfirmDialog>
    </>
  );
}
