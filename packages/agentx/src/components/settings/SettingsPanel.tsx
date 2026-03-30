import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setSettingsOpen, openSettingsSection, type SettingsSection } from "@/slices/uiSlice";
import {
  setLanguage,
  setProxyUrl,
  setWorkspacePath,
  setDataPath,
  setGlobalSystemPrompt,
  resetAllSettings,
  type AccentColor,
  type FontSize,
  type LayoutDensity,
} from "@/slices/settingsSlice";
import { clearAllConversations } from "@/slices/chatSlice";
import { checkForUpdates, openUpdateDialog, setUpdateStatus } from "@/slices/updateSlice";
import { l10n, SUPPORTED_LANGUAGE } from "@agentx/l10n";
import {
  XIcon,
  CpuIcon,
  SlidersHorizontalIcon,
  InfoIcon,
  BookOpenIcon,
  PlugIcon,
  ShieldCheckIcon,
  FolderOpenIcon,
  ScrollTextIcon,
  MicIcon,
  BrainIcon,
  RadioIcon,
  RotateCcwIcon,
  Trash2Icon,
  ActivityIcon,
} from "lucide-react";
import { ProviderConfig } from "./ProviderConfig";
import { KnowledgeBaseConfig } from "./KnowledgeBaseConfig";
import { MCPConfig } from "./MCPConfig";
import { ChannelsConfig } from "./ChannelsConfig";
import { PermissionsConfig } from "./PermissionsConfig";
import { VoiceConfig } from "./VoiceConfig";
import { MemoryConfig } from "./MemoryConfig";
import { SystemHealthConfig } from "./SystemHealthConfig";
import { cn } from "@/lib/utils";
import { glassPanelStyle } from "@/lib/glassStyle";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";

