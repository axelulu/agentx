import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/slices/store";
import { resetToWelcome } from "@/slices/chatSlice";
import { toggleSettings, openTab, setActiveView } from "@/slices/uiSlice";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "@/hooks/useTheme";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { ConversationList } from "./ConversationList";
import {
  SquarePenIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  SettingsIcon,
  ListChecksIcon,
  XIcon,
  SearchIcon,
  FolderPlusIcon,
  WorkflowIcon,
  ZapIcon,
  BellIcon,
} from "lucide-react";
import { createFolder } from "@/slices/settingsSlice";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

const THEME_CYCLE = ["dark", "light", "system"] as const;

export function Sidebar() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, setThemeMode } = useTheme();
  const activeView = useSelector((state: RootState) => state.ui.activeView);
  const [selectMode, setSelectMode] = useState(false);
  const conversations = useSelector((state: RootState) => state.chat.conversations);
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    setThemeMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-[260px]">
      {/* New Chat + Automation + Skills */}
      <div className="px-3 pb-1">
        <button
          onClick={() => {
            dispatch(resetToWelcome());
            dispatch(setActiveView("chat"));
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeView === "chat" && !currentConversationId
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <SquarePenIcon className="w-3.5 h-3.5" />
          {l10n.t("New Chat")}
        </button>
        <button
          onClick={() => {
            invoke("quickchat_open_mode", { mode: "conv-search" }).catch(() => {});
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">{l10n.t("Search")}</span>
          <kbd className="text-[10px] text-muted-foreground/40 font-normal">⌘K</kbd>
        </button>
        <button
          onClick={() => dispatch(setActiveView("automation"))}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeView === "automation"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <WorkflowIcon className="w-3.5 h-3.5" />
          {l10n.t("Automation")}
        </button>
        <button
          onClick={() => dispatch(setActiveView("skills"))}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeView === "skills"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <ZapIcon className="w-3.5 h-3.5" />
          {l10n.t("Skills")}
        </button>
        <button
          onClick={() => dispatch(setActiveView("notifications"))}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeView === "notifications"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <BellIcon className="w-3.5 h-3.5" />
          {l10n.t("Notifications")}
        </button>
      </div>

      {/* Brand + Select/Folder */}
      <div className="flex items-center justify-between px-4 py-1">
        <span className="font-medium text-[11px] tracking-tight text-muted-foreground/50 select-none">
          {l10n.t("AgentX")}
        </span>
        {selectMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSelectMode(false)}
                className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
              >
                <XIcon className="w-3.5 h-3.5 text-muted-foreground/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{l10n.t("Close")}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-0.5">
            {conversations.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelectMode(true)}
                    className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
                  >
                    <ListChecksIcon className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{l10n.t("Select")}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => dispatch(createFolder(l10n.t("New Folder")))}
                  className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
                >
                  <FolderPlusIcon className="w-3.5 h-3.5 text-muted-foreground/40" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{l10n.t("New Folder")}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Middle: Conversation List */}
      <div className="flex-1 overflow-y-auto px-1">
        <ConversationList selectMode={selectMode} onExitSelectMode={() => setSelectMode(false)} />
      </div>

      {/* Bottom: Controls */}
      <div className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cycleTheme}
                className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
              >
                {theme === "dark" ? (
                  <MoonIcon className="w-3.5 h-3.5 text-muted-foreground" />
                ) : theme === "light" ? (
                  <SunIcon className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <MonitorIcon className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{l10n.t("Toggle Theme")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => dispatch(toggleSettings())}
                className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{l10n.t("Settings")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
