import { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadNIConfig,
  saveNIConfig,
  fetchNotifications,
  classifyNotifications,
  startNI,
  stopNI,
  markNotificationsRead,
  replaceNotifications,
} from "@/slices/notificationSlice";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import {
  BellIcon,
  BellOffIcon,
  SparklesIcon,
  CheckCheckIcon,
  RefreshCwIcon,
  FilterIcon,
  AlertTriangleIcon,
  StarIcon,
  InboxIcon,
  BanIcon,
  SettingsIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  SquareIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { InputBox } from "@/components/ui/InputBox";
import { Select } from "@/components/ui/Select";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return l10n.t("just now");
  if (diff < 3600_000) return l10n.t("${count}m ago", { count: Math.round(diff / 60_000) });
  if (diff < 86400_000) return l10n.t("${count}h ago", { count: Math.round(diff / 3600_000) });
  return l10n.t("${count}d ago", { count: Math.round(diff / 86400_000) });
}

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: typeof BellIcon; label: string; color: string; bg: string }
> = {
  urgent: {
    icon: AlertTriangleIcon,
    label: "Urgent",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  important: {
    icon: StarIcon,
    label: "Important",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  normal: {
    icon: InboxIcon,
    label: "Normal",
    color: "text-foreground/60",
    bg: "bg-foreground/[0.04]",
  },
  spam: {
    icon: BanIcon,
    label: "Spam",
    color: "text-muted-foreground/50",
    bg: "bg-foreground/[0.02]",
  },
};

type FilterTab = "all" | NotificationCategory;

// ---------------------------------------------------------------------------
// NotificationCenter Panel
// ---------------------------------------------------------------------------

export function NotificationCenter() {
  const dispatch = useDispatch<AppDispatch>();
  const { notifications, config, loading, classifying } = useSelector(
    (state: RootState) => state.notification,
  );
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load config and notifications on mount
  useEffect(() => {
    dispatch(loadNIConfig());
    dispatch(fetchNotifications());
  }, [dispatch]);

  // Listen for real-time updates from sidecar
  useEffect(() => {
    return window.api.notificationIntelligence.onUpdate((updated) => {
      dispatch(replaceNotifications(updated));
    });
  }, [dispatch]);

  // Filtered & grouped notifications
  const filtered = useMemo(() => {
    let list = notifications;
    if (activeFilter !== "all") {
      list = list.filter((n) => n.category === activeFilter);
    }
    // Hide spam by default in "all" view
    if (activeFilter === "all") {
      list = list.filter((n) => n.category !== "spam");
    }
    return list;
  }, [notifications, activeFilter]);

  // Count by category
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, urgent: 0, important: 0, normal: 0, spam: 0 };
    for (const n of notifications) {
      const cat = n.category || "normal";
      c[cat] = (c[cat] || 0) + 1;
      if (cat !== "spam") c.all = (c.all || 0) + 1;
    }
    return c;
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && n.category !== "spam").length,
    [notifications],
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchNotifications()).then((action) => {
      if (action.meta.requestStatus === "fulfilled" && config.autoClassify) {
        dispatch(classifyNotifications(action.payload as MacNotification[]));
      }
    });
  }, [dispatch, config.autoClassify]);

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = filtered.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      dispatch(markNotificationsRead(unreadIds));
    }
  }, [dispatch, filtered]);

  const handleToggleEnabled = useCallback(() => {
    if (config.enabled) {
      dispatch(stopNI());
    } else {
      dispatch(startNI());
    }
  }, [dispatch, config.enabled]);

  const handleClassifyAll = useCallback(() => {
    dispatch(classifyNotifications(notifications));
  }, [dispatch, notifications]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
      <div className="max-w-3xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {l10n.t("Notification Intelligence")}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("AI-powered notification management")}
              {unreadCount > 0 && (
                <span className="ml-1.5 text-foreground/70 font-medium">
                  ({unreadCount} {l10n.t("unread")})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border/50 hover:border-border hover:bg-foreground/[0.02] transition-all disabled:opacity-50"
            >
              <RefreshCwIcon className={cn("w-3 h-3", loading && "animate-spin")} />
              {l10n.t("Refresh")}
            </button>
            <button
              onClick={handleClassifyAll}
              disabled={classifying || notifications.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border/50 hover:border-border hover:bg-foreground/[0.02] transition-all disabled:opacity-50"
            >
              <SparklesIcon className={cn("w-3 h-3", classifying && "animate-pulse")} />
              {l10n.t("Classify")}
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border/50 hover:border-border hover:bg-foreground/[0.02] transition-all disabled:opacity-50"
            >
              <CheckCheckIcon className="w-3 h-3" />
              {l10n.t("Read All")}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border/50 hover:border-border hover:bg-foreground/[0.02] transition-all"
            >
              <SettingsIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleToggleEnabled}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all",
                config.enabled
                  ? "bg-foreground text-background hover:opacity-90"
                  : "text-muted-foreground hover:text-foreground border border-border/50 hover:border-border hover:bg-foreground/[0.02]",
              )}
            >
              {config.enabled ? (
                <>
                  <SquareIcon className="w-3 h-3" />
                  {l10n.t("Stop")}
                </>
              ) : (
                <>
                  <PlayIcon className="w-3 h-3" />
                  {l10n.t("Start")}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-border/30 pb-2">
          {(["all", "urgent", "important", "normal", "spam"] as FilterTab[]).map((tab) => {
            const isActive = activeFilter === tab;
            const count = counts[tab] || 0;
            const cfg = tab !== "all" ? CATEGORY_CONFIG[tab] : null;
            const Icon = cfg?.icon || FilterIcon;

            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  isActive
                    ? "bg-foreground/[0.06] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]",
                )}
              >
                <Icon className={cn("w-3 h-3", cfg?.color)} />
                {tab === "all" ? l10n.t("All") : l10n.t(cfg!.label)}
                {count > 0 && <span className="text-[10px] tabular-nums opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? (
          <div className="border border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
            {config.enabled ? (
              <>
                <BellIcon className="w-6 h-6 text-muted-foreground" />
                <p className="text-[12px] text-muted-foreground">
                  {notifications.length === 0
                    ? l10n.t("No notifications found")
                    : l10n.t("No notifications in this category")}
                </p>
              </>
            ) : (
              <>
                <BellOffIcon className="w-6 h-6 text-muted-foreground" />
                <p className="text-[12px] text-muted-foreground">
                  {l10n.t("Notification Intelligence is disabled")}
                </p>
                <button
                  onClick={handleToggleEnabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity mt-1"
                >
                  <PlayIcon className="w-3 h-3" />
                  {l10n.t("Enable")}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={() => dispatch(markNotificationsRead([notification.id]))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <NISettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        onSave={(c) => dispatch(saveNIConfig(c))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationCard
// ---------------------------------------------------------------------------

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: MacNotification;
  onMarkRead: () => void;
}) {
  const cat = notification.category || "normal";
  const cfg = CATEGORY_CONFIG[cat];
  const Icon = cfg.icon;

  const handleClick = () => {
    window.api.notificationIntelligence.openApp(notification.appId).catch(() => {});
    if (!notification.read) onMarkRead();
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex items-start gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer",
        notification.read
          ? "border-border/20 opacity-60"
          : "border-border/40 hover:border-border/60 hover:bg-foreground/[0.015]",
      )}
    >
      {/* Category icon */}
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          cfg.bg,
        )}
      >
        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-px rounded bg-foreground/[0.03]">
            {notification.appName}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {formatRelativeTime(notification.deliveredAt)}
          </span>
          {!notification.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
        </div>
        <p className="text-[13px] font-medium text-foreground leading-snug mt-0.5 truncate">
          {notification.title}
        </p>
        {notification.subtitle && (
          <p className="text-[11px] text-foreground/70 mt-0.5 truncate">{notification.subtitle}</p>
        )}
        {notification.body && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {notification.body}
          </p>
        )}
        {notification.categoryReason && (
          <p className="text-[10px] text-muted-foreground/50 mt-1 italic">
            {notification.categoryReason}
          </p>
        )}
      </div>

      {/* Actions */}
      {!notification.read && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead();
          }}
          className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-foreground/[0.04] transition-all shrink-0"
          title={l10n.t("Mark as read")}
        >
          <CheckCheckIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Dialog
// ---------------------------------------------------------------------------

function NISettingsDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: NotificationIntelligenceConfig;
  onSave: (config: NotificationIntelligenceConfig) => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);
  const [newRuleAppId, setNewRuleAppId] = useState("");
  const [newRuleKeyword, setNewRuleKeyword] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<NotificationCategory>("spam");

  useEffect(() => {
    if (open) setLocalConfig(config);
  }, [open, config]);

  const handleSave = () => {
    onSave(localConfig);
  };

  const addRule = () => {
    if (!newRuleAppId && !newRuleKeyword) return;
    const rule: NotificationRule = {
      id: uuidv4(),
      category: newRuleCategory,
    };
    if (newRuleAppId) rule.appId = newRuleAppId;
    if (newRuleKeyword) rule.keyword = newRuleKeyword;
    setLocalConfig({ ...localConfig, rules: [...localConfig.rules, rule] });
    setNewRuleAppId("");
    setNewRuleKeyword("");
  };

  const removeRule = (id: string) => {
    setLocalConfig({
      ...localConfig,
      rules: localConfig.rules.filter((r) => r.id !== id),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={l10n.t("Notification Intelligence Settings")}
        description={l10n.t("Configure how notifications are monitored and classified")}
        maxWidth="md"
      >
        <div className="space-y-5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {/* General */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {l10n.t("General")}
            </h3>
            <div className="flex items-center justify-between">
              <label className="text-[12px] text-foreground">
                {l10n.t("Auto-classify with AI")}
              </label>
              <button
                onClick={() =>
                  setLocalConfig({ ...localConfig, autoClassify: !localConfig.autoClassify })
                }
                className="shrink-0"
              >
                <span
                  className={cn(
                    "relative block w-7 h-4 rounded-full transition-colors",
                    localConfig.autoClassify ? "bg-foreground" : "bg-foreground/[0.12]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-[2px] w-3 h-3 rounded-full transition-all duration-150",
                      localConfig.autoClassify
                        ? "left-[14px] bg-background"
                        : "left-[2px] bg-foreground/25",
                    )}
                  />
                </span>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[12px] text-foreground">{l10n.t("Polling interval")}</label>
              <div className="flex items-center gap-1.5">
                <InputBox
                  type="number"
                  value={Math.round(localConfig.pollingIntervalMs / 1000)}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      pollingIntervalMs: Math.max(10, parseInt(e.target.value) || 30) * 1000,
                    })
                  }
                  className="h-7 text-[12px] rounded-md bg-background w-16"
                  min={10}
                />
                <span className="text-[11px] text-muted-foreground">{l10n.t("seconds")}</span>
              </div>
            </div>
          </div>

          {/* Rules */}
          <div className="border-t border-border/30 pt-5 space-y-3">
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {l10n.t("Classification Rules")}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {l10n.t("Rules are checked before AI classification. First matching rule wins.")}
            </p>

            {/* Existing rules */}
            {localConfig.rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/[0.02] border border-border/20"
              >
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-px rounded",
                    CATEGORY_CONFIG[rule.category].bg,
                    CATEGORY_CONFIG[rule.category].color,
                  )}
                >
                  {rule.category}
                </span>
                {rule.appId && (
                  <span className="text-[11px] text-muted-foreground">
                    app: <code className="text-foreground/70">{rule.appId}</code>
                  </span>
                )}
                {rule.keyword && (
                  <span className="text-[11px] text-muted-foreground">
                    keyword: <code className="text-foreground/70">{rule.keyword}</code>
                  </span>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Add rule */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">
                  {l10n.t("App ID (optional)")}
                </label>
                <InputBox
                  value={newRuleAppId}
                  onChange={(e) => setNewRuleAppId(e.target.value)}
                  placeholder="com.apple.MobileSMS"
                  className="h-7 text-[11px] rounded-md bg-background"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">
                  {l10n.t("Keyword (optional)")}
                </label>
                <InputBox
                  value={newRuleKeyword}
                  onChange={(e) => setNewRuleKeyword(e.target.value)}
                  placeholder="urgent"
                  className="h-7 text-[11px] rounded-md bg-background"
                />
              </div>
              <Select
                value={newRuleCategory}
                onChange={(v) => setNewRuleCategory(v as NotificationCategory)}
                options={[
                  { value: "urgent", label: l10n.t("Urgent") },
                  { value: "important", label: l10n.t("Important") },
                  { value: "normal", label: l10n.t("Normal") },
                  { value: "spam", label: l10n.t("Spam") },
                ]}
                className="h-7 w-28"
              />
              <button
                onClick={addRule}
                disabled={!newRuleAppId && !newRuleKeyword}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                  newRuleAppId || newRuleKeyword
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-foreground/10 text-foreground/30 cursor-not-allowed",
                )}
              >
                <PlusIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/20">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {l10n.t("Cancel")}
          </button>
          <button
            onClick={() => {
              handleSave();
              onOpenChange(false);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            {l10n.t("Save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