export function SettingsPanel() {
  const dispatch = useDispatch();
  const activeSection = useSelector((s: RootState) => s.ui.settingsSection);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch(setSettingsOpen(false));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);
  const setActiveSection = (section: SettingsSection) => dispatch(openSettingsSection(section));

  const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "general", label: l10n.t("General"), icon: SlidersHorizontalIcon },
    { id: "voice", label: l10n.t("Voice"), icon: MicIcon },
    { id: "systemPrompt", label: l10n.t("System Prompt"), icon: ScrollTextIcon },
    { id: "providers", label: l10n.t("AI Providers"), icon: CpuIcon },
    { id: "knowledgeBase", label: l10n.t("Knowledge Base"), icon: BookOpenIcon },
    { id: "mcp", label: l10n.t("MCP Servers"), icon: PlugIcon },
    { id: "channels", label: l10n.t("Channels"), icon: RadioIcon },
    { id: "memory", label: l10n.t("Memory"), icon: BrainIcon },
    { id: "permissions", label: l10n.t("Permissions"), icon: ShieldCheckIcon },
    { id: "systemHealth", label: l10n.t("System Health"), icon: ActivityIcon },
    { id: "about", label: l10n.t("About"), icon: InfoIcon },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)" }}
    >
      <div
        className="absolute inset-0 bg-black/15"
        onClick={() => dispatch(setSettingsOpen(false))}
      />
      <div
        data-glass
        className="relative border border-border/50 rounded-xl shadow-2xl w-full max-w-[760px] h-[560px] overflow-hidden flex"
        style={glassPanelStyle}
      >
        {/* Left: Navigation */}
        <div className="w-[168px] shrink-0 bg-white/[0.03] dark:bg-black/[0.03] border-r border-border/50 flex flex-col">
          <div className="px-3 pt-5 pb-3">
            <h2 className="text-[12px] font-semibold text-foreground">{l10n.t("Settings")}</h2>
          </div>
          <nav className="flex-1 px-1.5 space-y-0.5">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors",
                  activeSection === id
                    ? "bg-foreground/[0.12] text-foreground font-medium"
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="text-[13px] font-semibold text-foreground">
              {sections.find((s) => s.id === activeSection)?.label}
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => dispatch(setSettingsOpen(false))}
                  className="p-1 rounded-md hover:bg-foreground/[0.05] transition-colors text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{l10n.t("Close")}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 overflow-y-auto px-8 pb-8">
            {activeSection === "general" && <GeneralSection />}
            {activeSection === "voice" && <VoiceConfig />}
            {activeSection === "systemPrompt" && <SystemPromptSection />}
            {activeSection === "providers" && <ProviderConfig />}
            {activeSection === "knowledgeBase" && <KnowledgeBaseConfig />}
            {activeSection === "mcp" && <MCPConfig />}
            {activeSection === "channels" && <ChannelsConfig />}
            {activeSection === "memory" && (
              <div className="h-full flex flex-col overflow-hidden -mb-8">
                <MemoryConfig />
              </div>
            )}
            {activeSection === "permissions" && <PermissionsConfig />}
            {activeSection === "systemHealth" && <SystemHealthConfig />}
            {activeSection === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function getAccentOptions(): { id: AccentColor; label: string; color: string }[] {
  return [
    { id: "cyan", label: l10n.t("Cyan"), color: "#38bdf8" },
    { id: "blue", label: l10n.t("Blue"), color: "#3b82f6" },
    { id: "violet", label: l10n.t("Violet"), color: "#8b5cf6" },
    { id: "rose", label: l10n.t("Rose"), color: "#f43f5e" },
    { id: "orange", label: l10n.t("Orange"), color: "#f97316" },
    { id: "green", label: l10n.t("Green"), color: "#10b981" },
    { id: "teal", label: l10n.t("Teal"), color: "#14b8a6" },
  ];
}

function GeneralSection() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    theme,
    accentColor,
    fontSize,
    layoutDensity,
    setThemeMode,
    setAccent,
    setFontSizeMode,
    setDensity,
  } = useTheme();
  const currentLanguage = l10n.getLanguage();
  const proxyUrl = useSelector((s: RootState) => s.settings.proxyUrl);
  const [proxyDraft, setProxyDraft] = useState(proxyUrl);
  const workspacePath = useSelector((s: RootState) => s.settings.workspacePath);
  const dataPath = useSelector((s: RootState) => s.settings.dataPath);

  // Autostart
  const [autostart, setAutostart] = useState(false);
  useEffect(() => {
    import("@tauri-apps/plugin-autostart").then((mod) => {
      mod
        .isEnabled()
        .then(setAutostart)
        .catch(() => {});
    });
  }, []);
  const toggleAutostart = useCallback(async () => {
    const mod = await import("@tauri-apps/plugin-autostart");
    const next = !autostart;
    if (next) await mod.enable();
    else await mod.disable();
    setAutostart(next);
  }, [autostart]);

  // Notification preferences
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifScheduled, setNotifScheduled] = useState(true);
  const [notifAgent, setNotifAgent] = useState(true);

  useEffect(() => {
    window.api.preferences.get().then((p) => {
      const n = p.notifications as
        | { enabled?: boolean; scheduledTasks?: boolean; agentCompletion?: boolean }
        | undefined;
      if (n) {
        if (typeof n.enabled === "boolean") setNotifEnabled(n.enabled);
        if (typeof n.scheduledTasks === "boolean") setNotifScheduled(n.scheduledTasks);
        if (typeof n.agentCompletion === "boolean") setNotifAgent(n.agentCompletion);
      }
    });
  }, []);

  const persistNotifications = useCallback(
    (patch: { enabled?: boolean; scheduledTasks?: boolean; agentCompletion?: boolean }) => {
      const next = {
        enabled: patch.enabled ?? notifEnabled,
        scheduledTasks: patch.scheduledTasks ?? notifScheduled,
        agentCompletion: patch.agentCompletion ?? notifAgent,
      };
      window.api.preferences.set({ notifications: next });
    },
    [notifEnabled, notifScheduled, notifAgent],
  );

  const pickDirectory = async (setter: (path: string) => void) => {
    const dir = await window.api.fs.selectDirectory();
    if (dir) setter(dir);
  };

  const themeOptions: { value: "light" | "dark" | "system"; label: string }[] = [
    { value: "light", label: l10n.t("Light") },
    { value: "dark", label: l10n.t("Dark") },
    { value: "system", label: l10n.t("System") },
  ];

  const fontSizeOptions: { value: FontSize; label: string }[] = [
    { value: "small", label: l10n.t("Small") },
    { value: "default", label: l10n.t("Default") },
    { value: "large", label: l10n.t("Large") },
  ];

  const densityOptions: { value: LayoutDensity; label: string }[] = [
    { value: "compact", label: l10n.t("Compact") },
    { value: "comfortable", label: l10n.t("Comfortable") },
    { value: "spacious", label: l10n.t("Spacious") },
  ];

  const availableLanguages = l10n.getAvailableLanguages();
  const languageOptions = availableLanguages.map((code) => {
    const info = SUPPORTED_LANGUAGE.find((lang) => lang.code === code);
    return {
      value: code,
      label: info ? `${info.flag ?? ""} ${info.nativeName}` : code,
    };
  });

  const handleLanguageChange = (lang: string) => {
    dispatch(setLanguage(lang));
    l10n.setLanguage(lang);
  };

  const commitProxy = () => {
    const trimmed = proxyDraft.trim();
    if (trimmed !== proxyUrl) {
      dispatch(setProxyUrl(trimmed));
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Appearance")}
        </label>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Theme")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Choose your preferred color scheme")}
            </p>
          </div>
          <div className="flex items-center rounded-md border border-border/60 overflow-hidden">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThemeMode(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  theme === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {/* Accent color picker removed — monochrome theme */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Font Size")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Adjust interface text size")}
            </p>
          </div>
          <div className="flex items-center rounded-md border border-border/60 overflow-hidden">
            {fontSizeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFontSizeMode(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  fontSize === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Layout Density")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Control spacing between elements")}
            </p>
          </div>
          <div className="flex items-center rounded-md border border-border/60 overflow-hidden">
            {densityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDensity(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  layoutDensity === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Language")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Select display language")}
            </p>
          </div>
          <Select
            value={currentLanguage}
            onChange={handleLanguageChange}
            options={languageOptions}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Network")}
        </label>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Proxy")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Configure HTTP/HTTPS proxy for API requests")}
            </p>
          </div>
        </div>
        <input
          type="text"
          value={proxyDraft}
          onChange={(e) => setProxyDraft(e.target.value)}
          onBlur={commitProxy}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitProxy();
          }}
          placeholder="http://127.0.0.1:7890"
          className="w-full bg-background border border-border/60 rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Startup")}
        </label>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Launch at Login")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Automatically start AgentX when you log in")}
            </p>
          </div>
          <button
            onClick={toggleAutostart}
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              autostart ? "bg-primary" : "bg-foreground/[0.12]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
                autostart && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>

      <ShortcutsSection />

      <FinderIntegrationSection />

      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Notifications")}
        </label>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Enable Notifications")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Show system notifications when app is in background")}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !notifEnabled;
              setNotifEnabled(next);
              persistNotifications({ enabled: next });
            }}
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              notifEnabled ? "bg-primary" : "bg-foreground/[0.12]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
                notifEnabled && "translate-x-4",
              )}
            />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p
              className={cn("text-sm", notifEnabled ? "text-foreground" : "text-muted-foreground")}
            >
              {l10n.t("Scheduled Task Completion")}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Notify when scheduled tasks finish")}
            </p>
          </div>
          <button
            disabled={!notifEnabled}
            onClick={() => {
              const next = !notifScheduled;
              setNotifScheduled(next);
              persistNotifications({ scheduledTasks: next });
            }}
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              !notifEnabled && "opacity-50 cursor-not-allowed",
              notifScheduled && notifEnabled ? "bg-primary" : "bg-foreground/[0.12]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
                notifScheduled && notifEnabled && "translate-x-4",
              )}
            />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p
              className={cn("text-sm", notifEnabled ? "text-foreground" : "text-muted-foreground")}
            >
              {l10n.t("Agent Response Ready")}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Notify when agent finishes responding")}
            </p>
          </div>
          <button
            disabled={!notifEnabled}
            onClick={() => {
              const next = !notifAgent;
              setNotifAgent(next);
              persistNotifications({ agentCompletion: next });
            }}
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              !notifEnabled && "opacity-50 cursor-not-allowed",
              notifAgent && notifEnabled ? "bg-primary" : "bg-foreground/[0.12]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
                notifAgent && notifEnabled && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Directories")}
        </label>

        <div className="space-y-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Working Directory")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Default directory for agent command execution")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => workspacePath && window.api.fs.openPath(workspacePath)}
              className={cn(
                "flex-1 text-left bg-background border border-border/60 rounded-md px-3 py-1.5 text-[12px] font-medium truncate",
                workspacePath
                  ? "text-foreground hover:underline cursor-pointer"
                  : "text-muted-foreground/50 cursor-default",
              )}
            >
              {workspacePath || l10n.t("Default: User Home")}
            </button>
            <button
              onClick={() => pickDirectory((dir) => dispatch(setWorkspacePath(dir)))}
              className="shrink-0 p-1.5 rounded-md bg-foreground hover:bg-foreground/90 transition-colors text-background"
            >
              <FolderOpenIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Data Directory")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Directory for storing conversations and app data")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dataPath && window.api.fs.openPath(dataPath)}
              className={cn(
                "flex-1 text-left bg-background border border-border/60 rounded-md px-3 py-1.5 text-[12px] font-medium truncate",
                dataPath
                  ? "text-foreground hover:underline cursor-pointer"
                  : "text-muted-foreground/50 cursor-default",
              )}
            >
              {dataPath || l10n.t("Default: App Data")}
            </button>
            <button
              onClick={() => pickDirectory((dir) => dispatch(setDataPath(dir)))}
              className="shrink-0 p-1.5 rounded-md bg-foreground hover:bg-foreground/90 transition-colors text-background"
            >
              <FolderOpenIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          {l10n.t("Changes take effect after restarting the app")}
        </p>
      </div>

      <DangerZoneSection />
    </div>
  );
}

