import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setSettingsOpen } from "@/slices/uiSlice";
import { setLanguage, setProxyUrl } from "@/slices/settingsSlice";
import { checkForUpdates, openUpdateDialog } from "@/slices/updateSlice";
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
} from "lucide-react";
import { ProviderConfig } from "./ProviderConfig";
import { KnowledgeBaseConfig } from "./KnowledgeBaseConfig";
import { MCPConfig } from "./MCPConfig";
import { PermissionsConfig } from "./PermissionsConfig";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

type SettingsSection = "general" | "providers" | "knowledgeBase" | "mcp" | "permissions" | "about";

export function SettingsPanel() {
  const dispatch = useDispatch();
  const [activeSection, setActiveSection] = useState<SettingsSection>("providers");

  const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "general", label: l10n.t("General"), icon: SlidersHorizontalIcon },
    { id: "providers", label: l10n.t("AI Providers"), icon: CpuIcon },
    { id: "knowledgeBase", label: l10n.t("Knowledge Base"), icon: BookOpenIcon },
    { id: "mcp", label: l10n.t("MCP Servers"), icon: PlugIcon },
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
            {activeSection === "providers" && <ProviderConfig />}
            {activeSection === "knowledgeBase" && <KnowledgeBaseConfig />}
            {activeSection === "mcp" && <MCPConfig />}
            {activeSection === "permissions" && <PermissionsConfig />}
            {activeSection === "about" && <AboutSection />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GeneralSection() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, setThemeMode } = useTheme();
  const currentLanguage = l10n.getLanguage();
  const proxyUrl = useSelector((s: RootState) => s.settings.proxyUrl);
  const [proxyDraft, setProxyDraft] = useState(proxyUrl);

  const themeOptions: { value: "light" | "dark" | "system"; label: string }[] = [
    { value: "light", label: l10n.t("Light") },
    { value: "dark", label: l10n.t("Dark") },
    { value: "system", label: l10n.t("System") },
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
    </div>
  );
}

function AboutSection() {
  const dispatch = useDispatch<AppDispatch>();
  const updateState = useSelector((s: RootState) => s.update.state);

  const handleCheckForUpdates = () => {
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
