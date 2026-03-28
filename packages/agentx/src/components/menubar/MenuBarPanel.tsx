import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  SquareIcon,
  MessageSquareIcon,
  AppWindowIcon,
  SettingsIcon,
  LogOutIcon,
  ActivityIcon,
  BellIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { l10n } from "@agentx/l10n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConvSummary {
  id: string;
  title: string;
  updatedAt?: number;
  createdAt?: number;
}

/* ------------------------------------------------------------------ */
/*  Tooltip helper                                                     */
/* ------------------------------------------------------------------ */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Time formatting helper                                             */
/* ------------------------------------------------------------------ */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return l10n.t("just now");
  if (mins < 60) return l10n.t("${count}m ago", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return l10n.t("${count}h ago", { count: hours });
  const days = Math.floor(hours / 24);
  return l10n.t("${count}d ago", { count: days });
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export function MenuBarPanel() {
  const [isDark, setIsDark] = useState(false);
  const [runningConversations, setRunningConversations] = useState<string[]>([]);
  const [recentConversations, setRecentConversations] = useState<ConvSummary[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState(0);

  // Quick ask state
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState("");
  const [quickConvId, setQuickConvId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);

  // Dark mode sync
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => {
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Fetch data on mount and on refresh event
  const fetchData = useCallback(async () => {
    try {
      const [convs, running] = await Promise.all([
        window.api.conversation.list() as Promise<ConvSummary[]>,
        window.api.agent.runningConversations(),
      ]);

      const sorted = [...convs]
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        .slice(0, 5);
      setRecentConversations(sorted);
      setRunningConversations(running);
      setPendingNotifications(running.length);
    } catch (e) {
      console.error("[MenuBar] Failed to fetch data:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const win = getCurrentWebviewWindow();
    const unlistenReady = win.listen("menubar:ready", () => {
      fetchData();
      textareaRef.current?.focus();
    });
    const unlistenRefresh = win.listen("menubar:refresh", () => {
      fetchData();
      textareaRef.current?.focus();
    });

    // Poll running agents every 3s while visible
    const interval = setInterval(async () => {
      try {
        const running = await window.api.agent.runningConversations();
        setRunningConversations(running);
        setPendingNotifications(running.length);
      } catch {
        /* ignore */
      }
    }, 3000);

    return () => {
      unlistenReady.then((fn) => fn());
      unlistenRefresh.then((fn) => fn());
      clearInterval(interval);
    };
  }, [fetchData]);

  // Focus on window focus
  useEffect(() => {
    const handleFocus = () => setTimeout(() => textareaRef.current?.focus(), 100);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Escape to hide
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWebviewWindow().hide();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
    }
  }, [input]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Quick Ask                                                        */
  /* ---------------------------------------------------------------- */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setQuickAnswer("");
    streamingRef.current = "";

    let convId = quickConvId;
    if (!convId) {
      try {
        const conv = (await window.api.conversation.create("Quick Ask")) as { id: string };
        convId = conv.id;
        setQuickConvId(convId);
      } catch {
        return;
      }
    }

    setIsStreaming(true);

    cleanupRef.current?.();
    const cleanup = window.api.agent.onEvent((event: unknown) => {
      const e = event as {
        type: string;
        conversationId?: string;
        delta?: string;
        content?: string;
      };
      if (e.conversationId !== convId) return;

      switch (e.type) {
        case "message_delta":
          if (e.delta) {
            streamingRef.current += e.delta;
            setQuickAnswer(streamingRef.current);
          }
          break;
        case "message_end":
          if (e.content) {
            streamingRef.current = e.content;
            setQuickAnswer(e.content);
          }
          break;
        case "agent_end":
        case "error":
          setIsStreaming(false);
          break;
      }
    });
    cleanupRef.current = cleanup;

    try {
      await window.api.agent.send(convId, text);
      await window.api.agent.subscribe(convId);
    } catch {
      setIsStreaming(false);
    }
  }, [input, isStreaming, quickConvId]);

  const handleAbort = useCallback(() => {
    if (quickConvId) window.api.agent.abort(quickConvId);
  }, [quickConvId]);

  const handleClear = useCallback(async () => {
    if (isStreaming) return;
    if (quickConvId) {
      try {
        await window.api.conversation.delete(quickConvId);
      } catch {
        /* ignore */
      }
    }
    setQuickAnswer("");
    setQuickConvId(null);
    setInput("");
    streamingRef.current = "";
  }, [quickConvId, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      handleSend();
    }
  };

  const openConversation = (id: string) => {
    getCurrentWebviewWindow().hide();
    invoke("window_show_and_emit", { event: `navigate:${id}` });
  };

  const canSend = input.trim().length > 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden rounded-xl text-foreground bg-background border border-border/20">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2 border-b border-border/30 shrink-0"
        data-tauri-drag-region
      >
        <span className="text-xs font-medium text-foreground/50" data-tauri-drag-region>
          AgentX
        </span>
        <div className="flex-1" data-tauri-drag-region />
        {pendingNotifications > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10">
            <BellIcon className="w-3 h-3 text-primary/70" />
            <span className="text-[10px] font-medium text-primary/70">{pendingNotifications}</span>
          </div>
        )}
      </div>

      {/* Quick Ask — fixed */}
      <div className="shrink-0">
        <div className="px-3.5 py-2.5 border-b border-border/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
              {l10n.t("Quick Ask")}
            </div>
            <Tip label={l10n.t("New conversation")}>
              <button
                onClick={handleClear}
                disabled={isStreaming}
                className="flex items-center justify-center w-5 h-5 rounded text-foreground/25 hover:text-foreground/60 hover:bg-accent/50 transition-colors disabled:opacity-30"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </Tip>
          </div>
          {/* Input */}
          <div className="flex items-center gap-1.5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={l10n.t("Ask anything...")}
              rows={1}
              className="flex-1 bg-foreground/[0.04] border border-border/40 rounded-lg resize-none outline-none text-[13px] text-foreground placeholder:text-foreground/25 max-h-[100px] leading-relaxed px-2.5 py-1.5 focus:border-foreground/15 transition-colors overflow-hidden"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={handleAbort}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all shrink-0"
              >
                <SquareIcon className="w-2.5 h-2.5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full transition-all shrink-0",
                  canSend
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-foreground/[0.06] text-muted-foreground/25",
                )}
              >
                <ArrowUpIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Answer area — always visible */}
          <div className="mt-2 rounded-lg bg-foreground/[0.03] border border-border/20 min-h-[80px] max-h-[160px] overflow-y-auto">
            {quickAnswer ? (
              <div className="p-2.5 text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                {quickAnswer}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 bg-foreground/30 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[80px] text-[11px] text-foreground/15">
                {l10n.t("Answers appear here")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent conversations — fills remaining space */}
      <div className="flex-1 overflow-y-auto px-3.5 py-2.5 border-b border-border/20">
        <div className="text-[10px] font-medium text-foreground/30 uppercase tracking-wider mb-2">
          {l10n.t("Recent Conversations")}
        </div>
        {recentConversations.length === 0 ? (
          <div className="text-[11px] text-foreground/20 py-2">
            {l10n.t("No conversations yet")}
          </div>
        ) : (
          <div className="space-y-0.5">
            {recentConversations.map((conv) => {
              const isRunning = runningConversations.includes(conv.id);
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left group"
                >
                  {isRunning ? (
                    <ActivityIcon className="w-3 h-3 text-blue-500 shrink-0 animate-pulse" />
                  ) : (
                    <MessageSquareIcon className="w-3 h-3 text-foreground/20 shrink-0" />
                  )}
                  <span className="flex-1 text-[12px] text-foreground/70 truncate">
                    {conv.title || l10n.t("Untitled")}
                  </span>
                  <span className="text-[10px] text-foreground/20 shrink-0">
                    {timeAgo(conv.updatedAt || conv.createdAt || 0)}
                  </span>
                  <ChevronRightIcon className="w-3 h-3 text-foreground/10 group-hover:text-foreground/30 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-border/30 px-2 py-1.5 flex items-center gap-0.5 shrink-0">
        <ActionButton
          icon={AppWindowIcon}
          label={l10n.t("Open AgentX")}
          onClick={() => {
            getCurrentWebviewWindow().hide();
            invoke("window_show_and_emit", { event: "shortcut:new-conversation" });
          }}
        />
        <ActionButton
          icon={SettingsIcon}
          label={l10n.t("Settings")}
          onClick={() => {
            getCurrentWebviewWindow().hide();
            invoke("window_show_and_emit", { event: "shortcut:settings" });
          }}
        />
        <div className="flex-1" />
        <span className="text-[10px] text-foreground/20 px-1">Esc</span>
        <ActionButton
          icon={LogOutIcon}
          label={l10n.t("Quit")}
          onClick={() => emit("app:quit-requested", {})}
          className="text-destructive/50 hover:text-destructive"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ActionButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Tip label={label}>
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-foreground/40 hover:text-foreground/70 hover:bg-accent/50 transition-colors",
          className,
        )}
      >
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </button>
    </Tip>
  );
}
