/**
 * Hook that polls system health stats for the Dynamic Island idle display.
 * Returns CPU and memory usage percentages, updated every 3 seconds.
 */
import { useState, useEffect } from "react";

interface SystemStats {
  cpuPercent: number;
  memPercent: number;
}

export function useSystemStats(enabled: boolean): SystemStats {
  const [stats, setStats] = useState<SystemStats>({ cpuPercent: 0, memPercent: 0 });

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const fetch = async () => {
      try {
        const snap = (await window.api.systemHealth.snapshot()) as {
          cpu?: { usagePercent?: number };
          memory?: { usagePercent?: number };
        } | null;
        if (!mounted || !snap) return;
        setStats({
          cpuPercent: Math.round(snap.cpu?.usagePercent ?? 0),
          memPercent: Math.round(snap.memory?.usagePercent ?? 0),
        });
      } catch {
        // sidecar not ready or command failed — ignore
      }
    };

    fetch();
    const interval = setInterval(fetch, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return stats;
}
