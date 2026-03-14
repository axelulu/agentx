import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { switchConversation } from "@/slices/chatSlice";
import { setSearchOpen } from "@/slices/uiSlice";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@agentx/l10n";
import { SearchIcon, MessageSquareIcon, LoaderIcon } from "lucide-react";

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (days > 0) return `${days}${l10n.t("d ago")}`;
  if (hours > 0) return `${hours}${l10n.t("h ago")}`;
  if (minutes > 0) return `${minutes}${l10n.t("m ago")}`;
  return l10n.t("Just now");
}

interface SearchResult {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  snippet?: string;
}

export function SearchDialog() {
  const dispatch = useDispatch<AppDispatch>();
  const { searchOpen } = useSelector((state: RootState) => state.ui);
  const { conversations } = useSelector((state: RootState) => state.chat);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When no query, show recent conversations; otherwise show search results
  const displayItems: SearchResult[] = useMemo(() => {
    if (!query.trim()) return conversations;
    return searchResults ?? [];
  }, [query, conversations, searchResults]);

  // Debounced backend search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await window.api.conversation.search(q);
        setSearchResults(results as SearchResult[]);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [displayItems]);

  // Focus input when dialog opens
  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSearchResults(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (conversationId: string) => {
      dispatch(switchConversation(conversationId));
      dispatch(setSearchOpen(false));
    },
    [dispatch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, displayItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (displayItems[selectedIndex]) {
          handleSelect(displayItems[selectedIndex].id);
        }
      }
    },
    [displayItems, selectedIndex, handleSelect],
  );

  return (
    <Dialog open={searchOpen} onOpenChange={(open) => dispatch(setSearchOpen(open))}>
      <DialogContent showCloseButton={false} maxWidth="md" className="p-0 gap-0 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {isSearching ? (
            <LoaderIcon className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <SearchIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={l10n.t("Search conversations...")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto">
          {displayItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query.trim() ? l10n.t("No matching conversations") : l10n.t("No conversations yet")}
            </div>
          ) : (
            displayItems.map((conv, idx) => (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                  idx === selectedIndex ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
                }`}
              >
                <MessageSquareIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {conv.title || l10n.t("Untitled")}
                  </div>
                  {conv.snippet ? (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      <HighlightSnippet snippet={conv.snippet} query={query} />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {relativeTime(conv.updatedAt)} · {conv.messageCount}{" "}
                      {conv.messageCount === 1 ? l10n.t("msg") : l10n.t("msgs")}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        {displayItems.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[11px] text-muted-foreground/60">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[10px]">
                &uarr;&darr;
              </kbd>{" "}
              {l10n.t("navigate")}
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[10px]">&crarr;</kbd>{" "}
              {l10n.t("open")}
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[10px]">esc</kbd>{" "}
              {l10n.t("close")}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Highlights matching substring in the snippet */
function HighlightSnippet({ snippet, query }: { snippet: string; query: string }) {
  if (!query.trim()) return <>{snippet}</>;

  const q = query.trim().toLowerCase();
  const lower = snippet.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{snippet}</>;

  return (
    <>
      {snippet.slice(0, idx)}
      <span className="text-foreground font-medium">{snippet.slice(idx, idx + q.length)}</span>
      {snippet.slice(idx + q.length)}
    </>
  );
}
