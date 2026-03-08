import { useCallback, useEffect, useState } from "react";
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
  label: string;
  description: string;
  icon: React.ElementType;
}

const PERMISSIONS: PermissionInfo[] = [
  {
    type: "accessibility",
    label: "Accessibility",
    description: "Control your computer and interact with apps",
    icon: AccessibilityIcon,
  },
  {
    type: "screen",
    label: "Screen Recording",
    description: "Capture screen content for visual context",
    icon: MonitorIcon,
  },
  {
    type: "microphone",
    label: "Microphone",
    description: "Access microphone for voice input",
    icon: MicIcon,
  },
  {
    type: "camera",
    label: "Camera",
    description: "Access camera for visual input",
    icon: CameraIcon,
  },
  {
    type: "full-disk-access",
    label: "Full Disk Access",
    description: "Read and write files across the entire system",
    icon: HardDriveIcon,
  },
  {
    type: "automation",
    label: "Automation",
    description: "Control other applications via AppleScript",
    icon: BotIcon,
  },
  {
    type: "notifications",
    label: "Notifications",
    description: "Send desktop notifications",
    icon: BellIcon,
  },
];

const STATUS_CONFIG: Record<
  PermissionStatus,
  { icon: React.ElementType; color: string; dotColor: string; label: string }
> = {
  granted: {
    icon: CheckCircle2Icon,
    color: "text-emerald-500",
    dotColor: "bg-emerald-500",
    label: "Granted",
  },
  denied: { icon: XCircleIcon, color: "text-red-500", dotColor: "bg-red-500", label: "Denied" },
  "not-determined": {
    icon: CircleDotIcon,
    color: "text-yellow-500",
    dotColor: "bg-yellow-500",
    label: "Not Set",
  },
  restricted: {
    icon: AlertCircleIcon,
    color: "text-orange-500",
    dotColor: "bg-orange-500",
    label: "Restricted",
  },
  limited: {
    icon: AlertCircleIcon,
    color: "text-orange-500",
    dotColor: "bg-orange-500",
    label: "Limited",
  },
  unknown: {
    icon: CircleDotIcon,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
    label: "Unknown",
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

  // Click "Grant" → directly open System Settings to the right pane
  const handleGrant = useCallback(
    async (perm: PermissionInfo) => {
      console.log(`[PermissionsConfig] handleGrant called for: ${perm.type}`);
      if (requesting) {
        console.log(`[PermissionsConfig] Already requesting, skipping`);
        return;
      }
      setRequesting(perm.type);
      try {
        console.log(
          `[PermissionsConfig] Calling window.api.permissions.openSettings(${perm.type})`,
        );
        await window.api.permissions.openSettings(perm.type);
        console.log(`[PermissionsConfig] openSettings resolved successfully`);
        showFeedback(`System Settings opened — enable "${perm.label}" and switch back`);
        setTimeout(refresh, 2000);
      } catch (err) {
        console.error(`[PermissionsConfig] openSettings(${perm.type}) failed:`, err);
        showFeedback(
          "Could not open System Settings. Please open manually: System Settings > Privacy & Security",
        );
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
          System Permissions
        </label>
        {statuses && (
          <span className="text-[11px] text-muted-foreground">
            {grantedCount}/{totalCount} granted
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground">
        AgentX needs these system permissions to fully control your desktop. Click "Grant" to open
        System Settings where you can enable each permission.
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
                <p className="text-[13px] font-medium text-foreground">{perm.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {perm.description}
                </p>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-1.5 shrink-0 min-w-[70px]">
                <div className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
                <span className={cn("text-[11px] font-medium", config.color)}>{config.label}</span>
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
                  title={isGranted ? "Open System Settings" : `Grant ${perm.label} permission`}
                >
                  {isRequesting ? (
                    <Loader2Icon className="w-3 h-3 animate-spin" />
                  ) : isGranted ? (
                    <ExternalLinkIcon className="w-3 h-3" />
                  ) : (
                    "Grant"
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
