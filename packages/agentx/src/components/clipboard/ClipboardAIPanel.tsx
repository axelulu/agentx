import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Clipboard,
  Copy,
  Check,
  Loader2,
  Languages,
  FileText,
  Code2,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";
import { l10n } from "@agentx/l10n";

type ContentType = "code" | "text" | "url";

const ACTIONS = [
  { id: "translate", label: "翻译", labelEn: "Translate", icon: Languages },
  { id: "summarize", label: "总结", labelEn: "Summarize", icon: FileText },
  { id: "explain", label: "解释", labelEn: "Explain", icon: Sparkles },
  { id: "rewrite", label: "改写", labelEn: "Rewrite", icon: RefreshCw },
  { id: "code-explain", label: "代码解释", labelEn: "Explain Code", icon: Code2 },
  { id: "format", label: "格式转换", labelEn: "Convert", icon: ArrowRightLeft },
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

export function ClipboardAIPanel() {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [result, setResult] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [copied, setCopied] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const readClipboard = useCallback(async () => {
    setIsReading(true);
    try {
      const text = await invoke<string>("clipboard_read");
      setContent(text);
      setResult("");
      setActiveAction(null);
      setContentType(detectContentType(text));
    } catch (err) {
      setContent("");
      setContentType("text");
    } finally {
      setIsReading(false);
    }
  }, []);

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
    invoke("clipboard_write", { text: result }).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const recommended = getRecommendedActions(contentType);
  const typeLabel = contentType === "code" ? "Code" : contentType === "url" ? "URL" : "Text";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Clipboard className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{l10n.t("Clipboard AI")}</span>
          {content && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/50 text-foreground/50">
              {typeLabel}
            </span>
          )}
        </div>
        <button
          onClick={readClipboard}
          disabled={isReading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isReading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Clipboard className="w-3.5 h-3.5" />
          )}
          {l10n.t("Read Clipboard")}
        </button>
      </div>

      {!content ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Clipboard className="w-10 h-10 opacity-20" />
          <p className="text-sm">{l10n.t('Click "Read Clipboard" or press ⌥⌘A')}</p>
          <p className="text-xs opacity-50">
            {l10n.t("Copy some text first, then process it with AI")}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Source content */}
          <div className="px-4 py-3 border-b border-border/30 max-h-[160px] overflow-y-auto">
            <p className="text-xs text-foreground/50 mb-1.5">{l10n.t("Clipboard Content")}</p>
            <p className="text-xs text-foreground/80 leading-relaxed select-text whitespace-pre-wrap font-mono">
              {content.length > 1000 ? content.slice(0, 1000) + "..." : content}
            </p>
          </div>

          {/* Action buttons */}
          <div className="px-4 py-3 border-b border-border/30">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
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
          <div className="flex-1 px-4 py-3 overflow-y-auto min-h-0">
            {isProcessing ? (
              <div className="flex items-center gap-2 py-6">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm text-foreground/50">{l10n.t("Processing...")}</span>
              </div>
            ) : result ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-foreground/50">{l10n.t("Result")}</p>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-accent/50 text-foreground/60 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        {l10n.t("Copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {l10n.t("Copy")}
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-foreground leading-relaxed select-text whitespace-pre-wrap">
                  {result}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-foreground/30">
                  {l10n.t("Select an action above to process")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
