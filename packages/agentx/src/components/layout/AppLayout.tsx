import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { openTab, toggleSidebar, setWeChatImportOpen } from "@/slices/uiSlice";
import { switchConversation } from "@/slices/chatSlice";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AutomationPanel } from "@/components/automation/AutomationPanel";
import { SkillsPanel } from "@/components/skills/SkillsPanel";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { TabBar } from "@/components/chat/TabBar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { UpdateDialog } from "@/components/update/UpdateDialog";
import { ClipboardDialog } from "@/components/clipboard/ClipboardDialog";
import { WeChatImportDialog } from "@/components/wechat/WeChatImportDialog";
import { useUpdateListener } from "@/hooks/useUpdateListener";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useFinderAction } from "@/hooks/useFinderAction";
import { useShareAction } from "@/hooks/useShareAction";
import { UpdateRestartButton } from "@/components/update/UpdateRestartButton";
import { PanelLeftIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { l10n } from "@agentx/l10n";

export function AppLayout() {
  const dispatch = useDispatch<AppDispatch>();
  const { sidebarOpen, settingsOpen, activeView, wechatImportOpen } = useSelector(
    (state: RootState) => state.ui,
  );
  useUpdateListener();
  useAutoUpdate();
  useShortcuts();
  useFinderAction();
  useShareAction();

  // Navigate to conversation when a notification is clicked
  useEffect(() => {
    return window.api.notifications.onNavigateToConversation((conversationId) => {
      dispatch(openTab(conversationId));
      dispatch(switchConversation(conversationId));
    });
  }, [dispatch]);

  return (
    <div className="h-full text-foreground relative overflow-hidden">
      {/* Fixed sidebar toggle — always top-left, right of macOS traffic lights */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="fixed top-2 left-[78px] z-50 p-1 rounded-md hover:bg-accent/50 transition-colors"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <PanelLeftIcon className="w-4 h-4 text-foreground/80" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{l10n.t("Toggle Sidebar")}</TooltipContent>
      </Tooltip>

      <UpdateRestartButton />

      {/* App shell — columns first so frosted glass spans full height on left */}
      <div className="relative flex h-full">
        {/* Left column: transparent so native macOS vibrancy shows through */}
        <div
          className="flex flex-col shrink-0 overflow-hidden transition-all duration-200 ease-in-out frosted-glass border-r border-sidebar-border"
          style={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
        >
          {/* macOS traffic-light drag strip — match TitleBar height for alignment */}
          <div
            className="h-10 shrink-0"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <Sidebar />
        </div>

        {/* Right column: opaque content area */}
        <div className="flex flex-col flex-1 overflow-hidden bg-background">
          {activeView === "chat" && <TabBar />}
          {activeView !== "chat" && <TitleBar />}
          <UpdateDialog />
          {activeView === "automation" ? (
            <AutomationPanel />
          ) : activeView === "skills" ? (
            <SkillsPanel />
          ) : activeView === "notifications" ? (
            <NotificationCenter />
          ) : (
            <ChatPanel />
          )}
        </div>
      </div>

      {settingsOpen && <SettingsPanel />}
      <ClipboardDialog />
      <WeChatImportDialog
        open={wechatImportOpen}
        onOpenChange={(open) => dispatch(setWeChatImportOpen(open))}
      />
    </div>
  );
}
