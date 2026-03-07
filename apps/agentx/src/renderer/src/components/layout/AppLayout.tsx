import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { AnimatePresence, motion } from "framer-motion";

export function AppLayout() {
  const { sidebarOpen, settingsOpen } = useSelector(
    (state: RootState) => state.ui
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-r border-border"
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>

      <AnimatePresence>
        {settingsOpen && <SettingsPanel />}
      </AnimatePresence>
    </div>
  );
}
