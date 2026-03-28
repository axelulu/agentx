import { useState, useRef, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/slices/store";
import { setClipboardOpen } from "@/slices/uiSlice";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import {
  Clipboard,
  Copy,
  Check,
  Languages,
  FileText,
  Code2,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";

type ContentType = "code" | "text" | "url";

const ACTIONS = [
  { id: "translate", label: "翻译", icon: Languages },
  { id: "summarize", label: "总结", icon: FileText },
  { id: "explain", label: "解释", icon: Sparkles },
  { id: "rewrite", label: "改写", icon: RefreshCw },
  { id: "code-explain", label: "代码解释", icon: Code2 },
  { id: "format", label: "格式转换", icon: ArrowRightLeft },
] as const;

type ActionId = (typeof ACTIONS)[number]["id"];

function detectContentType(text: string): ContentType {
  if (/^https?:\/\/\S+$/i.test(text.trim())) return "url";
  const codeIndicators = [
    /^(import|export|from|require|const|let|var|function|class|interface|type|enum|def|fn|pub|use|package|#include)\s/m,
    /[{};]\s*$/m,
    /=>\s*[{(]/m,
    /\(\)\s*[{:]/m,
    /^\s*(if|for|while|switch|match|return)\s*[({]/m,
    /\.\w+\(.*\)/m,
  ];
  if (codeIndicators.filter((re) => re.test(text)).length >= 2) return "code";
  return "text";
}

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

export function ClipboardDialog() {
  const dispatch = useDispatch<AppDispatch>();
  const { clipboardOpen } = useSelector((state: RootState) => state.ui);

  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [result, setResult] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Listen for global shortcut event from Rust
  // Note: The global shortcut now opens the standalone clipboard window.
  // This dialog serves as a fallback when triggered from within the main app.
  useEffect(() => {
    const unlisten = listen("clipboard:open", () => {
      dispatch(setClipboardOpen(true));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [dispatch]);

  // Auto-read clipboard when dialog opens
  useEffect(() => {
    if (clipboardOpen) {
      setResult("");
      setActiveAction(null);
      setCopied(false);
      invoke<string>("clipboard_read")
        .then((text) => {
          setContent(text);
          setContentType(detectContentType(text));
        })
        .catch(() => {
          setContent("");
          setContentType("text");
        });
    }
  }, [clipboardOpen]);

  const runAction = useCallback(
    async (actionId: ActionId) => {
      if (!content.trim()) return;
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
        setResult(res.error ? `Error: ${res.error}` : res.text);
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
    invoke("clipboard_write", { text: result }).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleCopyAndClose() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    invoke("clipboard_write", { text: result }).catch(() => {});
    dispatch(setClipboardOpen(false));
  }

  const recommended = getRecommendedActions(contentType);
  const typeLabel = contentType === "code" ? "Code" : contentType === "url" ? "URL" : "Text";

  return (
    <Dialog open={clipboardOpen} onOpenChange={(open) => dispatch(setClipboardOpen(open))}>
      <DialogContent showCloseButton={false} maxWidth="lg" className="p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Clipboard className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {l10n.t("Clipboard AI")}
          </span>
          {content && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {typeLabel}
            </span>
          )}
        </div>

        {/* Clipboard content preview */}
        {content ? (
          <div className="px-4 py-2.5 border-b border-border max-h-[120px] overflow-y-auto select-text">
            <MarkdownRenderer
              content={content.length > 800 ? content.slice(0, 800) + "..." : content}
              className="text-xs text-muted-foreground"
            />
          </div>
        ) : (
          <div className="px-4 py-6 border-b border-border text-center">
            <p className="text-sm text-muted-foreground">{l10n.t("Clipboard is empty")}</p>
          </div>
        )}

        {/* Action buttons */}
        {content && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                const isActive = activeAction === action.id;
                return (
                  <Button
                    key={action.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => runAction(action.id)}
                    disabled={isProcessing && !isActive}
                    className={cn(
                      "gap-1.5 active:scale-100 border",
                      isActive ? "border-transparent" : "",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Result area */}
        <div className="max-h-[280px] overflow-y-auto">
          {isProcessing ? (
            <div className="px-4 py-4 space-y-3">
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded-md bg-foreground/[0.06] animate-pulse" />
                <div className="h-3.5 w-[90%] rounded-md bg-foreground/[0.06] animate-pulse" />
                <div className="h-3.5 w-[75%] rounded-md bg-foreground/[0.06] animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-[85%] rounded-md bg-foreground/[0.06] animate-pulse" />
                <div className="h-3.5 w-[60%] rounded-md bg-foreground/[0.06] animate-pulse" />
              </div>
            </div>
          ) : result ? (
            <div className="px-4 py-3 select-text">
              <MarkdownRenderer content={result} />
            </div>
          ) : content ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">{l10n.t("Select an action above")}</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-muted-foreground/60">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[10px]">⌥⌘A</kbd>{" "}
              {l10n.t("open")}
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[10px]">esc</kbd>{" "}
              {l10n.t("close")}
            </span>
          </div>
          {result && !isProcessing && (
            <button
              onClick={handleCopyAndClose}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3 shrink-0" />
              {l10n.t("Copy & Close")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
