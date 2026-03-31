import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Languages, Copy, Check, X, ChevronDown, Loader2 } from "lucide-react";
import { useStandaloneTheme } from "@/hooks/useStandaloneTheme";

const TARGET_LANGUAGES = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
];

export function TranslatorPanel() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState("zh");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Sync theme (dark mode, accent, font size, density) from main window via localStorage
  useStandaloneTheme();

  // Auto-detect target language based on source text
  const detectTargetLang = useCallback((text: string) => {
    // If source is primarily Chinese, translate to English
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
    const chineseChars = (text.match(chineseRegex) || []).length;
    if (chineseChars > text.length * 0.3) {
      setTargetLang("en");
    } else {
      setTargetLang("zh");
    }
  }, []);

  // Listen for text from the Rust backend
  useEffect(() => {
    const unlisten = listen<string>("translator:set-text", (event) => {
      const text = event.payload;
      setSourceText(text);
      setTranslatedText("");
      detectTargetLang(text);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [detectTargetLang]);

  // Auto-translate when source text or target language changes
  useEffect(() => {
    if (!sourceText.trim()) return;

    const timer = setTimeout(() => {
      doTranslate(sourceText, targetLang);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceText, targetLang]);

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

  // Click outside lang menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function doTranslate(text: string, lang: string) {
    // Abort previous translation
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setIsTranslating(true);
    setTranslatedText("");

    try {
      const result = await invoke<{ text: string; error?: string }>("translate_run", {
        text,
        targetLang: lang,
      });

      if (abortRef.current?.signal.aborted) return;

      if (result.error) {
        setTranslatedText(`Error: ${result.error}`);
      } else {
        setTranslatedText(result.text);
      }
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      setTranslatedText(`Error: ${err}`);
    } finally {
      setIsTranslating(false);
    }
  }

  function handleCopy() {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleClose() {
    getCurrentWebviewWindow().hide();
  }

  const langLabel = TARGET_LANGUAGES.find((l) => l.code === targetLang)?.label || targetLang;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-foreground rounded-xl bg-white/25 dark:bg-black/30 border border-black/5 dark:border-white/8">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground/80">Translate</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Language selector */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-accent/50 text-foreground/70 transition-colors"
            >
              {langLabel}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showLangMenu && (
              <div
                className="absolute right-0 top-full mt-1 z-50 border border-border rounded-lg shadow-lg py-1 min-w-[120px] animate-fade-in"
                style={{ background: "var(--background)" }}
              >
                {TARGET_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setTargetLang(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors ${
                      targetLang === lang.code ? "text-primary font-medium" : "text-foreground/70"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-accent/50 text-foreground/50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Source text */}
      <div className="px-3 py-2 border-b border-border max-h-[120px] overflow-y-auto">
        <p className="text-xs text-foreground/60 mb-1">Source</p>
        <p className="text-sm text-foreground leading-relaxed select-text">{sourceText}</p>
      </div>

      {/* Translation result */}
      <div className="flex-1 px-3 py-2 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-foreground/60">Translation</p>
          {translatedText && !isTranslating && (
            <button
              onClick={handleCopy}
              className="p-1 rounded-md hover:bg-accent/50 text-foreground/50 transition-colors"
              title="Copy translation"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
        {isTranslating ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-xs text-foreground/50">Translating...</span>
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed select-text whitespace-pre-wrap">
            {translatedText}
          </p>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border flex items-center justify-between">
        <span className="text-[10px] text-foreground/30">⌥D to translate selection</span>
        <span className="text-[10px] text-foreground/30">Esc to close</span>
      </div>
    </div>
  );
}
