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
import { l10n, SUPPORTED_LANGUAGE } from "@workspace/l10n";
import { motion } from "framer-motion";
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
  ZapIcon,
  ClockIcon,
  BrainIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { ProviderConfig } from "./ProviderConfig";
import { KnowledgeBaseConfig } from "./KnowledgeBaseConfig";
import { MCPConfig } from "./MCPConfig";
import { PermissionsConfig } from "./PermissionsConfig";
import { VoiceConfig } from "./VoiceConfig";
import { SkillsConfig } from "./SkillsConfig";
import { ScheduledTasksConfig } from "./ScheduledTasksConfig";
import { MemoryConfig } from "./MemoryConfig";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function SettingsPanel() {
  const dispatch = useDispatch();
  const activeSection = useSelector((s: RootState) => s.ui.settingsSection);
  const setActiveSection = (section: SettingsSection) => dispatch(openSettingsSection(section));

  const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "general", label: l10n.t("General"), icon: SlidersHorizontalIcon },
    { id: "voice", label: l10n.t("Voice"), icon: MicIcon },
    { id: "systemPrompt", label: l10n.t("System Prompt"), icon: ScrollTextIcon },
    { id: "providers", label: l10n.t("AI Providers"), icon: CpuIcon },
    { id: "knowledgeBase", label: l10n.t("Knowledge Base"), icon: BookOpenIcon },
    { id: "mcp", label: l10n.t("MCP Servers"), icon: PlugIcon },
    { id: "skills", label: l10n.t("Skills"), icon: ZapIcon },
    { id: "scheduledTasks", label: l10n.t("Scheduled Tasks"), icon: ClockIcon },
    { id: "memory", label: l10n.t("Memory"), icon: BrainIcon },
    { id: "permissions", label: l10n.t("Permissions"), icon: ShieldCheckIcon },
    { id: "about", label: l10n.t("About"), icon: InfoIcon },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => dispatch(setSettingsOpen(false))}
      />
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-[720px] h-[520px] overflow-hidden flex"
      >
        {/* Left: Navigation */}
        <div className="w-[180px] shrink-0 bg-secondary/50 border-r border-border flex flex-col">
          <div className="px-4 pt-5 pb-3">
            <h2 className="text-[13px] font-semibold text-foreground">{l10n.t("Settings")}</h2>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
                  activeSection === id
                    ? "bg-foreground/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
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
                  className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{l10n.t("Close")}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {activeSection === "general" && <GeneralSection />}
            {activeSection === "voice" && <VoiceConfig />}
            {activeSection === "systemPrompt" && <SystemPromptSection />}
            {activeSection === "providers" && <ProviderConfig />}
            {activeSection === "knowledgeBase" && <KnowledgeBaseConfig />}
            {activeSection === "mcp" && <MCPConfig />}
            {activeSection === "skills" && <SkillsConfig />}
            {activeSection === "scheduledTasks" && <ScheduledTasksConfig />}
            {activeSection === "memory" && <MemoryConfig />}
            {activeSection === "permissions" && <PermissionsConfig />}
            {activeSection === "about" && <AboutSection />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function getAccentOptions(): { id: AccentColor; label: string; color: string }[] {
  return [
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
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThemeMode(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  theme === opt.value
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Accent Color")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Customize the primary accent color")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getAccentOptions().map((opt) => (
              <Tooltip key={opt.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setAccent(opt.id)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all shrink-0",
                      accentColor === opt.id
                        ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-card scale-110"
                        : "hover:scale-110",
                    )}
                    style={{ backgroundColor: opt.color }}
                  />
                </TooltipTrigger>
                <TooltipContent>{opt.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Font Size")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Adjust interface text size")}
            </p>
          </div>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {fontSizeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFontSizeMode(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  fontSize === opt.value
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
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
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {densityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDensity(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium transition-colors",
                  layoutDensity === opt.value
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
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
          <select
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-secondary border border-border rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            {languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
          className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

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
              notifEnabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
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
              notifScheduled && notifEnabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
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
              notifAgent && notifEnabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
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
                "flex-1 text-left bg-secondary border border-border rounded-md px-3 py-1.5 text-[12px] font-medium truncate",
                workspacePath
                  ? "text-foreground hover:underline cursor-pointer"
                  : "text-muted-foreground/50 cursor-default",
              )}
            >
              {workspacePath || l10n.t("Default: User Home")}
            </button>
            <button
              onClick={() => pickDirectory((dir) => dispatch(setWorkspacePath(dir)))}
              className="shrink-0 p-1.5 rounded-md border border-border hover:bg-foreground/5 transition-colors text-muted-foreground hover:text-foreground"
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
                "flex-1 text-left bg-secondary border border-border rounded-md px-3 py-1.5 text-[12px] font-medium truncate",
                dataPath
                  ? "text-foreground hover:underline cursor-pointer"
                  : "text-muted-foreground/50 cursor-default",
              )}
            >
              {dataPath || l10n.t("Default: App Data")}
            </button>
            <button
              onClick={() => pickDirectory((dir) => dispatch(setDataPath(dir)))}
              className="shrink-0 p-1.5 rounded-md border border-border hover:bg-foreground/5 transition-colors text-muted-foreground hover:text-foreground"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
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
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring resize-y min-h-[120px] max-h-[300px]"
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
            <span className="text-[12px] text-muted-foreground">Electron</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-foreground">{l10n.t("GitHub")}</span>
            <a
              href="https://github.com/axelulu/agentx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-blue-400 hover:text-blue-300 hover:underline transition-colors"
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
                ? "bg-foreground/5 text-muted-foreground cursor-not-allowed"
                : "bg-foreground/10 text-foreground hover:bg-foreground/15",
            )}
          >
            {l10n.t("Check for Updates")}
          </button>
        </div>
      </div>
    </div>
  );
}
