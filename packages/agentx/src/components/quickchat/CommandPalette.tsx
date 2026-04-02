import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  MessageSquareIcon,
  SparklesIcon,
  FileTextIcon,
  CalculatorIcon,
  ClockIcon,
  StarIcon,
  SquareIcon,
  HashIcon,
  AppWindowIcon,
  SettingsIcon,
  ZapIcon,
  Globe2Icon,
  CopyIcon,
  CheckIcon,
  CornerDownLeftIcon,
  CommandIcon,
  ClipboardIcon,
  Languages,
  Code2,
  RefreshCw,
  ArrowRightLeft,
  Pin,
  Star,
  Trash2,
  Type,
  FileCode,
  Link,
  FileJson,
  Binary,
  LoaderIcon,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { l10n } from "@agentx/l10n";
import { useStandaloneTheme } from "@/hooks/useStandaloneTheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaletteMode = "home" | "search" | "chat" | "skills" | "results" | "clipboard" | "conv-search";

interface CommandItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  category: "recent" | "skill" | "action" | "conversation" | "system" | "file" | "app";
  action: () => void | Promise<void>;
  keywords?: string[];
}

interface InstalledApp {
  name: string;
  bundleId: string;
  path: string;
}

interface QuickMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Clipboard types & constants
// ---------------------------------------------------------------------------

interface ClipboardEntry {
  id: number;
  text: string;
  content_type: string;
  language: string | null;
  preview: string;
  app_source: string | null;
  timestamp: number;
  pinned: boolean;
  favorite: boolean;
}

type ClipboardActionId =
  | "translate"
  | "summarize"
  | "explain"
  | "rewrite"
  | "code-explain"
  | "format";
// ClipboardTab type removed — clipboard panel is now history-first with no tabs

function getClipActions(): {
  id: ClipboardActionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] {
  return [
    { id: "translate", label: l10n.t("Translate"), icon: Languages },
    { id: "summarize", label: l10n.t("Summarize"), icon: FileTextIcon },
    { id: "explain", label: l10n.t("Explain"), icon: SparklesIcon },
    { id: "rewrite", label: l10n.t("Rewrite"), icon: RefreshCw },
    { id: "code-explain", label: l10n.t("Code Explain"), icon: Code2 },
    { id: "format", label: l10n.t("Format Conversion"), icon: ArrowRightLeft },
  ];
}

function getClipTransforms() {
  return [
    { id: "json-format", label: l10n.t("JSON Format"), group: "JSON" },
    { id: "json-minify", label: l10n.t("JSON Minify"), group: "JSON" },
    { id: "base64-encode", label: l10n.t("Base64 Encode"), group: l10n.t("Encoding") },
    { id: "base64-decode", label: l10n.t("Base64 Decode"), group: l10n.t("Encoding") },
    { id: "url-encode", label: l10n.t("URL Encode"), group: l10n.t("Encoding") },
    { id: "url-decode", label: l10n.t("URL Decode"), group: l10n.t("Encoding") },
    { id: "uppercase", label: l10n.t("Uppercase"), group: l10n.t("Text") },
    { id: "lowercase", label: l10n.t("Lowercase"), group: l10n.t("Text") },
    { id: "trim", label: l10n.t("Trim Whitespace"), group: l10n.t("Text") },
    { id: "sort-lines", label: l10n.t("Sort Lines"), group: l10n.t("Line Operations") },
    { id: "unique-lines", label: l10n.t("Unique Lines"), group: l10n.t("Line Operations") },
    { id: "count-stats", label: l10n.t("Word Count"), group: l10n.t("Text") },
    { id: "markdown-to-text", label: l10n.t("MD to Text"), group: l10n.t("Conversion") },
  ];
}

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  text: Type,
  code: FileCode,
  url: Link,
  json: FileJson,
  base64: Binary,
  markdown: HashIcon,
};

// ---------------------------------------------------------------------------
// Conversation search types
// ---------------------------------------------------------------------------

interface ConvSearchResult {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  snippet?: string;
}

function convRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 7)
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days > 0) return `${days}${l10n.t("d ago")}`;
  if (hours > 0) return `${hours}${l10n.t("h ago")}`;
  if (minutes > 0) return `${minutes}${l10n.t("m ago")}`;
  return l10n.t("Just now");
}

function clipTimeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return l10n.t("Just now");
  if (diff < 3600) return `${Math.floor(diff / 60)}${l10n.t("m ago")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${l10n.t("h ago")}`;
  return `${Math.floor(diff / 86400)}${l10n.t("d ago")}`;
}

// ---------------------------------------------------------------------------
// Built-in system commands
// ---------------------------------------------------------------------------

function getSystemCommands(
  hideWindow: () => void,
  enterClipboard: () => void,
  enterConvSearch: () => void,
): CommandItem[] {
  return [
    {
      id: "sys:clipboard",
      icon: ClipboardIcon,
      title: l10n.t("Clipboard"),
      subtitle: l10n.t("AI actions, transforms, and history for clipboard content"),
      category: "action",
      keywords: ["clipboard", "clip", "paste", "copy", "剪贴板"],
      action: enterClipboard,
    },
    {
      id: "sys:new-chat",
      icon: MessageSquareIcon,
      title: l10n.t("New Conversation"),
      subtitle: l10n.t("Start a new chat in AgentX"),
      category: "action",
      keywords: ["new", "chat", "conversation", "create"],
      action: () => {
        hideWindow();
        invoke("window_show_and_emit", { event: "shortcut:new-conversation" });
      },
    },
    {
      id: "sys:open-app",
      icon: AppWindowIcon,
      title: l10n.t("Open AgentX"),
      subtitle: l10n.t("Show the main window"),
      category: "action",
      keywords: ["open", "app", "window", "main", "show"],
      action: () => {
        hideWindow();
        invoke("window_show_and_emit", { event: "shortcut:new-conversation" });
      },
    },
    {
      id: "sys:settings",
      icon: SettingsIcon,
      title: l10n.t("Settings"),
      subtitle: l10n.t("Open settings panel"),
      category: "action",
      keywords: ["settings", "preferences", "config", "options"],
      action: () => {
        hideWindow();
        invoke("window_show_and_emit", { event: "shortcut:settings" });
      },
    },
    {
      id: "sys:search-conv",
      icon: SearchIcon,
      title: l10n.t("Search Conversations"),
      subtitle: l10n.t("Find past conversations"),
      category: "action",
      keywords: ["search", "find", "history", "conversations", "搜索", "查找"],
      action: enterConvSearch,
    },
  ];
}

