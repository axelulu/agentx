import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/slices/store";
import { createNewConversation, addUserMessage } from "@/slices/chatSlice";
import { setSettingsOpen, openTab } from "@/slices/uiSlice";
import { l10n } from "@agentx/l10n";
import {
  CpuIcon,
  MemoryStickIcon,
  HardDriveIcon,
  BatteryChargingIcon,
  BatteryIcon,
  WifiIcon,
  RefreshCwIcon,
  SparklesIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-foreground/[0.06]", className)} />;
}

function SkeletonGauge() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="w-4 h-4 rounded shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );
}

function SkeletonLoading() {
  return (
    <div className="space-y-5">
      {/* Header buttons skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-5 w-9 rounded-full" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>

      {/* Overview skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-64" />
          <Skeleton className="h-2.5 w-48" />
          <Skeleton className="h-2.5 w-36" />
        </div>
      </div>

      {/* Gauges skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <SkeletonGauge />
        <SkeletonGauge />
        <SkeletonGauge />
        <SkeletonGauge />
      </div>

      {/* Network skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Processes skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <div className="rounded-md border border-border overflow-hidden">
          <div className="bg-foreground/[0.03] border-b border-border px-2.5 py-1.5">
            <Skeleton className="h-3 w-full" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-2.5 py-1.5 border-b border-border last:border-0"
            >
              <Skeleton className="h-2.5 flex-1" />
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gauge Component
// ---------------------------------------------------------------------------

function UsageGauge({
  label,
  percent,
  detail,
  icon: Icon,
}: {
  label: string;
  percent: number;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-foreground">{label}</span>
          <span className="text-[12px] font-mono font-medium text-foreground">
            {percent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-foreground/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-foreground/40"
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert Component
// ---------------------------------------------------------------------------

function HealthAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-foreground/[0.04] border border-border">
      <AlertTriangleIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[12px] text-foreground/80">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SystemHealthConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await window.api.systemHealth.snapshot();
      setSnapshot(data);
    } catch (err) {
      console.error("[SystemHealth] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSnapshot, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchSnapshot]);

  const handleRefresh = () => {
    setLoading(true);
    fetchSnapshot();
  };

  // Generate alerts from snapshot
  const alerts: string[] = [];
  if (snapshot) {
    if (snapshot.cpu.usagePercent >= 90) {
      alerts.push(
        l10n.t("CPU usage is critically high (${percent}%)", {
          percent: snapshot.cpu.usagePercent.toFixed(1),
        }),
      );
    }
    if (snapshot.memory.usagePercent >= 90) {
      alerts.push(
        l10n.t("Memory usage is critically high (${percent}%)", {
          percent: snapshot.memory.usagePercent.toFixed(1),
        }),
      );
    }
    if (snapshot.disk.availableBytes < 5 * 1024 * 1024 * 1024) {
      alerts.push(
        l10n.t("Disk space is low — only ${space} remaining", {
          space: formatBytes(snapshot.disk.availableBytes),
        }),
      );
    }
    if (snapshot.battery && !snapshot.battery.charging && snapshot.battery.percent < 15) {
      alerts.push(
        l10n.t("Battery is critically low (${percent}%)", {
          percent: snapshot.battery.percent,
        }),
      );
    }
  }

  // AI diagnosis: create a new conversation (same flow as useAgent.sendMessage)
  const handleAIDiagnosis = async () => {
    setDiagnosing(true);
    try {
      const data = await window.api.systemHealth.snapshot();
      const content = buildDiagnosisPrompt(data);

      // 1. Create conversation via Redux (updates state.conversations, sets currentConversationId)
      const conv = await dispatch(createNewConversation()).unwrap();
      const convId = conv.id;

      // 2. Open tab (same as useAgent)
      dispatch(openTab(convId));

      // 3. Close settings to show the chat
      dispatch(setSettingsOpen(false));

      // 4. Optimistically add user message to UI
      dispatch(addUserMessage({ conversationId: convId, content }));

      // 5. Send to agent + subscribe for events
      await window.api.agent.send(convId, content);
      await window.api.agent.subscribe(convId);
    } catch (err) {
      console.error("[SystemHealth] AI diagnosis failed:", err);
    } finally {
      setDiagnosing(false);
    }
  };

  if (loading && !snapshot) {
    return <SkeletonLoading />;
  }

  if (!snapshot) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {l10n.t("Failed to load system information")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAIDiagnosis}
          disabled={diagnosing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          {diagnosing ? l10n.t("Analyzing...") : l10n.t("AI Diagnosis")}
        </button>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border border-border text-foreground hover:bg-foreground/[0.04] transition-colors"
        >
          <RefreshCwIcon className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {l10n.t("Refresh")}
        </button>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            "relative w-9 h-5 rounded-full transition-colors ml-auto",
            autoRefresh ? "bg-primary" : "bg-foreground/[0.12]",
          )}
          title={l10n.t("Auto-refresh every 5s")}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
              autoRefresh && "translate-x-4",
            )}
          />
        </button>
        <span className="text-[11px] text-muted-foreground">{l10n.t("Auto")}</span>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((msg, i) => (
            <HealthAlert key={i} message={msg} />
          ))}
        </div>
      )}

      {/* System overview */}
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Overview")}
        </label>
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <p>{snapshot.cpu.model}</p>
          <p>{snapshot.uptime}</p>
          {snapshot.loadAverage.length > 0 && (
            <p>
              {l10n.t("Load")}: {snapshot.loadAverage.map((v) => v.toFixed(2)).join("  ")}
            </p>
          )}
        </div>
      </div>

      {/* Resource gauges */}
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Resources")}
        </label>

        <UsageGauge
          label={l10n.t("CPU")}
          percent={snapshot.cpu.usagePercent}
          detail={`${snapshot.cpu.cores} ${l10n.t("cores")}`}
          icon={CpuIcon}
        />

        <UsageGauge
          label={l10n.t("Memory")}
          percent={snapshot.memory.usagePercent}
          detail={`${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}`}
          icon={MemoryStickIcon}
        />

        <UsageGauge
          label={l10n.t("Disk")}
          percent={snapshot.disk.usagePercent}
          detail={`${formatBytes(snapshot.disk.availableBytes)} ${l10n.t("available")}`}
          icon={HardDriveIcon}
        />

        {snapshot.battery && (
          <UsageGauge
            label={l10n.t("Battery")}
            percent={snapshot.battery.percent}
            detail={
              snapshot.battery.charging
                ? l10n.t("Charging")
                : (snapshot.battery.timeRemaining ?? l10n.t("On battery"))
            }
            icon={snapshot.battery.charging ? BatteryChargingIcon : BatteryIcon}
          />
        )}
      </div>

      {/* Network */}
      {snapshot.network.length > 0 && (
        <div className="space-y-3">
          <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            {l10n.t("Network")}
          </label>
          <div className="space-y-1.5">
            {snapshot.network.map((iface) => (
              <div key={iface.interfaceName} className="flex items-center gap-3 py-1">
                <WifiIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground font-mono w-12">
                  {iface.interfaceName}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {l10n.t("In")}: {formatBytes(iface.bytesIn)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {l10n.t("Out")}: {formatBytes(iface.bytesOut)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top processes */}
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Top Processes")}
        </label>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-foreground/[0.03] border-b border-border">
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">
                  {l10n.t("Process")}
                </th>
                <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground w-16">
                  PID
                </th>
                <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground w-16">
                  CPU%
                </th>
                <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground w-20">
                  {l10n.t("Memory")}
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.topProcesses.map((proc, i) => (
                <tr
                  key={`${proc.pid}-${i}`}
                  className="border-b border-border last:border-0 hover:bg-foreground/[0.02]"
                >
                  <td className="px-2.5 py-1 text-foreground font-mono truncate max-w-[180px]">
                    {proc.name}
                  </td>
                  <td className="px-2.5 py-1 text-right text-muted-foreground font-mono">
                    {proc.pid}
                  </td>
                  <td className="px-2.5 py-1 text-right font-mono font-medium text-foreground">
                    {proc.cpuPercent.toFixed(1)}
                  </td>
                  <td className="px-2.5 py-1 text-right text-muted-foreground font-mono">
                    {proc.memoryMB.toFixed(0)} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build AI diagnosis prompt from snapshot
// ---------------------------------------------------------------------------

function buildDiagnosisPrompt(s: SystemHealthSnapshot): string {
  const lines = [
    "Please analyze the following system health snapshot and provide a diagnosis. Identify any issues, explain potential causes, and suggest solutions.\n",
    `**CPU**: ${s.cpu.model}, ${s.cpu.cores} cores, ${s.cpu.usagePercent}% usage`,
    `**Memory**: ${formatBytes(s.memory.usedBytes)} used / ${formatBytes(s.memory.totalBytes)} total (${s.memory.usagePercent}%)`,
    `**Swap**: ${formatBytes(s.memory.swapUsedBytes)} used / ${formatBytes(s.memory.swapTotalBytes)} total`,
    `**Disk (/)**: ${formatBytes(s.disk.usedBytes)} used / ${formatBytes(s.disk.totalBytes)} total (${s.disk.usagePercent}%), ${formatBytes(s.disk.availableBytes)} available`,
  ];

  if (s.battery) {
    lines.push(
      `**Battery**: ${s.battery.percent}%, ${s.battery.charging ? "charging" : "discharging"}${s.battery.timeRemaining ? `, ${s.battery.timeRemaining}` : ""}`,
    );
  }

  lines.push(`**Load Average**: ${s.loadAverage.map((v) => v.toFixed(2)).join(", ")}`);
  lines.push(`**Uptime**: ${s.uptime}`);

  if (s.network.length > 0) {
    lines.push(
      `**Network**: ${s.network.map((n) => `${n.interfaceName} (in: ${formatBytes(n.bytesIn)}, out: ${formatBytes(n.bytesOut)})`).join("; ")}`,
    );
  }

  lines.push("\n**Top Processes by CPU:**");
  lines.push("| Process | PID | CPU% | Memory |");
  lines.push("|---------|-----|------|--------|");
  for (const p of s.topProcesses) {
    lines.push(`| ${p.name} | ${p.pid} | ${p.cpuPercent}% | ${p.memoryMB} MB |`);
  }

  return lines.join("\n");
}
