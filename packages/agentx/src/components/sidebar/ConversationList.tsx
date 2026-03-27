import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  switchConversation,
  removeConversation,
  removeConversations,
  updateConversationTitle,
  updateConversationFolder,
  toggleConversationFavorite,
} from "@/slices/chatSlice";
import { openTab, toggleFolderCollapsed, setActiveView } from "@/slices/uiSlice";
import { renameFolder, deleteFolder, clearLastCreatedFolderId } from "@/slices/settingsSlice";
import type { Folder } from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { applySectionOrder } from "@/lib/sortConversations";
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
  SendIcon,
  SmartphoneIcon,
  CheckIcon,
  ChevronRightIcon,
  Loader2Icon,
  FolderIcon,
  FolderOpenIcon,
  StarIcon,
  PencilIcon,
  ArrowRightIcon,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextMenu, type ContextMenuState } from "@/components/ui/ContextMenu";
import { DndContext, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableConversationRow } from "./SortableConversationRow";
import { SortableFolderHeader } from "./SortableFolderHeader";
import { useConversationDnd } from "@/hooks/useConversationDnd";

// ---------------------------------------------------------------------------
// Icon inference from conversation title
// ---------------------------------------------------------------------------

const ICON_RULES: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ["telegram ·", "telegram:"], icon: SendIcon },
  { keywords: ["discord ·", "discord:"], icon: SmartphoneIcon },
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
// Droppable section header wrapper
// ---------------------------------------------------------------------------

