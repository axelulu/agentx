import { useCallback, useEffect, useState } from "react";
import { l10n } from "@agentx/l10n";
import {
  AccessibilityIcon,
  MonitorIcon,
  MicIcon,
  CameraIcon,
  HardDriveIcon,
  BotIcon,
  BellIcon,
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  CircleDotIcon,
  AlertCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

type PermissionType =
  | "accessibility"
  | "screen"
  | "microphone"
  | "camera"
  | "full-disk-access"
  | "automation"
  | "notifications";

type PermissionStatus =
  | "granted"
  | "denied"
  | "not-determined"
  | "restricted"
  | "limited"
  | "unknown";

interface PermissionInfo {
  type: PermissionType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
}

const PERMISSIONS: PermissionInfo[] = [
  {
    type: "accessibility",
    labelKey: "Accessibility",
    descriptionKey: "Control your computer and interact with apps",
    icon: AccessibilityIcon,
  },
  {
    type: "screen",
    labelKey: "Screen Recording",
    descriptionKey: "Capture screen content for visual context",
    icon: MonitorIcon,
  },
  {
    type: "microphone",
    labelKey: "Microphone",
    descriptionKey: "Access microphone for voice input",
    icon: MicIcon,
  },
  {
    type: "camera",
    labelKey: "Camera",
    descriptionKey: "Access camera for visual input",
    icon: CameraIcon,
  },
  {
    type: "full-disk-access",
    labelKey: "Full Disk Access",
    descriptionKey: "Read and write files across the entire system",
    icon: HardDriveIcon,
  },
  {
    type: "automation",
    labelKey: "Automation",
    descriptionKey: "Control other applications via AppleScript",
    icon: BotIcon,
  },
  {
    type: "notifications",
    labelKey: "Notifications",
    descriptionKey: "Send desktop notifications",
    icon: BellIcon,
  },
];

const STATUS_CONFIG: Record<
  PermissionStatus,
  { icon: React.ElementType; color: string; dotColor: string; labelKey: string }
> = {
  granted: {
    icon: CheckCircle2Icon,
    color: "text-foreground",
    dotColor: "bg-foreground",
    labelKey: "Granted",
  },
  denied: {
    icon: XCircleIcon,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
    labelKey: "Denied",
  },
  "not-determined": {
    icon: CircleDotIcon,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
    labelKey: "Not Set",
  },
  restricted: {
    icon: AlertCircleIcon,
    color: "text-orange-500",
    dotColor: "bg-orange-500",
    labelKey: "Restricted",
  },
  limited: {
    icon: AlertCircleIcon,
    color: "text-orange-500",
    dotColor: "bg-orange-500",
    labelKey: "Limited",
  },
  unknown: {
    icon: CircleDotIcon,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
    labelKey: "Unknown",
  },
};

// =============================================================================
// Component
// =============================================================================

export function PermissionsConfig() {
  const [statuses, setStatuses] = useState<Record<PermissionType, PermissionStatus> | null>(null);
  const [requesting, setRequesting] = useState<PermissionType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await window.api.permissions.checkAll();
      setStatuses(result as Record<PermissionType, PermissionStatus>);
    } catch (err) {
      console.error("[Permissions] checkAll failed:", err);
      const fallback = {} as Record<PermissionType, PermissionStatus>;
      for (const p of PERMISSIONS) fallback[p.type] = "unknown";
      setStatuses(fallback);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when app regains focus (user may have toggled permissions in System Settings)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // Click "Grant" → first try to request programmatically (triggers system dialog),
  // then fall back to opening System Settings if not possible
  const handleGrant = useCallback(
    async (perm: PermissionInfo) => {
      if (requesting) return;
      setRequesting(perm.type);
      try {
        const result = await window.api.permissions.request(perm.type);

        if (result?.status === "granted") {
          showFeedback(l10n.t("Permission granted!"));
          await refresh();
          return;
        }

        if (result?.canRequestDirectly) {
          showFeedback(
            l10n.t(
              "Permission was denied. Opening System Settings — please enable it manually and switch back.",
            ),
          );
        } else {
          showFeedback(
            l10n.t(
              "System Settings opened. Please add AgentX to the list and enable the permission.",
            ),
          );
        }

        await window.api.permissions.openSettings(perm.type);
        setTimeout(refresh, 2000);
      } catch {
        showFeedback(l10n.t("Could not open System Settings. Please open manually."));
      } finally {
        setRequesting(null);
      }
    },
    [requesting, refresh, showFeedback],
  );

  // Click "Revoke" → try tccutil reset, fall back to opening System Settings
  // IMPORTANT: After a successful reset, do NOT call refresh() because
  // checkAllPermissions() would re-trigger macOS permission dialogs
  // (e.g. checkAutomation runs osascript which prompts for permission).
  // Instead, update local state directly to "not-determined".
  const handleRevoke = useCallback(
    async (perm: PermissionInfo) => {
      if (requesting) return;
      setRequesting(perm.type);
      try {
        const result = await window.api.permissions.reset(perm.type);

        if (result.success) {
          showFeedback(l10n.t("Permission revoked successfully."));
          // Update only this permission's status locally — avoid re-checking all
          setStatuses((prev) =>
            prev ? { ...prev, [perm.type]: "not-determined" as PermissionStatus } : prev,
          );
          return;
        }

        // tccutil failed or not supported — open System Settings
        showFeedback(
          l10n.t(
            "Opening System Settings — please find AgentX in the list and disable the permission.",
          ),
        );
        await window.api.permissions.openSettings(perm.type);
      } catch {
        showFeedback(l10n.t("Could not revoke permission. Please disable it in System Settings."));
      } finally {
        setRequesting(null);
      }
    },
    [requesting, showFeedback],
  );

  const grantedCount = statuses ? Object.values(statuses).filter((s) => s === "granted").length : 0;
  const totalCount = PERMISSIONS.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("System Permissions")}
        </label>
        {statuses && (
          <span className="text-[11px] text-muted-foreground">
            {grantedCount}/{totalCount} {l10n.t("granted")}
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {l10n.t(
          "AgentX needs these permissions to control your desktop. Click Grant to open System Settings.",
        )}
      </p>

      {feedback && (
        <div className="rounded-md bg-foreground/[0.03] px-3 py-2">
          <p className="text-[12px] text-foreground/80">{feedback}</p>
        </div>
      )}

      <div className="space-y-1.5">
        {PERMISSIONS.map((perm) => {
          const status = statuses?.[perm.type] ?? "unknown";
          const config = STATUS_CONFIG[status];
          const isRequesting = requesting === perm.type;
          const isGranted = status === "granted";

          return (
            <div
              key={perm.type}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isGranted
                  ? "bg-foreground/[0.03]"
                  : "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
              )}
            >
              <perm.icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0",
                  isGranted ? "text-foreground" : "text-muted-foreground",
                )}
              />

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground">{l10n.t(perm.labelKey)}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {l10n.t(perm.descriptionKey)}
                </p>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-1.5 shrink-0 min-w-[70px]">
                <div className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
                <span className={cn("text-[11px] font-medium", config.color)}>
                  {l10n.t(config.labelKey)}
                </span>
              </div>

              {/* Action button */}
              <div className="shrink-0">
                {isGranted ? (
                  <button
                    onClick={() => handleRevoke(perm)}
                    disabled={isRequesting}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      "text-red-400 hover:text-red-300 hover:bg-red-500/10",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                    title={l10n.t("Revoke permission")}
                  >
                    {isRequesting ? (
                      <Loader2Icon className="w-3 h-3 animate-spin" />
                    ) : (
                      l10n.t("Revoke")
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleGrant(perm)}
                    disabled={isRequesting}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      "bg-foreground text-background hover:bg-foreground/90",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                    title={l10n.t("Grant permission")}
                  >
                    {isRequesting ? (
                      <Loader2Icon className="w-3 h-3 animate-spin" />
                    ) : (
                      l10n.t("Grant")
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
