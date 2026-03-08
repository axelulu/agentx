import { useCallback, useEffect, useState } from "react";
import { l10n } from "@workspace/l10n";
import {
  AccessibilityIcon,
  MonitorIcon,
  MicIcon,
  CameraIcon,
  HardDriveIcon,
  BotIcon,
  BellIcon,
  ExternalLinkIcon,
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
    color: "text-emerald-500",
    dotColor: "bg-emerald-500",
    labelKey: "Granted",
  },
  denied: { icon: XCircleIcon, color: "text-red-500", dotColor: "bg-red-500", labelKey: "Denied" },
  "not-determined": {
    icon: CircleDotIcon,
    color: "text-yellow-500",
    dotColor: "bg-yellow-500",
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
      console.log(`[PermissionsConfig] handleGrant called for: ${perm.type}`);
      if (requesting) {
        console.log(`[PermissionsConfig] Already requesting, skipping`);
        return;
      }
      setRequesting(perm.type);
      try {
        // Step 1: Try to request the permission programmatically
        // This triggers the native system dialog and auto-adds the app to the permissions list
        console.log(`[PermissionsConfig] Calling window.api.permissions.request(${perm.type})`);
        const result = await window.api.permissions.request(perm.type);
        console.log(`[PermissionsConfig] request result:`, result);

        if (result?.status === "granted") {
          // Permission granted via system dialog — refresh and we're done
          showFeedback(l10n.t("Permission granted!"));
          await refresh();
          return;
        }

        // Step 2: If the permission was denied or can't be requested programmatically,
        // open System Settings so the user can toggle it manually
        if (result?.canRequestDirectly) {
          // The system dialog was shown but user denied — they need to enable it in Settings
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

        console.log(
          `[PermissionsConfig] Calling window.api.permissions.openSettings(${perm.type})`,
        );
        await window.api.permissions.openSettings(perm.type);
        console.log(`[PermissionsConfig] openSettings resolved successfully`);
        setTimeout(refresh, 2000);
      } catch (err) {
        console.error(`[PermissionsConfig] handleGrant(${perm.type}) failed:`, err);
        showFeedback(l10n.t("Could not open System Settings. Please open manually."));
      } finally {
        setRequesting(null);
      }
    },
    [requesting, refresh, showFeedback],
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
        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2">
          <p className="text-[12px] text-blue-400">{feedback}</p>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                isGranted
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-border bg-secondary/30 hover:bg-secondary/50",
              )}
            >
              <perm.icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0",
                  isGranted ? "text-emerald-500" : "text-muted-foreground",
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
                <button
                  onClick={() => handleGrant(perm)}
                  disabled={isRequesting}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                    isGranted
                      ? "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      : "bg-foreground text-background hover:bg-foreground/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                  title={isGranted ? l10n.t("Open System Settings") : l10n.t("Grant permission")}
                >
                  {isRequesting ? (
                    <Loader2Icon className="w-3 h-3 animate-spin" />
                  ) : isGranted ? (
                    <ExternalLinkIcon className="w-3 h-3" />
                  ) : (
                    l10n.t("Grant")
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