function DroppableSectionHeader({
  sectionId,
  disabled,
  children,
}: {
  sectionId: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropsection::${sectionId}`,
    data: { droppableSection: sectionId },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-shadow",
        isOver && !disabled && "ring-2 ring-foreground/20",
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConversationListProps {
  selectMode: boolean;
  onExitSelectMode: () => void;
}

export function ConversationList({ selectMode, onExitSelectMode }: ConversationListProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { conversations, currentConversationId, runningSessions } = useSelector(
    (state: RootState) => state.chat,
  );
  const folders = useSelector((state: RootState) => state.settings.folders);
  const conversationOrder = useSelector((state: RootState) => state.settings.conversationOrder);
  const collapsedFolderIds = useSelector((state: RootState) => state.ui.collapsedFolderIds);
  const activeView = useSelector((state: RootState) => state.ui.activeView);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Folder state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderEditValue, setFolderEditValue] = useState("");
  const folderEditRef = useRef<HTMLInputElement>(null);
  const lastCreatedFolderId = useSelector((state: RootState) => state.settings.lastCreatedFolderId);

  // Section collapse state (for Favorites and Ungrouped)
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [ungroupedCollapsed, setUngroupedCollapsed] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<ContextMenuState | null>(null);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  // Reset selection when exiting select mode
  useEffect(() => {
    if (!selectMode) {
      setSelectedIds(new Set());
    }
  }, [selectMode]);

  // Escape key exits select mode
  useEffect(() => {
    if (!selectMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExitSelectMode();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectMode, onExitSelectMode]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (editingFolderId && folderEditRef.current) {
      folderEditRef.current.focus();
      folderEditRef.current.select();
    }
  }, [editingFolderId]);

  // Auto-enter edit mode when a new folder is created (not when loaded from preferences)
  useEffect(() => {
    if (lastCreatedFolderId) {
      const newFolder = folders.find((f) => f.id === lastCreatedFolderId);
      if (newFolder) {
        setEditingFolderId(newFolder.id);
        setFolderEditValue(newFolder.name);
      }
      dispatch(clearLastCreatedFolderId());
    }
  }, [lastCreatedFolderId, folders, dispatch]);

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

  const commitFolderEdit = useCallback(() => {
    if (!editingFolderId) return;
    const trimmed = folderEditValue.trim();
    if (trimmed) {
      dispatch(renameFolder({ id: editingFolderId, name: trimmed }));
    }
    setEditingFolderId(null);
  }, [editingFolderId, folderEditValue, dispatch]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(conversations.map((c) => c.id)));
  }, [conversations]);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    dispatch(removeConversations(Array.from(selectedIds)));
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
    onExitSelectMode();
  }, [selectedIds, dispatch, onExitSelectMode]);

  const filteredConversations = conversations;

  const handleDelete = () => {
    if (deleteTarget) {
      dispatch(removeConversation(deleteTarget.id));
      setDeleteTarget(null);
    }
  };

  // Direct folder delete — no dialog, immediate action
  const handleFolderDelete = (folderId: string) => {
    // Unassign conversations from this folder first
    for (const conv of conversations) {
      if (conv.folderId === folderId) {
        dispatch(updateConversationFolder({ id: conv.id, folderId: null }));
      }
    }
    dispatch(deleteFolder(folderId));
  };

  // Build context menu items for a conversation
  const buildContextMenuItems = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return [];

    const isFav = !!conv.isFavorite;

    const items: Array<{
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      variant?: "destructive";
      disabled?: boolean;
      submenu?: Array<{
        label: string;
        icon?: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
      }>;
    }> = [
      // Star / Unstar
      {
        label: isFav ? l10n.t("Remove from Favorites") : l10n.t("Add to Favorites"),
        icon: <StarIcon className={cn("w-4 h-4", isFav && "fill-current")} />,
        onClick: () =>
          dispatch(toggleConversationFavorite({ id: conversationId, isFavorite: !isFav })),
      },
      // Move to folder (submenu)
      ...(folders.length > 0
        ? [
            {
              label: l10n.t("Move to"),
              icon: <ArrowRightIcon className="w-4 h-4" />,
              onClick: () => {},
              submenu: [
                ...folders.map((folder) => ({
                  label: folder.name,
                  icon: <FolderIcon className="w-4 h-4" />,
                  onClick: () =>
                    dispatch(updateConversationFolder({ id: conversationId, folderId: folder.id })),
                  disabled: conv.folderId === folder.id,
                })),
                ...(conv.folderId
                  ? [
                      {
                        label: l10n.t("No folder"),
                        icon: <FolderOpenIcon className="w-4 h-4" />,
                        onClick: () =>
                          dispatch(
                            updateConversationFolder({ id: conversationId, folderId: null }),
                          ),
                      },
                    ]
                  : []),
              ],
            },
          ]
        : []),
      // Rename
      {
        label: l10n.t("Rename"),
        icon: <PencilIcon className="w-4 h-4" />,
        onClick: () => {
          setEditingId(conversationId);
          setEditValue(conv.title);
        },
      },
      // Delete
      {
        label: l10n.t("Delete"),
        variant: "destructive" as const,
        icon: <TrashIcon className="w-4 h-4" />,
        onClick: () => setDeleteTarget({ id: conv.id, title: conv.title }),
      },
    ];

    return items;
  };

  // Group conversations into sections
  const rawFavorites = filteredConversations.filter((c) => c.isFavorite);
  const folderGroups = new Map<string, typeof filteredConversations>();
  const rawUngrouped: typeof filteredConversations = [];

  for (const conv of filteredConversations) {
    if (conv.isFavorite) continue;
    if (conv.folderId && folders.some((f) => f.id === conv.folderId)) {
      const group = folderGroups.get(conv.folderId) ?? [];
      group.push(conv);
      folderGroups.set(conv.folderId, group);
    } else {
      rawUngrouped.push(conv);
    }
  }

  const sortedFolders = useMemo(() => [...folders].sort((a, b) => a.order - b.order), [folders]);

  // Apply stored ordering
  const favorites = useMemo(
    () => applySectionOrder(rawFavorites, conversationOrder.favorites),
    [rawFavorites, conversationOrder.favorites],
  );
  const ungrouped = useMemo(
    () => applySectionOrder(rawUngrouped, conversationOrder.ungrouped),
    [rawUngrouped, conversationOrder.ungrouped],
  );
  const orderedFolderGroups = useMemo(() => {
    const result = new Map<string, typeof filteredConversations>();
    for (const [folderId, convs] of folderGroups) {
      result.set(folderId, applySectionOrder(convs, conversationOrder.folders[folderId] ?? []));
    }
    return result;
  }, [folderGroups, conversationOrder.folders]);

  // Build section ordered IDs for the DnD hook
  const sectionOrderedIds = useMemo(() => {
    const ids: Record<string, string[]> = {
      favorites: favorites.map((c) => c.id),
      ungrouped: ungrouped.map((c) => c.id),
    };
    for (const [folderId, convs] of orderedFolderGroups) {
      ids[folderId] = convs.map((c) => c.id);
    }
    return ids;
  }, [favorites, ungrouped, orderedFolderGroups]);

  // DnD
  const isDndEnabled = !selectMode;
  const {
    sensors,
    activeId,
    activeType,
    overSectionId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useConversationDnd(sectionOrderedIds, sortedFolders);

  const isDragging = activeId !== null;

  const isEmpty = conversations.length === 0 && folders.length === 0;

  const draggedConversation =
    activeType === "conversation" ? conversations.find((c) => c.id === activeId) : null;
  const draggedFolder = activeType === "folder" ? folders.find((f) => f.id === activeId) : null;

  // Render a single conversation row (inner content)
  const renderConversationRowContent = (conversation: (typeof conversations)[0]) => {
    const isActive = activeView === "chat" && conversation.id === currentConversationId;
    const isEditing = !selectMode && editingId === conversation.id;
    const isSelected = selectedIds.has(conversation.id);
    const isRunning = runningSessions.includes(conversation.id);
    const Icon = getConversationIcon(conversation.title);
    return (
      <div
        className={cn(
          "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-[12px]",
          selectMode
            ? isSelected
              ? "bg-foreground/[0.08] text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"
            : isActive
              ? "bg-foreground/[0.08] text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground",
        )}
        onClick={() => {
          if (selectMode) {
            toggleSelection(conversation.id);
          } else if (!isEditing) {
            dispatch(switchConversation(conversation.id));
            dispatch(openTab(conversation.id));
            dispatch(setActiveView("chat"));
          }
        }}
        onDoubleClick={(e) => {
          if (selectMode) return;
          e.stopPropagation();
          setEditingId(conversation.id);
          setEditValue(conversation.title);
        }}
        onContextMenu={(e) => {
          if (selectMode) return;
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, targetId: conversation.id });
        }}
      >
        {/* Checkbox (select mode) */}
        {selectMode && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key="checkbox"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected ? "bg-foreground border-foreground" : "border-muted-foreground/30",
              )}
            >
              {isSelected && (
                <CheckIcon className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Icon or loading indicator */}
        {!selectMode && (
          <div className="shrink-0 flex items-center justify-center w-4 h-4">
            <AnimatePresence mode="wait" initial={false}>
              {isRunning ? (
                <motion.div
                  key="loading"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Title */}
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
              className="w-full bg-transparent outline-none text-[13px] leading-snug font-medium border-b border-foreground/30 py-0"
            />
          ) : (
            <span
              className={cn(
                "truncate block leading-tight",
                isActive && !selectMode ? "font-medium" : "font-normal",
              )}
            >
              {conversation.isFavorite && (
                <StarIcon className="w-3 h-3 inline-block mr-1 text-foreground/60 fill-foreground/60 -mt-0.5" />
              )}
              {conversation.title}
            </span>
          )}
        </div>

        {/* Time */}
        <span className="shrink-0 text-[11px] text-muted-foreground/50 leading-snug">
          {formatRelativeTime(conversation.updatedAt)}
        </span>

        {/* Delete button — hidden in select mode */}
        {!isEditing && !selectMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ id: conversation.id, title: conversation.title });
                }}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/15 hover:text-destructive transition-all text-muted-foreground/60"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{l10n.t("Delete")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  // Render a section's conversations wrapped with SortableContext
  const renderSortableSection = (sectionKey: string, convs: typeof conversations) => {
    const sortableIds = convs.map((c) => `${sectionKey}::${c.id}`);
    return (
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5">
          {convs.map((conv) => (
            <SortableConversationRow
              key={conv.id}
              id={`${sectionKey}::${conv.id}`}
              disabled={!isDndEnabled}
            >
              {renderConversationRowContent(conv)}
            </SortableConversationRow>
          ))}
        </div>
      </SortableContext>
    );
  };

  // Collapsible section header
  const SectionHeader = ({
    icon: SectionIcon,
    label,
    count,
    collapsed,
    onToggle,
  }: {
    icon: LucideIcon;
    label: string;
    count: number;
    collapsed: boolean;
    onToggle: () => void;
  }) => (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-[12px] text-foreground/70 hover:bg-foreground/[0.08] hover:text-foreground select-none"
      onClick={onToggle}
    >
      <SectionIcon className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 min-w-0 truncate font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground/40 tabular-nums">{count}</span>
    </div>
  );

  // Folder sortable IDs for folder reordering
  const folderSortableIds = sortedFolders.map((f) => `folder::${f.id}`);

  // Shared confirmation dialogs — always rendered so they survive the empty‐state branch
  const confirmDialogs = (
    <>
      {/* Single delete confirmation dialog */}
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

      {/* Batch delete confirmation dialog */}
      <ConfirmDialog
        open={batchDeleteConfirm}
        onOpenChange={(open) => !open && setBatchDeleteConfirm(false)}
        title={l10n.t("Delete conversations")}
        confirmLabel={l10n.t("Delete")}
        variant="destructive"
        onConfirm={handleBatchDelete}
      >
        <p className="text-sm text-muted-foreground">
          {l10n.t("Are you sure you want to delete")}{" "}
          <span className="font-medium text-foreground">{selectedIds.size}</span>{" "}
          {l10n.t("conversations? This action cannot be undone.")}
        </p>
      </ConfirmDialog>
    </>
  );

  if (isEmpty) {
    return (
      <>
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <MessageSquareIcon className="w-8 h-8 text-muted-foreground/20 mb-3" />
          <p className="text-[13px] text-muted-foreground/50">{l10n.t("No conversations yet")}</p>
          <p className="text-[11px] text-muted-foreground/30 mt-1">
            {l10n.t("Start a new chat to begin")}
          </p>
        </div>
        {confirmDialogs}
      </>
    );
  }

  return (
    <DndContext
      sensors={isDndEnabled ? sensors : undefined}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="min-h-full flex flex-col">
        <div className="flex flex-col px-2">
          {/* Favorites section */}
          {favorites.length > 0 && (
            <div className="">
              <DroppableSectionHeader sectionId="favorites" disabled={!isDndEnabled}>
                <SectionHeader
                  icon={StarIcon}
                  label={l10n.t("Favorites")}
                  count={favorites.length}
                  collapsed={favoritesCollapsed}
                  onToggle={() => setFavoritesCollapsed(!favoritesCollapsed)}
                />
              </DroppableSectionHeader>
              {!isDragging ? (
                <AnimatePresence initial={false}>
                  {!favoritesCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {renderSortableSection("favorites", favorites)}
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                !favoritesCollapsed && renderSortableSection("favorites", favorites)
              )}
            </div>
          )}

          {/* Folder sections — wrapped in SortableContext for folder reordering */}
          <SortableContext items={folderSortableIds} strategy={verticalListSortingStrategy}>
            {sortedFolders.map((folder) => {
              const folderConvs = orderedFolderGroups.get(folder.id) ?? [];
              const isCollapsed = collapsedFolderIds.includes(folder.id);
              const isFolderEditing = editingFolderId === folder.id;
              const isEmpty = folderConvs.length === 0;

              return (
                <div key={folder.id} className="">
                  <SortableFolderHeader
                    id={`folder::${folder.id}`}
                    folderId={folder.id}
                    disabled={!isDndEnabled}
                    isOverDroppable={overSectionId === folder.id}
                  >
                    {/* Folder header */}
                    <div
                      className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-[12px] text-foreground/70 hover:bg-foreground/[0.08] hover:text-foreground"
                      onClick={() => !isEmpty && dispatch(toggleFolderCollapsed(folder.id))}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingFolderId(folder.id);
                        setFolderEditValue(folder.name);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setFolderContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          targetId: folder.id,
                        });
                      }}
                    >
                      {isCollapsed || isEmpty ? (
                        <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <FolderOpenIcon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {isFolderEditing ? (
                        <input
                          ref={folderEditRef}
                          value={folderEditValue}
                          onChange={(e) => setFolderEditValue(e.target.value)}
                          onBlur={commitFolderEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitFolderEdit();
                            } else if (e.key === "Escape") {
                              setEditingFolderId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent outline-none text-[12px] font-medium border-b border-foreground/30 py-0"
                        />
                      ) : (
                        <span className="flex-1 min-w-0 truncate font-medium">{folder.name}</span>
                      )}
                      {!isFolderEditing && (
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                          {folderConvs.length}
                        </span>
                      )}
                      {/* Original delete folder button (hover visible) */}
                      {!selectMode && (
                        <button
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleFolderDelete(folder.id);
                          }}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/15 hover:text-destructive transition-all text-muted-foreground/40"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </SortableFolderHeader>

                  {/* Folder contents */}
                  {!isDragging ? (
                    <AnimatePresence initial={false}>
                      {!isCollapsed && !isEmpty && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden pl-3"
                        >
                          {renderSortableSection(folder.id, folderConvs)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    !isCollapsed &&
                    !isEmpty && (
                      <div className="pl-3">{renderSortableSection(folder.id, folderConvs)}</div>
                    )
                  )}
                </div>
              );
            })}
          </SortableContext>

          {/* Ungrouped conversations */}
          {ungrouped.length > 0 && (favorites.length > 0 || sortedFolders.length > 0) && (
            <div className="">
              <DroppableSectionHeader sectionId="ungrouped" disabled={!isDndEnabled}>
                <SectionHeader
                  icon={ungroupedCollapsed ? FolderIcon : FolderOpenIcon}
                  label={l10n.t("Ungrouped")}
                  count={ungrouped.length}
                  collapsed={ungroupedCollapsed}
                  onToggle={() => setUngroupedCollapsed(!ungroupedCollapsed)}
                />
              </DroppableSectionHeader>
              {!isDragging ? (
                <AnimatePresence initial={false}>
                  {!ungroupedCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-3"
                    >
                      {renderSortableSection("ungrouped", ungrouped)}
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                !ungroupedCollapsed && (
                  <div className="pl-3">{renderSortableSection("ungrouped", ungrouped)}</div>
                )
              )}
            </div>
          )}

          {/* When there are no sections, render ungrouped without header */}
          {ungrouped.length > 0 && favorites.length === 0 && sortedFolders.length === 0 && (
            <>{renderSortableSection("ungrouped", ungrouped)}</>
          )}
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {draggedConversation && (
            <div className="bg-sidebar rounded-lg shadow-lg border border-sidebar-border opacity-90 w-[230px]">
              <div className="flex items-center gap-2 px-2.5 py-2 text-[13px] text-foreground">
                {(() => {
                  const Icon = getConversationIcon(draggedConversation.title);
                  return (
                    <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-foreground/[0.06]">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  );
                })()}
                <span className="truncate font-medium">{draggedConversation.title}</span>
              </div>
            </div>
          )}
          {draggedFolder && (
            <div className="bg-sidebar rounded-lg shadow-lg border border-sidebar-border opacity-90 w-[230px]">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-foreground">
                <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{draggedFolder.name}</span>
              </div>
            </div>
          )}
        </DragOverlay>

        {/* Batch action bar */}
        <AnimatePresence>
          {selectMode && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="sticky bottom-2 mx-2 mt-auto px-3 py-2 rounded-lg bg-sidebar-accent border border-sidebar-border flex items-center gap-2"
            >
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {selectedIds.size} {l10n.t("selected")}
              </span>
              <button
                onClick={selectAll}
                className="text-[12px] text-foreground hover:text-foreground/80 font-medium transition-colors"
              >
                {l10n.t("Select All")}
              </button>
              <div className="flex-1" />
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setBatchDeleteConfirm(true)}
                className={cn(
                  "px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors",
                  selectedIds.size > 0
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {l10n.t("Delete")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={buildContextMenuItems(contextMenu.targetId)}
          />
        )}

        {/* Folder context menu */}
        {folderContextMenu && (
          <ContextMenu
            x={folderContextMenu.x}
            y={folderContextMenu.y}
            onClose={() => setFolderContextMenu(null)}
            items={[
              {
                label: l10n.t("Rename Group"),
                icon: <PencilIcon className="w-4 h-4" />,
                onClick: () => {
                  const folder = folders.find((f) => f.id === folderContextMenu.targetId);
                  if (folder) {
                    setEditingFolderId(folder.id);
                    setFolderEditValue(folder.name);
                  }
                },
              },
              {
                label: l10n.t("Delete Group"),
                variant: "destructive",
                icon: <TrashIcon className="w-4 h-4" />,
                onClick: () => {
                  const folder = folders.find((f) => f.id === folderContextMenu.targetId);
                  if (folder) {
                    handleFolderDelete(folder.id);
                  }
                },
              },
            ]}
          />
        )}

        {confirmDialogs}
      </div>
    </DndContext>
  );
}
