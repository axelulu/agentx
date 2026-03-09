import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/slices/store";
import { createNewConversation } from "@/slices/chatSlice";
import { toggleSettings } from "@/slices/uiSlice";
import { useTheme } from "@/hooks/useTheme";
import { l10n } from "@workspace/l10n";
import { ConversationList } from "./ConversationList";
import {
  SquarePenIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  SettingsIcon,
  ListChecksIcon,
  XIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

const THEME_CYCLE = ["dark", "light", "system"] as const;

export function Sidebar() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, setThemeMode } = useTheme();
  const [selectMode, setSelectMode] = useState(false);
  const conversations = useSelector((state: RootState) => state.chat.conversations);

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    setThemeMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  return (
    <div className="flex flex-col h-full w-[260px] bg-sidebar">
      {/* Top: Brand + New Chat */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold text-[13px] tracking-tight text-sidebar-foreground select-none">
          {l10n.t("AgentX")}
        </span>
        {selectMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSelectMode(false)}
                className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
              >
                <XIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{l10n.t("Close")}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-0.5">
            {conversations.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelectMode(true)}
                    className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
                  >
                    <ListChecksIcon className="w-4 h-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{l10n.t("Select")}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => dispatch(createNewConversation())}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
                >
                  <SquarePenIcon className="w-4 h-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{l10n.t("New Chat")}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Middle: Conversation List */}
      <div className="flex-1 overflow-y-auto px-1">
        <ConversationList selectMode={selectMode} onExitSelectMode={() => setSelectMode(false)} />
      </div>

      {/* Bottom: Controls */}
      <div className="border-t border-sidebar-border px-3 py-2.5">
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
            <TooltipContent>{l10n.t("Toggle Theme")}</TooltipContent>
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
            <TooltipContent>{l10n.t("Settings")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
