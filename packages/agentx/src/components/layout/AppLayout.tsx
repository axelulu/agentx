import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { openTab } from "@/slices/uiSlice";
import { switchConversation } from "@/slices/chatSlice";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { TabBar } from "@/components/chat/TabBar";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { UpdateDialog } from "@/components/update/UpdateDialog";
import { SearchDialog } from "@/components/search/SearchDialog";
import { useUpdateListener } from "@/hooks/useUpdateListener";
import { useShortcuts } from "@/hooks/useShortcuts";

export function AppLayout() {
  const dispatch = useDispatch<AppDispatch>();
  const { sidebarOpen, settingsOpen } = useSelector((state: RootState) => state.ui);
  useUpdateListener();
  useShortcuts();

  // Navigate to conversation when a notification is clicked
  useEffect(() => {
    return window.api.notifications.onNavigateToConversation((conversationId) => {
      dispatch(openTab(conversationId));
      dispatch(switchConversation(conversationId));
    });
  }, [dispatch]);

  return (
    <div className="h-full text-foreground relative overflow-hidden">
      {/* App shell — columns first so frosted glass spans full height on left */}
      <div className="relative flex h-full">
        {/* Left column: transparent so native macOS vibrancy shows through */}
        <div
          className="flex flex-col shrink-0 overflow-hidden transition-all duration-200 ease-in-out frosted-glass border-r border-sidebar-border"
          style={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
        >
          {/* macOS traffic-light drag strip — must clear native buttons (~24px) + padding */}
          <div
            className="h-9 shrink-0"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <Sidebar />
        </div>

        {/* Right column: opaque content area */}
        <div className="flex flex-col flex-1 overflow-hidden bg-background">
          <TitleBar />
          <UpdateDialog />
          <TabBar />
          <ChatPanel />
        </div>
      </div>

      {settingsOpen && <SettingsPanel />}
      <SearchDialog />
    </div>
  );
}
