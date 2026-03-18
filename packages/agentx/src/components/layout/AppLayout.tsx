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
    <div className="flex flex-col h-full bg-background text-foreground">
      <TitleBar />
      <UpdateDialog />
      <div className="flex flex-1 overflow-hidden">
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
        >
          <Sidebar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <ChatPanel />
        </div>
      </div>

      {settingsOpen && <SettingsPanel />}
      <SearchDialog />
    </div>
  );
}
