import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  SquareIcon,
  PlusIcon,
  CopyIcon,
  CheckIcon,
  MessageSquarePlusIcon,
  AppWindowIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { l10n } from "@agentx/l10n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

interface QuickMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Reusable tooltip wrapper                                          */
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

export function QuickChatPanel() {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);

  // Sync dark mode: detect system preference → set class on <html> so CSS variables work
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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea on mount & when window becomes visible again
  useEffect(() => {
    const focus = () => setTimeout(() => textareaRef.current?.focus(), 100);
    focus();
    const win = getCurrentWebviewWindow();
    const unlisten = win.listen("quickchat:ready", () => focus());
    const handleFocus = () => focus();
    window.addEventListener("focus", handleFocus);
    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Escape key → hide window
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().hide();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cleanup event listener on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInput("");

    const userMsg: QuickMessage = { id: uuidv4(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    // Create conversation if needed
    let convId = conversationId;
    if (!convId) {
      try {
        const conv = (await window.api.conversation.create("Quick Chat")) as { id: string };
        convId = conv.id;
        setConversationId(convId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    // Add placeholder assistant message
    const assistantMsgId = uuidv4();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);
    setIsStreaming(true);
    streamingContentRef.current = "";

    // Listen for events
    cleanupRef.current?.();
    const cleanup = window.api.agent.onEvent((event: unknown) => {
      const e = event as {
        type: string;
        conversationId?: string;
        delta?: string;
        content?: string;
        error?: string;
        message?: string;
      };
      if (e.conversationId !== convId) return;

      switch (e.type) {
        case "message_delta":
          if (e.delta) {
            streamingContentRef.current += e.delta;
            const newContent = streamingContentRef.current;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: newContent } : m)),
            );
          }
          break;
        case "message_end":
          if (e.content) {
            streamingContentRef.current = e.content;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: e.content! } : m)),
            );
          }
          break;
        case "agent_end":
          setIsStreaming(false);
          if (!streamingContentRef.current) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          }
          break;
        case "error":
          setIsStreaming(false);
          setError(e.error || e.message || "Unknown error");
          if (!streamingContentRef.current) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          }
          break;
      }
    });
    cleanupRef.current = cleanup;

    try {
      await window.api.agent.send(convId, text);
      await window.api.agent.subscribe(convId);
    } catch (e) {
      setIsStreaming(false);
      setError(e instanceof Error ? e.message : String(e));
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    }
  }, [input, isStreaming, conversationId]);

  const handleAbort = useCallback(() => {
    if (conversationId) {
      window.api.agent.abort(conversationId);
    }
  }, [conversationId]);

  const handleClear = useCallback(async () => {
    if (isStreaming) return;
    if (conversationId) {
      try {
        await window.api.conversation.delete(conversationId);
      } catch {
        /* ignore */
      }
    }
    setMessages([]);
    setConversationId(null);
    setError(null);
    streamingContentRef.current = "";
  }, [conversationId, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden rounded-xl text-foreground bg-background">
      {/* Header — draggable */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/30 shrink-0"
        data-tauri-drag-region
      >
        <MessageSquarePlusIcon className="w-3.5 h-3.5 text-foreground/40" />
        <span className="text-xs font-medium text-foreground/60">{l10n.t("Quick Chat")}</span>
        <div className="flex-1" data-tauri-drag-region />
        <Tip label={l10n.t("New conversation")}>
          <button
            onClick={handleClear}
            className="flex items-center justify-center w-6 h-6 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-accent/50 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        </Tip>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-foreground/15">
            <span className="text-xs">{l10n.t("Ask anything...")}</span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words",
                msg.role === "user"
                  ? "bg-[var(--message-user-bg)] text-foreground rounded-br-sm"
                  : "bg-foreground/[0.06] text-foreground rounded-bl-sm",
              )}
            >
              {msg.content}
              {msg.role === "assistant" && !msg.content && isStreaming && (
                <span className="inline-flex gap-1 items-center h-4 px-0.5">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  <span
                    className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
              )}
            </div>
            {msg.content && (
              <Tip label={copiedId === msg.id ? l10n.t("Copied") : l10n.t("Copy")}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content);
                    setCopiedId(msg.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="mt-0.5 p-1 rounded text-foreground/20 hover:text-foreground/50 transition-colors"
                >
                  {copiedId === msg.id ? (
                    <CheckIcon className="w-3 h-3 text-green-500" />
                  ) : (
                    <CopyIcon className="w-3 h-3" />
                  )}
                </button>
              </Tip>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3.5 mb-2 px-2.5 py-1.5 text-[11px] text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/30 px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={l10n.t("Type a message...")}
            rows={1}
            className="flex-1 bg-foreground/[0.04] border border-border/40 rounded-lg resize-none outline-none text-[13px] text-foreground placeholder:text-foreground/25 max-h-[100px] leading-relaxed px-3 py-2 focus:border-foreground/15 transition-colors overflow-hidden"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Tip label={l10n.t("Stop")}>
              <button
                onClick={handleAbort}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all shrink-0"
              >
                <SquareIcon className="w-2.5 h-2.5" />
              </button>
            </Tip>
          ) : (
            <Tip label={l10n.t("Send")}>
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
            </Tip>
          )}
        </div>
      </div>

      {/* Quick actions */}
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
        <span className="text-[10px] text-foreground/20 px-1">{l10n.t("Esc to close")}</span>
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
/*  Tiny helper for the bottom action bar                             */
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