// ---------------------------------------------------------------------------
// Calculator helper
// ---------------------------------------------------------------------------

function tryCalculate(expr: string): string | null {
  // Strip leading = or "calc "
  let cleaned = expr.replace(/^(=|calc\s+)/i, "").trim();
  if (!cleaned) return null;
  // Only allow safe math chars
  if (!/^[\d\s+\-*/().,%^e]+$/i.test(cleaned)) return null;
  // Replace ^ with **
  cleaned = cleaned.replace(/\^/g, "**");
  // Replace % with /100
  cleaned = cleaned.replace(/(\d+)%/g, "($1/100)");
  try {
    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result === "number" && isFinite(result)) {
      return String(result);
    }
  } catch {
    // not a valid expression
  }
  return null;
}

// ---------------------------------------------------------------------------
// Unit conversion helper
// ---------------------------------------------------------------------------

const UNIT_REGEX =
  /^([\d.]+)\s*(km|mi|miles?|kg|lbs?|pounds?|°?[cfCF]|celsius|fahrenheit|cm|inch|inches|in|m|ft|feet|oz|g|grams?|l|liters?|gal|gallons?)\s+(?:to|in|=|→)\s+(\S+)$/i;

function tryUnitConvert(expr: string): string | null {
  const m = expr.match(UNIT_REGEX);
  if (!m) return null;
  const val = parseFloat(m[1]!);
  const from = m[2]!.toLowerCase().replace(/°/g, "");
  const to = m[3]!.toLowerCase().replace(/°/g, "");

  const conversions: Record<string, Record<string, (v: number) => number>> = {
    km: {
      mi: (v) => v * 0.621371,
      miles: (v) => v * 0.621371,
      mile: (v) => v * 0.621371,
      m: (v) => v * 1000,
    },
    mi: { km: (v) => v * 1.60934 },
    miles: { km: (v) => v * 1.60934 },
    mile: { km: (v) => v * 1.60934 },
    kg: {
      lbs: (v) => v * 2.20462,
      lb: (v) => v * 2.20462,
      pounds: (v) => v * 2.20462,
      g: (v) => v * 1000,
      grams: (v) => v * 1000,
    },
    lbs: { kg: (v) => v * 0.453592 },
    lb: { kg: (v) => v * 0.453592 },
    pounds: { kg: (v) => v * 0.453592 },
    pound: { kg: (v) => v * 0.453592 },
    c: { f: (v) => (v * 9) / 5 + 32, fahrenheit: (v) => (v * 9) / 5 + 32 },
    celsius: { f: (v) => (v * 9) / 5 + 32, fahrenheit: (v) => (v * 9) / 5 + 32 },
    f: { c: (v) => ((v - 32) * 5) / 9, celsius: (v) => ((v - 32) * 5) / 9 },
    fahrenheit: { c: (v) => ((v - 32) * 5) / 9, celsius: (v) => ((v - 32) * 5) / 9 },
    cm: {
      inch: (v) => v / 2.54,
      inches: (v) => v / 2.54,
      in: (v) => v / 2.54,
      m: (v) => v / 100,
      ft: (v) => v / 30.48,
      feet: (v) => v / 30.48,
    },
    inch: { cm: (v) => v * 2.54 },
    inches: { cm: (v) => v * 2.54 },
    in: { cm: (v) => v * 2.54 },
    m: {
      ft: (v) => v * 3.28084,
      feet: (v) => v * 3.28084,
      cm: (v) => v * 100,
      km: (v) => v / 1000,
    },
    ft: { m: (v) => v * 0.3048, cm: (v) => v * 30.48 },
    feet: { m: (v) => v * 0.3048 },
    l: { gal: (v) => v * 0.264172, gallons: (v) => v * 0.264172 },
    liters: { gal: (v) => v * 0.264172 },
    gal: { l: (v) => v * 3.78541, liters: (v) => v * 3.78541 },
    gallons: { l: (v) => v * 3.78541 },
  };

  const fn = conversions[from]?.[to];
  if (!fn) return null;
  const result = fn(val);
  return `${val} ${m[2]} = ${Number(result.toFixed(6))} ${m[3]}`;
}

// ---------------------------------------------------------------------------
// Persistent recent actions (localStorage)
// ---------------------------------------------------------------------------

