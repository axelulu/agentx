import { useState, useCallback, useRef, useEffect } from "react";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  SquareIcon,
  CodeIcon,
  LanguagesIcon,
  FileTextIcon,
  SearchIcon,
  WrenchIcon,
  BugIcon,
  PenIcon,
  SparklesIcon,
  TerminalIcon,
  FolderIcon,
  GlobeIcon,
  BookOpenIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  ClipboardPasteIcon,
  RotateCcwIcon,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AppContext {
  app?: {
    name: string;
    pid: number;
    focusedWindow?: { title: string };
  };
  selectedText?: string;
  focusedElement?: {
    role?: string;
    value?: string;
    title?: string;
    roleDescription?: string;
  };
}

interface QuickAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
  requiresText?: boolean;
}

/* ------------------------------------------------------------------ */
/*  App-specific action configs                                        */
/* ------------------------------------------------------------------ */

function getTextActions(): QuickAction[] {
  return [
    {
      id: "explain",
      icon: BookOpenIcon,
      label: l10n.t("Explain"),
      prompt: "Please explain this:\n\n",
    },
    {
      id: "translate",
      icon: LanguagesIcon,
      label: l10n.t("Translate"),
      prompt: "Please translate this to English:\n\n",
    },
    {
      id: "rewrite",
      icon: PenIcon,
      label: l10n.t("Rewrite"),
      prompt: "Please rewrite this more clearly:\n\n",
    },
    {
      id: "summarize",
      icon: FileTextIcon,
      label: l10n.t("Summarize"),
      prompt: "Please summarize this:\n\n",
    },
    {
      id: "review",
      icon: SearchIcon,
      label: l10n.t("Code Review"),
      prompt: "Please review this code:\n\n",
      requiresText: true,
    },
  ];
}

function getCodeActions(): QuickAction[] {
  return [
    {
      id: "explain",
      icon: BookOpenIcon,
      label: l10n.t("Explain"),
      prompt: "Please explain this code in detail:\n\n",
    },
    {
      id: "review",
      icon: SearchIcon,
      label: l10n.t("Review"),
      prompt: "Please review this code and suggest improvements:\n\n",
    },
    {
      id: "optimize",
      icon: WrenchIcon,
      label: l10n.t("Optimize"),
      prompt: "Please optimize this code:\n\n",
    },
    {
      id: "debug",
      icon: BugIcon,
      label: l10n.t("Debug"),
      prompt: "Please find bugs in this code:\n\n",
    },
    {
      id: "convert",
      icon: CodeIcon,
      label: l10n.t("Convert"),
      prompt: "Please convert this code to another language:\n\n",
    },
    {
      id: "rewrite",
      icon: PenIcon,
      label: l10n.t("Rewrite"),
      prompt: "Please rewrite this code more cleanly:\n\n",
    },
  ];
}

function getTerminalActions(): QuickAction[] {
  return [
    {
      id: "explain",
      icon: BookOpenIcon,
      label: l10n.t("Explain Command"),
      prompt: "Please explain this terminal command or output:\n\n",
    },
    {
      id: "fix",
      icon: BugIcon,
      label: l10n.t("Fix Error"),
      prompt: "Please help fix this terminal error:\n\n",
    },
    {
      id: "suggest",
      icon: SparklesIcon,
      label: l10n.t("Suggest"),
      prompt: "Suggest a better command for:\n\n",
    },
  ];
}

function getBrowserActions(): QuickAction[] {
  return [
    {
      id: "summarize",
      icon: FileTextIcon,
      label: l10n.t("Summarize Page"),
      prompt: "Please summarize this web page content:\n\n",
    },
    {
      id: "explain",
      icon: BookOpenIcon,
      label: l10n.t("Explain"),
      prompt: "Please explain this:\n\n",
    },
    {
      id: "translate",
      icon: LanguagesIcon,
      label: l10n.t("Translate"),
      prompt: "Please translate this to English:\n\n",
    },
    {
      id: "extract",
      icon: SparklesIcon,
      label: l10n.t("Extract Key Points"),
      prompt: "Please extract the key points from:\n\n",
    },
  ];
}

