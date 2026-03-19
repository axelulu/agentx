import { useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { switchConversation } from "@/slices/chatSlice";
import { closeTabAndSwitch, closeOtherTabs, closeAllTabs } from "@/slices/uiSlice";
import { ContextMenu, type ContextMenuState } from "@/components/ui/ContextMenu";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { XIcon, Loader2Icon } from "lucide-react";
import { ExportMenu } from "./ExportMenu";

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

  return (
    <div
      className="flex items-center px-2 pt-1.5 pb-0.5 shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-0.5 overflow-x-auto tab-scrollbar min-w-0">
        {openTabs.map((tabId) => {
          const isActive = tabId === currentConversationId;
          const isRunning = runningSessions.includes(tabId);
          return (
            <button
              key={tabId}
              onClick={() => handleTabClick(tabId)}
              onContextMenu={(e) => handleContextMenu(e, tabId)}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className={cn(
                "group relative flex items-center gap-1.5 px-2.5 py-1 text-[11px] w-[140px] shrink-0 rounded-md transition-all",
                isActive
                  ? "bg-foreground/[0.07] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
              )}
            >
              {isRunning && (
                <Loader2Icon className="w-2.5 h-2.5 shrink-0 animate-spin text-foreground/70" />
              )}
              <span className="truncate flex-1">{getTitle(tabId)}</span>
              <span
                onClick={(e) => handleClose(e, tabId)}
                className={cn(
                  "shrink-0 ml-auto p-0.5 rounded-sm transition-colors",
                  isActive
                    ? "text-foreground/40 hover:text-foreground hover:bg-foreground/[0.08]"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]",
                )}
              >
                <XIcon className="w-2.5 h-2.5" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Spacer to push export to the right */}
      <div className="flex-1" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />

      {/* Export button */}
      <div
        className="shrink-0 pr-0.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <ExportMenu />
      </div>

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
