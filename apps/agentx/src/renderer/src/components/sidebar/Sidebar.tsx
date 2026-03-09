import { useState, useCallback, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/slices/store";
import { createNewConversation } from "@/slices/chatSlice";
import { toggleSettings, openTab } from "@/slices/uiSlice";
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
  SearchIcon,
  FolderPlusIcon,
} from "lucide-react";
import { createFolder } from "@/slices/settingsSlice";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

const THEME_CYCLE = ["dark", "light", "system"] as const;

interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
}

export function Sidebar() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, setThemeMode } = useTheme();
  const [selectMode, setSelectMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const conversations = useSelector((state: RootState) => state.chat.conversations);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await window.api.conversation.search(query.trim());
        setSearchResults(results as SearchResult[]);
      } catch {
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

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
                  onClick={() => dispatch(createFolder(l10n.t("New Folder")))}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
                >
                  <FolderPlusIcon className="w-4 h-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{l10n.t("New Folder")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={async () => {
                    const conv = await dispatch(createNewConversation()).unwrap();
                    dispatch(openTab(conv.id));
                  }}
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

      {/* Search */}
      {!selectMode && conversations.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={l10n.t("Search conversations...")}
              className="w-full bg-sidebar-accent rounded-md pl-8 pr-7 py-1.5 text-[12px] text-sidebar-foreground placeholder:text-muted-foreground/50 outline-none border border-sidebar-border focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Middle: Conversation List */}
      <div className="flex-1 overflow-y-auto px-1">
        <ConversationList
          selectMode={selectMode}
          onExitSelectMode={() => setSelectMode(false)}
          searchQuery={searchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
        />
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