function getFinderActions(): QuickAction[] {
  return [
    {
      id: "analyze",
      icon: SparklesIcon,
      label: l10n.t("Analyze Files"),
      prompt: "Please analyze these files:\n\n",
    },
    {
      id: "organize",
      icon: FolderIcon,
      label: l10n.t("Organize"),
      prompt: "Please suggest how to organize these files:\n\n",
    },
    {
      id: "summarize",
      icon: FileTextIcon,
      label: l10n.t("Summarize"),
      prompt: "Please summarize the contents of:\n\n",
    },
  ];
}

function getDefaultActions(): QuickAction[] {
  return [
    {
      id: "explain",
      icon: BookOpenIcon,
      label: l10n.t("Explain"),
      prompt: "Please explain this:\n\n",
    },
    {
      id: "translate",
      icon: LanguagesIcon,
      label: l10n.t("Translate"),
      prompt: "Please translate this to English:\n\n",
    },
    {
      id: "rewrite",
      icon: PenIcon,
      label: l10n.t("Rewrite"),
      prompt: "Please rewrite this more clearly:\n\n",
    },
    {
      id: "summarize",
      icon: FileTextIcon,
      label: l10n.t("Summarize"),
      prompt: "Please summarize this:\n\n",
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Detect the app category from the app name */
function getAppCategory(appName: string): "code" | "terminal" | "browser" | "finder" | "general" {
  const name = appName.toLowerCase();
  if (
    name.includes("code") ||
    name.includes("xcode") ||
    name.includes("intellij") ||
    name.includes("webstorm") ||
    name.includes("pycharm") ||
    name.includes("cursor") ||
    name.includes("sublime") ||
    name.includes("atom") ||
    name.includes("vim") ||
    name.includes("emacs") ||
    name.includes("nova") ||
    name.includes("zed")
  ) {
    return "code";
  }
  if (
    name.includes("terminal") ||
    name.includes("iterm") ||
    name.includes("warp") ||
    name.includes("kitty") ||
    name.includes("alacritty") ||
    name.includes("hyper")
  ) {
    return "terminal";
  }
  if (
    name.includes("safari") ||
    name.includes("chrome") ||
    name.includes("firefox") ||
    name.includes("edge") ||
    name.includes("brave") ||
    name.includes("arc") ||
    name.includes("opera") ||
    name.includes("vivaldi") ||
    name.includes("orion")
  ) {
    return "browser";
  }
  if (name.includes("finder") || name.includes("path finder")) {
    return "finder";
  }
  return "general";
}

function getActionsForCategory(
  category: "code" | "terminal" | "browser" | "finder" | "general",
  hasText: boolean,
): QuickAction[] {
  if (!hasText) {
    // Without text, only show category-specific non-text actions
    switch (category) {
      case "finder":
        return getFinderActions();
      default:
        return getDefaultActions().filter((a) => !a.requiresText);
    }
  }
  switch (category) {
    case "code":
      return getCodeActions();
    case "terminal":
      return getTerminalActions();
    case "browser":
      return getBrowserActions();
    case "finder":
      return getFinderActions();
    default:
      return getTextActions();
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "code":
      return CodeIcon;
    case "terminal":
      return TerminalIcon;
    case "browser":
      return GlobeIcon;
    case "finder":
      return FolderIcon;
    default:
      return SparklesIcon;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "code":
      return l10n.t("Code Editor");
    case "terminal":
      return l10n.t("Terminal");
    case "browser":
      return l10n.t("Browser");
    case "finder":
      return l10n.t("Finder");
    default:
      return l10n.t("General");
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ContextBarPanel() {
  const [context, setContext] = useState<AppContext | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [answer, setAnswer] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);
  const convIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    convIdRef.current = convId;
  }, [convId]);

  // Dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Hide window helper — aborts streaming if active, then hides
  const hideWindow = useCallback(() => {
    if (convIdRef.current) {
      invoke("agent_abort", { conversationId: convIdRef.current }).catch(() => {});
    }
    setIsStreaming(false);
    getCurrentWebviewWindow().hide();
  }, []);

  // Reset conversation — start fresh without closing
  const resetConversation = useCallback(() => {
    if (convIdRef.current) {
      invoke("agent_abort", { conversationId: convIdRef.current }).catch(() => {});
    }
    setAnswer("");
    setConvId(null);
    setIsStreaming(false);
    streamingRef.current = "";
    setInput("");
    setCopied(false);
    setApplied(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Parse and apply context — supports partial updates (app info first, then selected text)
  const applyContext = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as AppContext;
      setContext((prev) => {
        // If this is a new app (different from previous), reset conversation
        const isNewInvocation =
          !prev || prev.app?.name !== parsed.app?.name || prev.app?.pid !== parsed.app?.pid;
        if (isNewInvocation) {
          setAnswer("");
          setConvId(null);
          streamingRef.current = "";
          setInput("");
          setCopied(false);
          setApplied(false);
        }
        return parsed;
      });
    } catch {
      // Don't null out context on parse error — keep previous
    }
  }, []);

  // Listen for context updates from backend (arrives after async gather)
  useEffect(() => {
    const unlisten = listen<string>("contextbar:set-context", (event) => {
      applyContext(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [applyContext]);

  // On mount + on window focus: try fetching cached context from Rust
  useEffect(() => {
    const fetchCached = () => {
      invoke<string | null>("contextbar_get_context")
        .then((cached) => {
          if (cached) applyContext(cached);
        })
        .catch(() => {});
    };
    // Fetch immediately on mount
    fetchCached();
    // Also fetch when window gains focus (panel re-shown)
    window.addEventListener("focus", fetchCached);
    return () => window.removeEventListener("focus", fetchCached);
  }, [applyContext]);

  // Escape to hide — works globally, aborts streaming first
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        hideWindow();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [hideWindow]);

  // Focus textarea
  useEffect(() => {
    const handleFocus = () => setTimeout(() => textareaRef.current?.focus(), 100);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
    }
  }, [input]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Send message to agent                                            */
  /* ---------------------------------------------------------------- */
  const sendToAgent = useCallback(
    async (prompt: string) => {
      if (isStreaming) return;

      setAnswer("");
      streamingRef.current = "";
      setIsStreaming(true);

      let cid = convId;
      if (!cid) {
        try {
          const conv = (await invoke("conversation_create", {
            title: l10n.t("Context Action"),
          })) as {
            id: string;
          };
          cid = conv.id;
          setConvId(cid);
        } catch {
          setIsStreaming(false);
          return;
        }
      }

      cleanupRef.current?.();
      const cleanup = listen<unknown>("agent:event", (event) => {
        const e = event.payload as {
          type: string;
          conversationId?: string;
          delta?: string;
          content?: string;
        };
        if (e.conversationId !== cid) return;

        switch (e.type) {
          case "message_delta":
            if (e.delta) {
              streamingRef.current += e.delta;
              setAnswer(streamingRef.current);
            }
            break;
          case "message_end":
            if (e.content) {
              streamingRef.current = e.content;
              setAnswer(e.content);
            }
            break;
          case "agent_end":
          case "error":
            setIsStreaming(false);
            break;
        }
      });

      cleanup.then((fn) => {
        cleanupRef.current = fn;
      });

      try {
        await invoke("agent_send", { conversationId: cid, content: prompt });
        await invoke("agent_subscribe", { conversationId: cid });
      } catch {
        setIsStreaming(false);
      }
    },
    [isStreaming, convId],
  );

  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      const selectedText = context?.selectedText ?? "";

      // For translate action, call translate_run directly for clean results
      if (action.id === "translate" && selectedText) {
        setAnswer("");
        streamingRef.current = "";
        setIsStreaming(true);
        try {
          // Auto-detect target language: if source is mostly Chinese → English, otherwise → Chinese
          const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
          const chineseChars = (selectedText.match(chineseRegex) || []).length;
          const targetLang = chineseChars > selectedText.length * 0.3 ? "en" : "zh";

          const result = await invoke<{ text: string; error?: string }>("translate_run", {
            text: selectedText,
            targetLang,
          });
          if (result.error) {
            setAnswer(`Error: ${result.error}`);
          } else {
            setAnswer(result.text);
          }
        } catch (err) {
          setAnswer(`Error: ${err}`);
        } finally {
          setIsStreaming(false);
        }
        return;
      }

      const prompt = action.prompt + selectedText;
      sendToAgent(prompt);
    },
    [context, sendToAgent],
  );

  const handleCustomSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const selectedText = context?.selectedText;
    const prompt = selectedText ? `${text}\n\n${selectedText}` : text;
    setInput("");
    sendToAgent(prompt);
  }, [input, context, sendToAgent]);

  const handleAbort = useCallback(() => {
    if (convId) invoke("agent_abort", { conversationId: convId });
  }, [convId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      handleCustomSend();
    }
  };

  const handleCopy = useCallback(() => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [answer]);

  // Apply result back — copy answer to clipboard, hide panel, then paste into original app
  const handleApply = useCallback(async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setApplied(true);
      // Hide panel first so original app regains focus
      getCurrentWebviewWindow().hide();
      // Small delay to let original app receive focus, then simulate Cmd+V
      setTimeout(async () => {
        try {
          await invoke("simulate_paste");
        } catch {
          // simulate_paste might not exist — that's OK, clipboard already has the text
        }
      }, 200);
    } catch {
      // Fallback: just copy
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [answer]);

  /* ---------------------------------------------------------------- */
  /*  Derived state                                                    */
  /* ---------------------------------------------------------------- */

  const hasContext = context !== null && context.app !== undefined;
  const appName = context?.app?.name ?? "";
  const windowTitle = context?.app?.focusedWindow?.title ?? "";
  const selectedText = context?.selectedText ?? "";
  const category = hasContext ? getAppCategory(appName) : "general";
  const actions = getActionsForCategory(category, selectedText.length > 0);
  const CategoryIcon = getCategoryIcon(category);
  const categoryLabel = hasContext ? getCategoryLabel(category) : "";
  const canSend = input.trim().length > 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden rounded-xl text-foreground bg-background border border-border">
      {/* Header: App context */}
      <div
        className="flex items-center gap-2 px-3.5 py-2 border-b border-border shrink-0"
        data-tauri-drag-region
      >
        <CategoryIcon className="w-3.5 h-3.5 text-primary/70" />
        <div className="flex-1 min-w-0" data-tauri-drag-region>
          <div className="flex items-center gap-1.5">
            {hasContext ? (
              <>
                <span className="text-xs font-medium text-foreground/70 truncate">{appName}</span>
                <span className="text-[10px] text-foreground/30 px-1 py-0.5 rounded bg-foreground/[0.04]">
                  {categoryLabel}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-foreground/40">
                {l10n.t("Context Bar")}
              </span>
            )}
          </div>
          {windowTitle && (
            <div className="text-[10px] text-foreground/30 truncate mt-0.5">{windowTitle}</div>
          )}
        </div>
        {/* Close button with CSS tooltip */}
        <div className="relative group">
          <button
            onClick={hideWindow}
            className="p-1 rounded hover:bg-foreground/[0.08] text-foreground/25 hover:text-foreground/50 transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
          <div className="absolute right-0 top-full mt-1 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap z-50 pointer-events-none shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            Close <span className="opacity-60">Esc</span>
          </div>
        </div>
      </div>

      {/* Selected text preview */}
      {selectedText ? (
        <div className="px-3.5 py-2 border-b border-border shrink-0">
          <div className="text-[10px] font-medium text-foreground/30 uppercase tracking-wider mb-1">
            {l10n.t("Selected Text")}
          </div>
          <div className="text-[11px] text-foreground/60 font-mono bg-foreground/[0.02] rounded-md px-2 py-1.5 max-h-[60px] overflow-y-auto line-clamp-3 whitespace-pre-wrap">
            {selectedText.slice(0, 500)}
            {selectedText.length > 500 && "…"}
          </div>
        </div>
      ) : hasContext ? (
        <div className="px-3.5 py-1.5 border-b border-border shrink-0">
          <div className="text-[10px] text-foreground/25 italic">
            {l10n.t("No text selected — select text first, then press shortcut")}
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="px-3.5 py-2 border-b border-border shrink-0">
        <div className="text-[10px] font-medium text-foreground/30 uppercase tracking-wider mb-1.5">
          {l10n.t("Quick Actions")}
        </div>
        <div className="flex flex-wrap gap-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={isStreaming}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]",
                  "bg-foreground/[0.06] hover:bg-foreground/[0.12] transition-colors",
                  "text-foreground/70 hover:text-foreground/90",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <Icon className="w-3 h-3 opacity-70" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom input */}
      <div className="px-3.5 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedText ? l10n.t("Ask about selected text...") : l10n.t("Ask anything...")
            }
            rows={1}
            className="flex-1 bg-foreground/[0.04] border border-border rounded-lg resize-none outline-none text-[12px] text-foreground placeholder:text-foreground/25 max-h-[80px] leading-relaxed px-2.5 py-1.5 focus:border-foreground/15 transition-colors overflow-hidden"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={handleAbort}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all shrink-0"
            >
              <SquareIcon className="w-2 h-2" />
            </button>
          ) : (
            <button
              onClick={handleCustomSend}
              disabled={!canSend}
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full transition-all shrink-0",
                canSend
                  ? "bg-foreground text-background hover:opacity-90"
                  : "bg-foreground/[0.06] text-muted-foreground/25",
              )}
            >
              <ArrowUpIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Answer area */}
      <div className="flex-1 overflow-y-auto">
        {answer ? (
          <div className="p-3.5">
            <div className="text-[12px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {answer}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3 bg-foreground/30 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[11px] text-foreground/15">
            {isStreaming ? l10n.t("Thinking...") : l10n.t("Select an action or ask a question")}
          </div>
        )}
      </div>

      {/* Bottom bar — always visible when there's an answer */}
      {answer && !isStreaming && (
        <div className="border-t border-border px-2.5 py-1.5 flex items-center gap-1 shrink-0">
          {/* Copy to clipboard */}
          <button
            onClick={handleCopy}
            title={l10n.t("Copy to clipboard")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-foreground/40 hover:text-foreground/70 hover:bg-accent/50 transition-colors"
          >
            {copied ? (
              <CheckIcon className="w-3 h-3 text-green-500" />
            ) : (
              <CopyIcon className="w-3 h-3" />
            )}
            {copied ? l10n.t("Copied") : l10n.t("Copy")}
          </button>
          {/* Apply — paste result back to original app */}
          <button
            onClick={handleApply}
            title={l10n.t("Apply to original app (paste)")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-foreground/40 hover:text-foreground/70 hover:bg-accent/50 transition-colors"
          >
            {applied ? (
              <CheckIcon className="w-3 h-3 text-green-500" />
            ) : (
              <ClipboardPasteIcon className="w-3 h-3" />
            )}
            {applied ? l10n.t("Applied") : l10n.t("Apply")}
          </button>
          {/* Reset — new conversation in panel */}
          <button
            onClick={resetConversation}
            title={l10n.t("Start over")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-foreground/40 hover:text-foreground/70 hover:bg-accent/50 transition-colors"
          >
            <RotateCcwIcon className="w-3 h-3" />
            {l10n.t("Reset")}
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-foreground/20">{l10n.t("Esc to close")}</span>
        </div>
      )}
    </div>
  );
}
