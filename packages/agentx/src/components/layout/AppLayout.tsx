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
      {/* Decorative background — visible behind the frosted-glass sidebar */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 via-neutral-300/80 to-neutral-200 dark:from-neutral-800 dark:via-neutral-700/60 dark:to-neutral-800" />

      {/* App shell */}
      <div className="relative flex flex-col h-full">
        <TitleBar />
        <UpdateDialog />
        <div className="flex flex-1 overflow-hidden">
          <div
            className="overflow-hidden transition-all duration-200 ease-in-out shrink-0"
            style={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
          >
            <Sidebar />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden bg-background">
            <TabBar />
            <ChatPanel />
          </div>
        </div>

        {settingsOpen && <SettingsPanel />}
        <SearchDialog />
      </div>
    </div>
  );
}
