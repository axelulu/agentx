import { useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { switchConversation } from "@/slices/chatSlice";
import { closeTabAndSwitch, closeOtherTabs, closeAllTabs } from "@/slices/uiSlice";
import { ContextMenu, type ContextMenuState } from "@/components/ui/ContextMenu";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { XIcon, Loader2Icon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TabBar() {
  const dispatch = useDispatch<AppDispatch>();
  const openTabs = useSelector((state: RootState) => state.ui.openTabs);
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);
  const conversations = useSelector((state: RootState) => state.chat.conversations);
  const runningSessions = useSelector((state: RootState) => state.chat.runningSessions);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const getTitle = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      return conv?.title || l10n.t("Untitled");
    },
    [conversations],
  );

  const handleTabClick = useCallback(
    (id: string) => {
      if (id !== currentConversationId) {
        dispatch(switchConversation(id));
      }
    },
    [currentConversationId, dispatch],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      dispatch(closeTabAndSwitch(id));
    },
    [dispatch],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetId: id });
  }, []);

  // Only show when there are 2+ tabs
  if (openTabs.length <= 1) return null;

  return (
    <div className="flex items-end bg-background border-b border-border overflow-x-auto scrollbar-none shrink-0">
      <AnimatePresence initial={false}>
        {openTabs.map((tabId) => {
          const isActive = tabId === currentConversationId;
          const isRunning = runningSessions.includes(tabId);
          return (
            <motion.div
              key={tabId}
              layout
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="shrink-0"
            >
              <button
                onClick={() => handleTabClick(tabId)}
                onContextMenu={(e) => handleContextMenu(e, tabId)}
                className={cn(
                  "group flex items-center gap-1.5 px-3 py-1.5 text-[12px] max-w-[180px] border-r border-border transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {isRunning && (
                  <Loader2Icon className="w-3 h-3 shrink-0 animate-spin text-primary" />
                )}
                <span className="truncate">{getTitle(tabId)}</span>
                <span
                  onClick={(e) => handleClose(e, tabId)}
                  className={cn(
                    "shrink-0 p-0.5 rounded-sm transition-colors",
                    isActive
                      ? "hover:bg-foreground/10"
                      : "opacity-0 group-hover:opacity-100 hover:bg-foreground/10",
                  )}
                >
                  <XIcon className="w-3 h-3" />
                </span>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: l10n.t("Close"),
              onClick: () => dispatch(closeTabAndSwitch(contextMenu.targetId)),
            },
            {
              label: l10n.t("Close Others"),
              onClick: () => dispatch(closeOtherTabs(contextMenu.targetId)),
            },
            {
              label: l10n.t("Close All"),
              onClick: () => dispatch(closeAllTabs()),
            },
          ]}
        />
      )}
    </div>
  );
}
