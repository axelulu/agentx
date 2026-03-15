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
import { AnimatePresence, motion } from "framer-motion";

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
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <ChatPanel />
        </div>
      </div>

      <AnimatePresence>{settingsOpen && <SettingsPanel />}</AnimatePresence>
      <SearchDialog />
    </div>
  );
}