const RECENT_KEY = "agentx:command-palette:recent";
const FAVORITES_KEY = "agentx:command-palette:favorites";
const MAX_RECENT = 8;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(ids: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

function pushRecent(id: string) {
  const list = loadRecent().filter((x) => x !== id);
  list.unshift(id);
  saveRecent(list);
}

function loadFavorites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<PaletteMode>("home");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [recentIds, setRecentIds] = useState<string[]>(loadRecent);

  // Chat state (inline AI)
  const [chatMessages, setChatMessages] = useState<QuickMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Data
  const [skills, setSkills] = useState<
    { id: string; title: string; description: string; category: string }[]
  >([]);
  const [conversations, setConversations] = useState<
    { id: string; title: string; updatedAt: number; messageCount: number }[]
  >([]);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);

  // Clipboard state
  const [clipContent, setClipContent] = useState("");
  const [clipContentType, setClipContentType] = useState("text");
  const [clipResult, setClipResult] = useState("");
  const [clipActiveAction, setClipActiveAction] = useState<ClipboardActionId | null>(null);
  const [clipProcessing, setClipProcessing] = useState(false);
  const [clipTransformResult, setClipTransformResult] = useState("");
  const [clipActiveTransform, setClipActiveTransform] = useState<string | null>(null);
  const [clipHistory, setClipHistory] = useState<ClipboardEntry[]>([]);
  const [clipSearch, setClipSearch] = useState("");
  const [clipCopied, setClipCopied] = useState(false);
  const [clipSelectedId, setClipSelectedId] = useState<number | null>(null);
  const clipSearchRef = useRef<HTMLInputElement>(null);

  // Conversation search state
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [convSearchResults, setConvSearchResults] = useState<ConvSearchResult[] | null>(null);
  const [convSearchLoading, setConvSearchLoading] = useState(false);
  const [convSearchIndex, setConvSearchIndex] = useState(0);
  const convSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);

  // Filtered clipboard history (used for keyboard navigation)
  const clipFilteredHistory = useMemo(() => {
    if (!clipSearch.trim()) return clipHistory;
    const q = clipSearch.toLowerCase();
    return clipHistory.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        e.content_type.includes(q) ||
        (e.language && e.language.includes(q)),
    );
  }, [clipHistory, clipSearch]);

  // ---------------------------------------------------------------------------
  // Init: theme sync, focus, load data
  // ---------------------------------------------------------------------------

  // Sync theme (dark mode, accent, font size, density) from main window via localStorage
  useStandaloneTheme();

  // Enter clipboard mode — loads history and shows all entries
  const enterClipboard = useCallback(async () => {
    setMode("clipboard");
    setInput("");
    setClipResult("");
    setClipActiveAction(null);
    setClipTransformResult("");
    setClipActiveTransform(null);
    setClipSearch("");
    setClipCopied(false);
    setClipSelectedId(null);
    setClipContent("");
    setClipContentType("text");
    try {
      const entries = await invoke<ClipboardEntry[]>("clipboard_history_list");
      setClipHistory(entries);
    } catch {
      /* ignore */
    }
    // Focus search input after render
    setTimeout(() => clipSearchRef.current?.focus(), 50);
  }, []);

  // Enter conversation search mode
  const enterConvSearch = useCallback(() => {
    setMode("conv-search");
    setInput("");
    setConvSearchQuery("");
    setConvSearchResults(null);
    setConvSearchLoading(false);
    setConvSearchIndex(0);
  }, []);

  // Focus on mount and on window show
  useEffect(() => {
    const focus = () => setTimeout(() => inputRef.current?.focus(), 50);
    focus();
    const win = getCurrentWebviewWindow();
    const unlisten = win.listen("quickchat:ready", () => {
      // Reset state when shown
      setInput("");
      setMode("home");
      setSelectedIndex(0);
      setChatMessages([]);
      setConversationId(null);
      setChatError(null);
      setRecentIds(loadRecent());
      setFavorites(loadFavorites());
      focus();
      // Refresh data (skills/conversations may have changed in main window)
      window.api.skills
        .listInstalled()
        .then((list) =>
          setSkills(
            (list as { id: string; title: string; description: string; category: string }[]) || [],
          ),
        )
        .catch(() => {});
      window.api.conversation
        .list()
        .then((list) =>
          setConversations(
            (list as { id: string; title: string; updatedAt: number; messageCount: number }[])
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 20),
          ),
        )
        .catch(() => {});
      invoke<InstalledApp[]>("apps_list_installed")
        .then((apps) => setInstalledApps(apps || []))
        .catch(() => {});
    });
    // Listen for mode switch events (e.g. clipboard shortcut, search shortcut)
    const unlistenMode = listen<string>("quickchat:mode", (event) => {
      if (event.payload === "clipboard") {
        enterClipboard();
      } else if (event.payload === "conv-search") {
        enterConvSearch();
      }
    });
    const handleFocus = () => focus();
    window.addEventListener("focus", handleFocus);
    return () => {
      unlisten.then((fn) => fn());
      unlistenMode.then((fn) => fn());
      window.removeEventListener("focus", handleFocus);
    };
  }, [enterClipboard, enterConvSearch]);

  // Real-time clipboard history updates
  useEffect(() => {
    if (mode !== "clipboard") return;
    const unlisten = listen<ClipboardEntry>("clipboard:new-entry", (event) => {
      setClipHistory((prev) => [event.payload, ...prev]);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [mode]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          mode === "clipboard" ||
          mode === "conv-search" ||
          (mode === "chat" && chatMessages.length > 0)
        ) {
          setMode("home");
          setInput("");
          if (mode === "chat") {
            setChatMessages([]);
            setConversationId(null);
          }
        } else {
          invoke("hide_quickchat_panel").catch(() => {
            getCurrentWebviewWindow().hide();
          });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, chatMessages.length]);

  // Load skills + conversations
  useEffect(() => {
    window.api.skills
      .listInstalled()
      .then((list) =>
        setSkills(
          (list as { id: string; title: string; description: string; category: string }[]) || [],
        ),
      )
      .catch(() => {});
    window.api.conversation
      .list()
      .then((list) =>
        setConversations(
          (list as { id: string; title: string; updatedAt: number; messageCount: number }[])
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 20),
        ),
      )
      .catch(() => {});
    invoke<InstalledApp[]>("apps_list_installed")
      .then((apps) => setInstalledApps(apps || []))
      .catch(() => {});
  }, []);

  // Cleanup
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const hideWindow = useCallback(() => {
    invoke("hide_quickchat_panel").catch(() => {
      // Fallback for non-macOS
      getCurrentWebviewWindow().hide();
    });
  }, []);

  const systemCommands = useMemo(
    () => getSystemCommands(hideWindow, enterClipboard, enterConvSearch),
    [hideWindow, enterClipboard, enterConvSearch],
  );

  // Build skill commands
  const skillCommands = useMemo<CommandItem[]>(
    () =>
      skills.map((s) => ({
        id: `skill:${s.id}`,
        icon: ZapIcon,
        title: s.title,
        subtitle: s.description,
        category: "skill" as const,
        keywords: [s.category, "skill"],
        action: async () => {
          pushRecent(`skill:${s.id}`);
          setRecentIds(loadRecent());
          hideWindow();
          invoke("window_show_and_emit", { event: `skill:new:${s.id}` });
        },
      })),
    [skills, hideWindow],
  );

  // Build conversation items
  const conversationItems = useMemo<CommandItem[]>(
    () =>
      conversations.map((c) => ({
        id: `conv:${c.id}`,
        icon: MessageSquareIcon,
        title: c.title || l10n.t("Untitled"),
        subtitle: `${c.messageCount} messages · ${new Date(c.updatedAt).toLocaleDateString()}`,
        category: "conversation" as const,
        keywords: [c.title?.toLowerCase() || ""],
        action: () => {
          pushRecent(`conv:${c.id}`);
          setRecentIds(loadRecent());
          hideWindow();
          invoke("window_show_and_emit", { event: "shortcut:new-conversation" });
          // Navigate to the conversation
          setTimeout(() => {
            emit("navigate:conversation", { conversationId: c.id });
          }, 300);
        },
      })),
    [conversations, hideWindow],
  );

  // App commands from installed macOS applications
  const appCommands = useMemo<CommandItem[]>(
    () =>
      installedApps.map((app) => ({
        id: `app:${app.bundleId}`,
        icon: AppWindowIcon,
        title: app.name,
        subtitle: app.path.replace(/^\/Applications\//, "").replace(/\.app$/, ""),
        category: "app" as const,
        keywords: [app.bundleId.toLowerCase(), app.name.toLowerCase()],
        action: () => {
          hideWindow();
          invoke("ni_open_app", { bundleId: app.bundleId });
        },
      })),
    [installedApps, hideWindow],
  );

  // All commands merged
  const allCommands = useMemo(
    () => [...systemCommands, ...skillCommands, ...conversationItems, ...appCommands],
    [systemCommands, skillCommands, conversationItems, appCommands],
  );

  // ---------------------------------------------------------------------------
  // Compute visible items based on input
  // ---------------------------------------------------------------------------

  const visibleItems = useMemo<CommandItem[]>(() => {
    const query = input.trim().toLowerCase();

    // "/" prefix → show skills + clipboard command
    if (query.startsWith("/")) {
      const skillQuery = query.slice(1);
      // /clip → enter clipboard mode
      if (skillQuery && "clipboard".startsWith(skillQuery)) {
        const clipCmd = systemCommands.find((c) => c.id === "sys:clipboard");
        if (clipCmd)
          return [
            clipCmd,
            ...skillCommands.filter(
              (c) =>
                c.title.toLowerCase().includes(skillQuery) ||
                c.keywords?.some((k) => k.includes(skillQuery)),
            ),
          ];
      }
      if (!skillQuery) {
        const clipCmd = systemCommands.find((c) => c.id === "sys:clipboard");
        return clipCmd ? [clipCmd, ...skillCommands] : skillCommands;
      }
      return skillCommands.filter(
        (c) =>
          c.title.toLowerCase().includes(skillQuery) ||
          c.subtitle?.toLowerCase().includes(skillQuery) ||
          c.keywords?.some((k) => k.includes(skillQuery)),
      );
    }

    // Empty → home view: favorites + recent + quick actions
    if (!query) {
      const items: CommandItem[] = [];

      // Favorites first
      const favItems = allCommands.filter((c) => favorites.has(c.id));
      if (favItems.length > 0) items.push(...favItems);

      // Recent
      const recentItems = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter(Boolean) as CommandItem[];
      const unseen = recentItems.filter((c) => !favorites.has(c.id));
      if (unseen.length > 0) items.push(...unseen.slice(0, 5));

      // System actions
      items.push(...systemCommands.filter((c) => !items.some((x) => x.id === c.id)));

      return items;
    }

    // Calculator
    const calcResult = tryCalculate(query);
    if (calcResult) {
      return [
        {
          id: "calc-result",
          icon: CalculatorIcon,
          title: calcResult,
          subtitle: query,
          category: "system" as const,
          action: () => {
            navigator.clipboard.writeText(calcResult);
          },
        },
        ...filterCommands(allCommands, query).slice(0, 5),
      ];
    }

    // Unit conversion
    const unitResult = tryUnitConvert(query);
    if (unitResult) {
      return [
        {
          id: "unit-result",
          icon: Globe2Icon,
          title: unitResult,
          subtitle: l10n.t("Press Enter to copy"),
          category: "system" as const,
          action: () => {
            navigator.clipboard.writeText(unitResult);
          },
        },
        ...filterCommands(allCommands, query).slice(0, 5),
      ];
    }

    // General search
    return filterCommands(allCommands, query);
  }, [input, allCommands, skillCommands, favorites, recentIds, systemCommands]);

  // Reset index on visible change
  useEffect(() => {
    setSelectedIndex(0);
  }, [visibleItems.length, input]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // ---------------------------------------------------------------------------
  // Chat mode (inline AI)
  // ---------------------------------------------------------------------------

  const handleAskAI = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setMode("chat");
      setChatError(null);

      const userMsg: QuickMessage = { id: uuidv4(), role: "user", content: text.trim() };
      setChatMessages((prev) => [...prev, userMsg]);
      setInput("");

      let convId = conversationId;
      if (!convId) {
        try {
          const conv = (await window.api.conversation.create("Quick Chat")) as { id: string };
          convId = conv.id;
          setConversationId(convId);
        } catch (e) {
          setChatError(e instanceof Error ? e.message : String(e));
          return;
        }
      }

      const assistantMsgId = uuidv4();
      setChatMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);
      setIsStreaming(true);
      streamingContentRef.current = "";

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
              setChatMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: newContent } : m)),
              );
            }
            break;
          case "message_end":
            if (e.content) {
              streamingContentRef.current = e.content;
              setChatMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: e.content! } : m)),
              );
            }
            break;
          case "agent_end":
            setIsStreaming(false);
            if (!streamingContentRef.current) {
              setChatMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
            }
            break;
          case "error":
            setIsStreaming(false);
            setChatError(e.error || e.message || "Unknown error");
            if (!streamingContentRef.current) {
              setChatMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
            }
            break;
        }
      });
      cleanupRef.current = cleanup;

      try {
        await window.api.agent.send(convId, text.trim());
        await window.api.agent.subscribe(convId);
      } catch (e) {
        setIsStreaming(false);
        setChatError(e instanceof Error ? e.message : String(e));
        setChatMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
      }
    },
    [isStreaming, conversationId],
  );

  const handleAbort = useCallback(() => {
    if (conversationId) window.api.agent.abort(conversationId);
  }, [conversationId]);

  // ---------------------------------------------------------------------------
  // Clipboard handlers
  // ---------------------------------------------------------------------------

  const clipRunAction = useCallback(
    async (actionId: ClipboardActionId) => {
      if (!clipContent.trim()) return;
      setClipActiveAction(actionId);
      setClipProcessing(true);
      setClipResult("");
      try {
        const res = await invoke<{ text: string; error?: string }>("clipboard_process", {
          text: clipContent,
          action: actionId,
        });
        setClipResult(res.error ? `Error: ${res.error}` : res.text);
      } catch (err) {
        setClipResult(`Error: ${err}`);
      } finally {
        setClipProcessing(false);
      }
    },
    [clipContent],
  );

  const clipRunTransform = useCallback(
    async (transformId: string) => {
      if (!clipContent.trim()) return;
      setClipActiveTransform(transformId);
      try {
        const res = await invoke<string>("clipboard_transform", {
          text: clipContent,
          transform: transformId,
        });
        setClipTransformResult(res);
      } catch (err) {
        setClipTransformResult(`Error: ${err}`);
      }
    },
    [clipContent],
  );

  const clipCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    invoke("clipboard_write", { text }).catch(() => {});
    setClipCopied(true);
    setTimeout(() => setClipCopied(false), 1500);
  }, []);

  const clipSelectHistory = useCallback((entry: ClipboardEntry) => {
    // Toggle selection — clicking same entry deselects
    setClipSelectedId((prev) => (prev === entry.id ? null : entry.id));
    setClipContent(entry.text);
    setClipContentType(entry.content_type);
    setClipResult("");
    setClipActiveAction(null);
    setClipTransformResult("");
    setClipActiveTransform(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Key handling
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (mode !== "chat") {
          setSelectedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (mode !== "chat") {
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Tab to cycle through modes
        if (input.trim() && mode !== "chat") {
          // Switch to AI chat mode
          handleAskAI(input);
        }
      } else if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        if (mode === "chat") {
          handleAskAI(input);
        } else if (visibleItems[selectedIndex]) {
          const item = visibleItems[selectedIndex]!;
          pushRecent(item.id);
          setRecentIds(loadRecent());
          item.action();
        } else if (input.trim()) {
          // No match → treat as AI question
          handleAskAI(input);
        }
      }
    },
    [mode, visibleItems, selectedIndex, input, handleAskAI],
  );

  // Toggle favorite
  const toggleFavorite = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setFavorites(next);
      saveFavorites(next);
    },
    [favorites],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isSlashMode = input.trim().startsWith("/");

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden text-foreground rounded-xl bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/8">
      {/* Search input — draggable via native panel drag */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 cursor-default"
        onMouseDown={(e) => {
          // Only drag when clicking the bar itself, not child inputs/buttons
          if ((e.target as HTMLElement).closest("input, button, textarea, [role=button]")) return;
          e.preventDefault();
          let lastX = e.screenX;
          let lastY = e.screenY;
          const onMove = (ev: MouseEvent) => {
            const dx = ev.screenX - lastX;
            const dy = ev.screenY - lastY;
            lastX = ev.screenX;
            lastY = ev.screenY;
            if (dx !== 0 || dy !== 0) {
              invoke("drag_quickchat_panel", { deltaX: dx, deltaY: dy });
            }
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      >
        <div className="flex items-center justify-center w-5 h-5 text-foreground/30">
          {mode === "conv-search" ? (
            <SearchIcon className="w-4 h-4 text-blue-400" />
          ) : mode === "clipboard" ? (
            <ClipboardIcon className="w-4 h-4 text-foreground/50" />
          ) : mode === "chat" ? (
            <SparklesIcon className="w-4 h-4 text-purple-400" />
          ) : isSlashMode ? (
            <span className="text-sm font-bold text-orange-400">/</span>
          ) : (
            <SearchIcon className="w-4 h-4" />
          )}
        </div>
        {mode === "conv-search" ? (
          <>
            {convSearchLoading && (
              <LoaderIcon className="w-3.5 h-3.5 text-foreground/30 animate-spin shrink-0 absolute left-4" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={convSearchQuery}
              onChange={(e) => setConvSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                const items = convSearchResults ?? conversations;
                if (e.key === "Backspace" && !convSearchQuery) {
                  e.preventDefault();
                  setMode("home");
                  setInput("");
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setConvSearchIndex((i) => Math.min(i + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setConvSearchIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const sel = items[convSearchIndex];
                  if (sel) {
                    hideWindow();
                    invoke("window_show_and_emit", { event: `navigate:${sel.id}` });
                  }
                }
              }}
              placeholder={l10n.t("Search conversations...")}
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-foreground/25"
              autoFocus
            />
          </>
        ) : mode === "clipboard" ? (
          <>
            <input
              ref={clipSearchRef}
              type="text"
              value={clipSearch}
              onChange={(e) => setClipSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !clipSearch) {
                  e.preventDefault();
                  setMode("home");
                  setInput("");
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const list = clipFilteredHistory;
                  if (list.length === 0) return;
                  const curIdx = clipSelectedId
                    ? list.findIndex((x) => x.id === clipSelectedId)
                    : -1;
                  const nextIdx = Math.min(curIdx + 1, list.length - 1);
                  const entry = list[nextIdx]!;
                  setClipSelectedId(entry.id);
                  setClipContent(entry.text);
                  setClipContentType(entry.content_type);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const list = clipFilteredHistory;
                  if (list.length === 0) return;
                  const curIdx = clipSelectedId
                    ? list.findIndex((x) => x.id === clipSelectedId)
                    : list.length;
                  const nextIdx = Math.max(curIdx - 1, 0);
                  const entry = list[nextIdx]!;
                  setClipSelectedId(entry.id);
                  setClipContent(entry.text);
                  setClipContentType(entry.content_type);
                } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  const entry = clipSelectedId
                    ? clipFilteredHistory.find((x) => x.id === clipSelectedId)
                    : clipFilteredHistory[0];
                  if (entry) {
                    hideWindow();
                    invoke("clipboard_paste_entry", { text: entry.text });
                  }
                }
              }}
              placeholder={l10n.t("Search clipboard history...")}
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-foreground/25"
              autoFocus
            />
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-foreground/30 shrink-0">
              {clipHistory.length}
            </span>
          </>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (mode === "chat" && !e.target.value.trim()) {
                // Stay in chat mode
              } else if (mode !== "chat") {
                setMode(e.target.value.trim().startsWith("/") ? "skills" : "search");
                if (!e.target.value.trim()) setMode("home");
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "chat"
                ? l10n.t("Continue asking...")
                : l10n.t("Search commands, ask AI, or type / for skills...")
            }
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-foreground/25"
            autoFocus
          />
        )}
        {mode === "chat" && isStreaming && (
          <button
            onClick={handleAbort}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all shrink-0"
          >
            <SquareIcon className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {mode === "conv-search" ? (
          // Conversation search mode
          <ConvSearchView
            conversations={conversations}
            query={convSearchQuery}
            results={convSearchResults}
            setResults={setConvSearchResults}
            setLoading={setConvSearchLoading}
            selectedIndex={convSearchIndex}
            setSelectedIndex={setConvSearchIndex}
            debounceRef={convSearchDebounceRef}
            onSelect={(convId: string) => {
              hideWindow();
              invoke("window_show_and_emit", { event: `navigate:${convId}` });
            }}
          />
        ) : mode === "clipboard" ? (
          // Clipboard mode — history-first layout
          <ClipboardView
            history={clipHistory}
            search={clipSearch}
            selectedId={clipSelectedId}
            selectedContent={clipContent}
            result={clipResult}
            activeAction={clipActiveAction}
            processing={clipProcessing}
            transformResult={clipTransformResult}
            activeTransform={clipActiveTransform}
            copied={clipCopied}
            onSelect={clipSelectHistory}
            onPaste={(entry) => {
              hideWindow();
              invoke("clipboard_paste_entry", { text: entry.text });
            }}
            onCopy={clipCopy}
            onRunAction={clipRunAction}
            onRunTransform={clipRunTransform}
            onDelete={async (id) => {
              await invoke("clipboard_history_delete", { id });
              setClipHistory((prev) => prev.filter((e) => e.id !== id));
              if (clipSelectedId === id) setClipSelectedId(null);
            }}
            onTogglePin={async (id) => {
              const pinned = await invoke<boolean | null>("clipboard_history_toggle_pin", { id });
              if (pinned !== null)
                setClipHistory((prev) =>
                  prev.map((e) => (e.id === id ? { ...e, pinned: pinned! } : e)),
                );
            }}
            onToggleFavorite={async (id) => {
              const fav = await invoke<boolean | null>("clipboard_history_toggle_favorite", { id });
              if (fav !== null)
                setClipHistory((prev) =>
                  prev.map((e) => (e.id === id ? { ...e, favorite: fav! } : e)),
                );
            }}
          />
        ) : mode === "chat" ? (
          // Chat mode
          <div className="px-4 py-3 space-y-3">
            {chatMessages.map((msg) => (
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
                {msg.content && msg.role === "assistant" && (
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
                )}
              </div>
            ))}
            {chatError && (
              <div className="px-2.5 py-1.5 text-[11px] text-destructive bg-destructive/10 rounded-md">
                {chatError}
              </div>
            )}
          </div>
        ) : (
          // Command list mode
          <div ref={listRef} className="py-1">
            {visibleItems.length === 0 && input.trim() && (
              <div className="px-4 py-8 text-center">
                <SparklesIcon className="w-5 h-5 mx-auto mb-2 text-foreground/15" />
                <p className="text-xs text-foreground/30">
                  {l10n.t("No commands found. Press Enter to ask AI.")}
                </p>
              </div>
            )}

            {visibleItems.length === 0 && !input.trim() && (
              <div className="px-4 py-8 text-center">
                <CommandIcon className="w-5 h-5 mx-auto mb-2 text-foreground/15" />
                <p className="text-xs text-foreground/30">
                  {l10n.t("Type to search or ask anything")}
                </p>
              </div>
            )}

            {visibleItems.map((item, i) => {
              const Icon = item.icon;
              const isFav = favorites.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors",
                    i === selectedIndex
                      ? "bg-accent/60 text-foreground"
                      : "text-foreground/70 hover:bg-accent/30",
                  )}
                  onClick={() => {
                    pushRecent(item.id);
                    setRecentIds(loadRecent());
                    item.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                      item.category === "app"
                        ? ""
                        : item.category === "skill"
                          ? "bg-orange-500/10 text-orange-500"
                          : item.category === "conversation"
                            ? "bg-blue-500/10 text-blue-500"
                            : item.category === "system"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-foreground/[0.06] text-foreground/50",
                    )}
                  >
                    {item.category === "app" ? (
                      <AppIcon bundleId={item.id.replace("app:", "")} fallback={Icon} />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-[11px] text-foreground/35 truncate">{item.subtitle}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Favorite star */}
                    <button
                      onClick={(e) => toggleFavorite(item.id, e)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isFav
                          ? "text-yellow-500 hover:text-yellow-400"
                          : "text-transparent hover:text-foreground/20",
                      )}
                    >
                      <StarIcon className="w-3 h-3" fill={isFav ? "currentColor" : "none"} />
                    </button>
                    {/* Category badge */}
                    <span className="text-[10px] text-foreground/20 capitalize">
                      {item.category === "recent" && <ClockIcon className="w-3 h-3 inline" />}
                    </span>
                    {i === selectedIndex && (
                      <CornerDownLeftIcon className="w-3 h-3 text-foreground/25" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — also draggable */}
      <div
        className="border-t border-border px-3 py-1.5 flex items-center gap-3 shrink-0 text-[10px] text-foreground/25 cursor-default"
        onMouseDown={(e) => {
          e.preventDefault();
          let lastX = e.screenX;
          let lastY = e.screenY;
          const onMove = (ev: MouseEvent) => {
            const dx = ev.screenX - lastX;
            const dy = ev.screenY - lastY;
            lastX = ev.screenX;
            lastY = ev.screenY;
            if (dx !== 0 || dy !== 0) {
              invoke("drag_quickchat_panel", { deltaX: dx, deltaY: dy });
            }
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      >
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[9px]">↑↓</kbd>
          {l10n.t("navigate")}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[9px]">↵</kbd>
          {l10n.t("select")}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[9px]">Tab</kbd>
          {l10n.t("ask AI")}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[9px]">/</kbd>
          {l10n.t("skills")}
        </span>
        <div className="flex-1" />
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[9px]">Esc</kbd>
          {l10n.t("close")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App icon lazy loader
// ---------------------------------------------------------------------------

const appIconCache = new Map<string, string | null>();

function AppIcon({
  bundleId,
  fallback: Fallback,
}: {
  bundleId: string;
  fallback: React.ComponentType<{ className?: string }>;
}) {
  const [src, setSrc] = useState<string | null>(appIconCache.get(bundleId) ?? null);
  const [loaded, setLoaded] = useState(appIconCache.has(bundleId));

  useEffect(() => {
    if (appIconCache.has(bundleId)) {
      setSrc(appIconCache.get(bundleId) ?? null);
      setLoaded(true);
      return;
    }
    invoke<string | null>("apps_get_icon", { bundleId })
      .then((data) => {
        appIconCache.set(bundleId, data);
        setSrc(data);
        setLoaded(true);
      })
      .catch(() => {
        appIconCache.set(bundleId, null);
        setLoaded(true);
      });
  }, [bundleId]);

  if (!loaded || !src) {
    return <Fallback className="w-4 h-4" />;
  }
  return <img src={src} className="w-5 h-5 rounded" alt="" draggable={false} />;
}

// ---------------------------------------------------------------------------
// Filter helper
// ---------------------------------------------------------------------------

function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  const q = query.toLowerCase();
  const scored = commands
    .map((c) => {
      let score = 0;
      const title = c.title.toLowerCase();
      const subtitle = c.subtitle?.toLowerCase() || "";
      if (title === q) score += 100;
      else if (title.startsWith(q)) score += 50;
      else if (title.includes(q)) score += 30;
      if (subtitle.includes(q)) score += 15;
      if (c.keywords?.some((k) => k.includes(q))) score += 20;
      return { item: c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.item);
}

// ---------------------------------------------------------------------------
// Clipboard View — history-first layout (no tabs)
// ---------------------------------------------------------------------------

function ClipboardView({
  history,
  search,
  selectedId,
  selectedContent,
  result,
  activeAction,
  processing,
  transformResult,
  activeTransform,
  copied,
  onSelect,
  onPaste,
  onCopy,
  onRunAction,
  onRunTransform,
  onDelete,
  onTogglePin,
  onToggleFavorite,
}: {
  history: ClipboardEntry[];
  search: string;
  selectedId: number | null;
  selectedContent: string;
  result: string;
  activeAction: ClipboardActionId | null;
  processing: boolean;
  transformResult: string;
  activeTransform: string | null;
  copied: boolean;
  onSelect: (entry: ClipboardEntry) => void;
  onPaste: (entry: ClipboardEntry) => void;
  onCopy: (text: string) => void;
  onRunAction: (id: ClipboardActionId) => void;
  onRunTransform: (id: string) => void;
  onDelete: (id: number) => void;
  onTogglePin: (id: number) => void;
  onToggleFavorite: (id: number) => void;
}) {
  const [showTransforms, setShowTransforms] = useState(false);

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        e.content_type.includes(q) ||
        (e.language && e.language.includes(q)),
    );
  }, [history, search]);

  const selectedEntry = selectedId ? history.find((e) => e.id === selectedId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* History list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-foreground/15">
            <ClipboardIcon className="w-6 h-6" />
            <span className="text-xs">
              {search.trim() ? l10n.t("No matching entries") : l10n.t("No clipboard history")}
            </span>
            <span className="text-[10px] text-foreground/10">
              {l10n.t("Copy something to get started")}
            </span>
          </div>
        ) : (
          filteredHistory.map((entry) => {
            const EntryIcon = TYPE_ICONS[entry.content_type] || Type;
            const isSelected = selectedId === entry.id;
            return (
              <div key={entry.id}>
                <div
                  className={cn(
                    "group flex items-start gap-2 px-4 py-2 cursor-pointer transition-colors border-b border-border",
                    isSelected ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]",
                  )}
                  title={l10n.t("Double-click to paste")}
                  onClick={(e) => {
                    if (e.detail >= 2) {
                      onPaste(entry);
                    } else {
                      onSelect(entry);
                    }
                  }}
                >
                  <span className="mt-0.5 shrink-0 text-foreground/20">
                    <EntryIcon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-[13px] leading-relaxed truncate",
                        isSelected ? "text-foreground/80" : "text-foreground/60",
                      )}
                    >
                      {entry.preview}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-foreground/25">
                        {clipTimeAgo(entry.timestamp)}
                      </span>
                      {entry.app_source && (
                        <span className="text-[10px] text-foreground/20">{entry.app_source}</span>
                      )}
                      {entry.language && (
                        <span className="text-[10px] px-1 rounded bg-foreground/[0.06] text-foreground/30">
                          {entry.language}
                        </span>
                      )}
                      {entry.pinned && <Pin className="w-2.5 h-2.5 text-foreground/30" />}
                      {entry.favorite && (
                        <Star className="w-2.5 h-2.5 text-foreground/30 fill-foreground/30" />
                      )}
                    </div>
                  </div>
                  <div
                    className="hidden group-hover:flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onCopy(entry.text)}
                      className="p-1 rounded text-foreground/20 hover:text-foreground/50 transition-colors"
                      title={l10n.t("Copy")}
                    >
                      <CopyIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onTogglePin(entry.id)}
                      className={`p-1 rounded transition-colors ${entry.pinned ? "text-foreground/50" : "text-foreground/20 hover:text-foreground/50"}`}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onToggleFavorite(entry.id)}
                      className={`p-1 rounded transition-colors ${entry.favorite ? "text-foreground/50" : "text-foreground/20 hover:text-foreground/50"}`}
                    >
                      <Star
                        className="w-3 h-3"
                        style={entry.favorite ? { fill: "currentColor" } : undefined}
                      />
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-1 rounded text-foreground/20 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail for selected entry */}
                {isSelected && (
                  <div className="border-b border-border bg-foreground/[0.03]">
                    {/* Full content preview */}
                    <div className="px-4 py-2 max-h-[120px] overflow-y-auto">
                      <pre className="text-[13px] text-foreground/50 leading-relaxed select-text whitespace-pre-wrap font-mono break-all">
                        {selectedContent.length > 2000
                          ? selectedContent.slice(0, 2000) + "..."
                          : selectedContent}
                      </pre>
                    </div>

                    {/* Action bar */}
                    <div className="px-4 py-1.5 flex items-center gap-1 flex-wrap border-t border-border/50">
                      {/* AI actions */}
                      {getClipActions().map((action) => {
                        const Icon = action.icon;
                        const isActive = activeAction === action.id;
                        return (
                          <button
                            key={action.id}
                            onClick={() => onRunAction(action.id)}
                            disabled={processing && !isActive}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors",
                              isActive
                                ? "bg-foreground text-background"
                                : "text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.06]",
                              processing && !isActive
                                ? "opacity-30 cursor-not-allowed"
                                : "cursor-pointer",
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {action.label}
                          </button>
                        );
                      })}
                      {/* Transform toggle */}
                      <button
                        onClick={() => setShowTransforms(!showTransforms)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors",
                          showTransforms
                            ? "bg-foreground/[0.08] text-foreground/60"
                            : "text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.06]",
                        )}
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        {l10n.t("Transform")}
                      </button>
                    </div>

                    {/* Transform options (collapsible) */}
                    {showTransforms && (
                      <div className="px-4 py-1.5 border-t border-border/50">
                        <div className="flex flex-wrap gap-1">
                          {getClipTransforms().map((t) => {
                            const isActive = activeTransform === t.id;
                            return (
                              <button
                                key={t.id}
                                onClick={() => onRunTransform(t.id)}
                                className={cn(
                                  "px-1.5 py-0.5 text-[9px] rounded transition-colors",
                                  isActive
                                    ? "bg-foreground text-background"
                                    : "bg-foreground/[0.04] text-foreground/35 hover:text-foreground/55 hover:bg-foreground/[0.08]",
                                )}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* AI result */}
                    {processing && (
                      <div className="px-4 py-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex gap-1 items-center h-4">
                            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-foreground/30" />
                            <span
                              className="typing-dot w-1.5 h-1.5 rounded-full bg-foreground/30"
                              style={{ animationDelay: "0.15s" }}
                            />
                            <span
                              className="typing-dot w-1.5 h-1.5 rounded-full bg-foreground/30"
                              style={{ animationDelay: "0.3s" }}
                            />
                          </span>
                          <span className="text-[10px] text-foreground/25">
                            {l10n.t("Processing...")}
                          </span>
                        </div>
                      </div>
                    )}
                    {!processing && result && (
                      <div className="px-4 py-2 border-t border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] text-foreground/25">{l10n.t("Result")}</p>
                          <button
                            onClick={() => onCopy(result)}
                            className="p-0.5 rounded text-foreground/20 hover:text-foreground/50 transition-colors"
                          >
                            {copied ? (
                              <CheckIcon className="w-3 h-3 text-green-500" />
                            ) : (
                              <CopyIcon className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-foreground/70 leading-relaxed select-text whitespace-pre-wrap">
                          {result}
                        </p>
                      </div>
                    )}
                    {!processing && transformResult && (
                      <div className="px-4 py-2 border-t border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] text-foreground/25">
                            {l10n.t("Transform Result")}
                          </p>
                          <button
                            onClick={() => onCopy(transformResult)}
                            className="p-0.5 rounded text-foreground/20 hover:text-foreground/50 transition-colors"
                          >
                            {copied ? (
                              <CheckIcon className="w-3 h-3 text-green-500" />
                            ) : (
                              <CopyIcon className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <pre className="text-[11px] text-foreground/60 leading-relaxed select-text whitespace-pre-wrap font-mono">
                          {transformResult}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      {filteredHistory.length > 0 && (
        <div className="px-4 py-1.5 text-[9px] text-foreground/20 text-center border-t border-border shrink-0">
          {l10n.t("Click to expand")} · {l10n.t("Double-click to paste")}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation Search View
// ---------------------------------------------------------------------------

function ConvSearchView({
  conversations,
  query,
  results,
  setResults,
  setLoading,
  selectedIndex,
  setSelectedIndex,
  debounceRef,
  onSelect,
}: {
  conversations: { id: string; title: string; updatedAt: number; messageCount: number }[];
  query: string;
  results: ConvSearchResult[] | null;
  setResults: (r: ConvSearchResult[] | null) => void;
  setLoading: (l: boolean) => void;
  selectedIndex: number;
  setSelectedIndex: (i: number | ((prev: number) => number)) => void;
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  onSelect: (conversationId: string) => void;
}) {
  // Debounced backend search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await window.api.conversation.search(q);
        setResults(res as ConvSearchResult[]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, debounceRef, setResults, setLoading]);

  // When no query, show recent conversations; otherwise show search results
  const displayItems: ConvSearchResult[] = useMemo(() => {
    if (!query.trim()) return conversations as ConvSearchResult[];
    return results ?? [];
  }, [query, conversations, results]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [displayItems, setSelectedIndex]);

  // Scroll selected into view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div ref={listRef} className="h-full overflow-y-auto">
      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <MessageSquareIcon className="w-5 h-5 mb-2 text-foreground/15" />
          <p className="text-xs text-foreground/30">
            {query.trim() ? l10n.t("No matching conversations") : l10n.t("No conversations yet")}
          </p>
        </div>
      ) : (
        displayItems.map((conv, idx) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
              idx === selectedIndex ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
            }`}
          >
            <MessageSquareIcon className="w-4 h-4 text-foreground/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-foreground truncate">
                {conv.title || l10n.t("Untitled")}
              </div>
              {conv.snippet ? (
                <div className="text-[11px] text-foreground/35 truncate mt-0.5">
                  <ConvHighlightSnippet snippet={conv.snippet} query={query} />
                </div>
              ) : (
                <div className="text-[11px] text-foreground/35">
                  {convRelativeTime(conv.updatedAt)} · {conv.messageCount}{" "}
                  {conv.messageCount === 1 ? l10n.t("msg") : l10n.t("msgs")}
                </div>
              )}
            </div>
            {idx === selectedIndex && (
              <CornerDownLeftIcon className="w-3 h-3 text-foreground/25 shrink-0" />
            )}
          </button>
        ))
      )}
    </div>
  );
}

function ConvHighlightSnippet({ snippet, query }: { snippet: string; query: string }) {
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