function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState<
    { id: string; shortcut: string; defaultShortcut: string; label: string }[]
  >([]);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const reload = useCallback(() => {
    window.api.shortcut
      .listAll()
      .then(setShortcuts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Key recorder — captures the next key combo when recording
  useEffect(() => {
    if (!recordingId) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore lone modifier presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Option");
      if (e.metaKey) parts.push("Cmd");
      if (e.shiftKey) parts.push("Shift");

      let key = e.key;
      if (key === " ") key = "Space";
      else if (key.length === 1) key = key.toUpperCase();
      else {
        const keyMap: Record<string, string> = {
          ArrowUp: "Up",
          ArrowDown: "Down",
          ArrowLeft: "Left",
          ArrowRight: "Right",
          Backspace: "Backspace",
          Delete: "Delete",
          Enter: "Enter",
          Tab: "Tab",
          Escape: "Escape",
        };
        key = keyMap[key] || key;
      }

      // Must have at least one modifier
      if (parts.length === 0) return;

      parts.push(key);
      const combo = parts.join("+");

      setPendingId(recordingId);
      setPendingKeys(combo);
      setRecordingId(null);
      setError(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingId]);

  const applyShortcut = useCallback(
    async (id: string, newKey: string) => {
      setError(null);
      setSuccessId(null);

      try {
        await window.api.shortcut.set(id, newKey);
        // Persist to preferences
        if (id === "command-palette") {
          await window.api.preferences.set({ commandPaletteShortcut: newKey });
        } else {
          // Load current shortcuts prefs, merge, and save
          const prefs = await window.api.preferences.get();
          const current = (prefs.shortcuts as Record<string, string>) || {};
          current[id] = newKey;
          await window.api.preferences.set({ shortcuts: current });
        }
        setPendingId(null);
        setPendingKeys("");
        setSuccessId(id);
        setTimeout(() => setSuccessId(null), 2000);
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [reload],
  );

  const resetShortcut = useCallback(
    async (id: string, defaultKey: string) => {
      setError(null);
      try {
        await window.api.shortcut.set(id, defaultKey);
        if (id === "command-palette") {
          await window.api.preferences.set({ commandPaletteShortcut: "" });
        } else {
          const prefs = await window.api.preferences.get();
          const current = (prefs.shortcuts as Record<string, string>) || {};
          delete current[id];
          await window.api.preferences.set({ shortcuts: current });
        }
        setPendingId(null);
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [reload],
  );

  return (
    <div className="space-y-3">
      <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
        {l10n.t("Keyboard Shortcuts")}
      </label>
      <p className="text-[12px] text-muted-foreground">
        {l10n.t("Click a shortcut to record a new key combination. All shortcuts are global.")}
      </p>

      <div className="space-y-1">
        {shortcuts.map((s) => {
          const isRecording = recordingId === s.id;
          const hasPending = pendingId === s.id && pendingKeys !== s.shortcut;
          const isCustom = s.shortcut !== s.defaultShortcut;
          const isSuccess = successId === s.id;

          return (
            <div
              key={s.id}
              className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-foreground/[0.02]"
            >
              <div className="min-w-0">
                <p className="text-[13px] text-foreground">{l10n.t(s.label)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isRecording ? (
                  <div className="px-3 py-1 rounded-md border-2 border-primary bg-primary/5 text-[12px] font-medium text-primary animate-pulse min-w-[130px] text-center">
                    {l10n.t("Press keys...")}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRecordingId(s.id);
                      setError(null);
                      setPendingId(null);
                    }}
                    className={cn(
                      "px-3 py-1 rounded-md border text-[12px] font-mono min-w-[130px] text-center transition-colors",
                      isSuccess
                        ? "border-green-500/60 bg-green-500/5 text-green-600"
                        : "border-border/60 bg-background text-foreground hover:bg-foreground/[0.04]",
                    )}
                  >
                    {hasPending ? pendingKeys : s.shortcut}
                  </button>
                )}
                {hasPending && !isRecording && (
                  <button
                    onClick={() => applyShortcut(s.id, pendingKeys)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors"
                  >
                    {l10n.t("Apply")}
                  </button>
                )}
                {isCustom && !hasPending && !isRecording && (
                  <button
                    onClick={() => resetShortcut(s.id, s.defaultShortcut)}
                    className="px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                    title={l10n.t("Reset to default: {key}", { key: s.defaultShortcut })}
                  >
                    {l10n.t("Reset")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-[11px] text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}

function FinderIntegrationSection() {
  const [installed, setInstalled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.finder
      .isInstalled()
      .then(setInstalled)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      if (installed) {
        await window.api.finder.uninstall();
        setInstalled(false);
      } else {
        await window.api.finder.install();
        setInstalled(true);
      }
    } catch (e) {
      console.error("[Finder] Toggle failed:", e);
    } finally {
      setLoading(false);
    }
  }, [installed]);

  return (
    <div className="space-y-3">
      <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
        {l10n.t("Finder Integration")}
      </label>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm text-foreground">{l10n.t("Finder Context Menu")}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {l10n.t("Right-click files in Finder to analyze, summarize, or rename with AgentX")}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={cn(
            "relative w-9 h-5 rounded-full transition-colors",
            loading && "opacity-50 cursor-not-allowed",
            installed ? "bg-primary" : "bg-foreground/[0.12]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
              installed && "translate-x-4",
            )}
          />
        </button>
      </div>
      {installed && (
        <p className="text-[11px] text-muted-foreground/60">
          {l10n.t(
            "Quick Actions installed. Right-click any file in Finder to see AgentX options under Quick Actions.",
          )}
        </p>
      )}
    </div>
  );
}

function DangerZoneSection() {
  const dispatch = useDispatch<AppDispatch>();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const handleResetSettings = () => {
    dispatch(resetAllSettings());
  };

  const handleClearConversations = () => {
    dispatch(clearAllConversations());
  };

  return (
    <>
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-destructive/80 uppercase tracking-wider">
          {l10n.t("Danger Zone")}
        </label>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Reset All Settings")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Restore all settings to their default values")}
            </p>
          </div>
          <button
            onClick={() => setResetConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors"
          >
            <RotateCcwIcon className="w-3.5 h-3.5" />
            {l10n.t("Reset")}
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Clear All Conversations")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Delete all conversations permanently")}
            </p>
          </div>
          <button
            onClick={() => setClearConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors"
          >
            <Trash2Icon className="w-3.5 h-3.5" />
            {l10n.t("Clear")}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title={l10n.t("Reset All Settings")}
        description={l10n.t(
          "All settings will be restored to their default values. This includes providers, MCP servers, knowledge base, skills, and scheduled tasks. This action cannot be undone.",
        )}
        confirmLabel={l10n.t("Reset")}
        variant="destructive"
        onConfirm={handleResetSettings}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={l10n.t("Clear All Conversations")}
        description={l10n.t(
          "All conversations will be permanently deleted. This action cannot be undone.",
        )}
        confirmLabel={l10n.t("Clear")}
        variant="destructive"
        onConfirm={handleClearConversations}
      />
    </>
  );
}

function SystemPromptSection() {
  const dispatch = useDispatch<AppDispatch>();
  const globalSystemPrompt = useSelector((s: RootState) => s.settings.globalSystemPrompt);

  const [globalDraft, setGlobalDraft] = useState(globalSystemPrompt);

  // Sync global draft when store changes (e.g. loaded from disk)
  useEffect(() => {
    setGlobalDraft(globalSystemPrompt);
  }, [globalSystemPrompt]);

  const commitGlobal = useCallback(() => {
    const trimmed = globalDraft.trim();
    if (trimmed !== globalSystemPrompt) {
      dispatch(setGlobalSystemPrompt(trimmed));
    }
  }, [globalDraft, globalSystemPrompt, dispatch]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Global System Prompt")}
        </label>
        <p className="text-[12px] text-muted-foreground">
          {l10n.t("Global system prompt used for all conversations")}
        </p>
        <textarea
          value={globalDraft}
          onChange={(e) => setGlobalDraft(e.target.value)}
          onBlur={commitGlobal}
          placeholder={l10n.t("Enter custom instructions for the AI...")}
          rows={6}
          className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring resize-y min-h-[120px] max-h-[300px]"
        />
      </div>
    </div>
  );
}

function AboutSection() {
  const dispatch = useDispatch<AppDispatch>();
  const updateState = useSelector((s: RootState) => s.update.state);

  const handleCheckForUpdates = () => {
    dispatch(setUpdateStatus({ state: "checking" }));
    dispatch(openUpdateDialog());
    dispatch(checkForUpdates());
  };

  const isCheckDisabled = ["checking", "downloading"].includes(updateState);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Application")}
        </label>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-foreground">{l10n.t("Version")}</span>
            <span className="text-[12px] text-muted-foreground">{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-foreground">{l10n.t("Runtime")}</span>
            <span className="text-[12px] text-muted-foreground">Tauri</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-foreground">{l10n.t("GitHub")}</span>
            <a
              href="https://github.com/axelulu/agentx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-foreground/70 hover:text-foreground hover:underline transition-colors"
            >
              github.com/axelulu/agentx
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Updates")}
        </label>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-foreground">{l10n.t("Check for Updates")}</span>
          <button
            onClick={handleCheckForUpdates}
            disabled={isCheckDisabled}
            className={cn(
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              isCheckDisabled
                ? "bg-foreground/30 text-background cursor-not-allowed"
                : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {l10n.t("Check for Updates")}
          </button>
        </div>
      </div>
    </div>
  );
}
