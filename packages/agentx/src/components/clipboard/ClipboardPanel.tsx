import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  Clipboard,
  Copy,
  Check,
  X,
  Loader2,
  Languages,
  FileText,
  Code2,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";

/** Content type auto-detected from clipboard text. */
type ContentType = "code" | "text" | "url";

/** Available AI actions for clipboard processing. */
const ACTIONS = [
  { id: "translate", label: "翻译", labelEn: "Translate", icon: Languages },
  { id: "summarize", label: "总结", labelEn: "Summarize", icon: FileText },
  { id: "explain", label: "解释", labelEn: "Explain", icon: Sparkles },
  { id: "rewrite", label: "改写", labelEn: "Rewrite", icon: RefreshCw },
  { id: "code-explain", label: "代码解释", labelEn: "Explain Code", icon: Code2 },
  { id: "format", label: "格式转换", labelEn: "Convert", icon: ArrowRightLeft },
] as const;

type ActionId = (typeof ACTIONS)[number]["id"];

/** Detect content type from text. */
function detectContentType(text: string): ContentType {
  // URL detection
  if (/^https?:\/\/\S+$/i.test(text.trim())) return "url";

  // Code detection heuristics
  const codeIndicators = [
    /^(import|export|from|require|const|let|var|function|class|interface|type|enum|def|fn|pub|use|package|#include)\s/m,
    /[{};]\s*$/m,
    /=>\s*[{(]/m,
    /\(\)\s*[{:]/m,
    /^\s*(if|for|while|switch|match|return)\s*[({]/m,
    /\.\w+\(.*\)/m,
  ];
  const codeScore = codeIndicators.filter((re) => re.test(text)).length;
  if (codeScore >= 2) return "code";

  return "text";
}

/** Get recommended actions based on content type. */
function getRecommendedActions(type: ContentType): ActionId[] {
  switch (type) {
    case "code":
      return ["code-explain", "rewrite", "translate"];
    case "url":
      return ["summarize", "translate", "explain"];
    case "text":
      return ["translate", "summarize", "rewrite"];
  }
}

export function ClipboardPanel() {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [result, setResult] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Detect system dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Listen for clipboard content from Rust backend
  useEffect(() => {
    const unlisten = listen<string>("clipboard:set-content", (event) => {
      const text = event.payload;
      setContent(text);
      setResult("");
      setActiveAction(null);
      setContentType(detectContentType(text));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().hide();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const runAction = useCallback(
    async (actionId: ActionId) => {
      if (!content.trim()) return;

      // Abort previous
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setActiveAction(actionId);
      setIsProcessing(true);
      setResult("");

      try {
        const res = await invoke<{ text: string; error?: string }>("clipboard_process", {
          text: content,
          action: actionId,
        });

        if (abortRef.current?.signal.aborted) return;

        if (res.error) {
          setResult(`Error: ${res.error}`);
        } else {
          setResult(res.text);
        }
      } catch (err) {
        if (abortRef.current?.signal.aborted) return;
        setResult(`Error: ${err}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [content],
  );

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    // Also write to system clipboard via Rust for cross-app pasting
    invoke("clipboard_write", { text: result }).catch(() => {});
    setTimeout(() => setCopied(false), 1500);
  }

  function handleCopyAndClose() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    invoke("clipboard_write", { text: result }).catch(() => {});
    getCurrentWebviewWindow().hide();
  }

  function handleClose() {
    getCurrentWebviewWindow().hide();
  }

  const recommended = getRecommendedActions(contentType);
  const typeLabel = contentType === "code" ? "Code" : contentType === "url" ? "URL" : "Text";

  return (
    <div className={isDark ? "dark" : ""}>
      <div
        className="w-screen h-screen flex flex-col overflow-hidden rounded-xl border border-border/50 shadow-2xl"
        style={{
          background: isDark ? "rgba(30, 30, 30, 0.92)" : "rgba(255, 255, 255, 0.92)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-border/30"
          data-tauri-drag-region
        >
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground/80">Clipboard AI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/30 text-foreground/50">
              {typeLabel}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-accent/50 text-foreground/50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Source content */}
        <div className="px-3 py-2 border-b border-border/20 max-h-[100px] overflow-y-auto">
          <p className="text-xs text-foreground/60 mb-1">Clipboard</p>
          <p className="text-xs text-foreground/80 leading-relaxed select-text whitespace-pre-wrap font-mono">
            {content.length > 500 ? content.slice(0, 500) + "..." : content}
          </p>
        </div>

        {/* Action buttons */}
        <div className="px-3 py-2 border-b border-border/20">
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const isRecommended = recommended.includes(action.id);
              const isActive = activeAction === action.id;
              return (
                <button
                  key={action.id}
                  onClick={() => runAction(action.id)}
                  disabled={isProcessing}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isRecommended
                        ? "bg-accent/60 text-foreground/80 hover:bg-accent/80 ring-1 ring-primary/20"
                        : "bg-accent/30 text-foreground/60 hover:bg-accent/50"
                  } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result */}
        <div className="flex-1 px-3 py-2 overflow-y-auto min-h-0">
          {isProcessing ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs text-foreground/50">Processing...</span>
            </div>
          ) : result ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-foreground/60">Result</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded-md hover:bg-accent/50 text-foreground/50 transition-colors"
                    title="Copy"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed select-text whitespace-pre-wrap">
                {result}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-foreground/30">Select an action above</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] text-foreground/30">⌥⌘A to open clipboard AI</span>
          <div className="flex items-center gap-2">
            {result && !isProcessing && (
              <button
                onClick={handleCopyAndClose}
                className="text-[10px] px-2 py-0.5 rounded bg-primary/80 text-primary-foreground hover:bg-primary transition-colors"
              >
                Copy & Close
              </button>
            )}
            <span className="text-[10px] text-foreground/30">Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
