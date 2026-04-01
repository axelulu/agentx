import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { l10n } from "@agentx/l10n";
import { Select } from "@/components/ui/Select";
import { Trash2Icon } from "lucide-react";

const RETENTION_OPTIONS = [
  { value: "3600", label: "1 " + l10n.t("hour") },
  { value: "86400", label: "24 " + l10n.t("hours") },
  { value: "604800", label: "7 " + l10n.t("days") },
  { value: "2592000", label: "30 " + l10n.t("days") },
  { value: "forever", label: l10n.t("Forever") },
];

export function ClipboardConfig() {
  const [retention, setRetention] = useState<string>("forever");
  const [entryCount, setEntryCount] = useState(0);
  const [clearing, setClearing] = useState(false);

  // Load current retention and entry count
  useEffect(() => {
    invoke<number | null>("clipboard_get_retention").then((seconds) => {
      setRetention(seconds != null ? String(seconds) : "forever");
    });
    invoke<unknown[]>("clipboard_history_list").then((entries) => {
      setEntryCount(entries.length);
    });
  }, []);

  const handleRetentionChange = async (value: string) => {
    setRetention(value);
    const seconds = value === "forever" ? null : Number(value);
    await invoke("clipboard_set_retention", { seconds });
    await window.api.preferences.set({ clipboardRetentionSeconds: seconds });
    // Refresh count after cleanup
    const entries = await invoke<unknown[]>("clipboard_history_list");
    setEntryCount(entries.length);
  };

  const handleClear = async () => {
    setClearing(true);
    await invoke("clipboard_history_clear");
    const entries = await invoke<unknown[]>("clipboard_history_list");
    setEntryCount(entries.length);
    setClearing(false);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Retention Period */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">{l10n.t("History Retention")}</label>
        <p className="text-[11px] text-muted-foreground">
          {l10n.t(
            "How long to keep clipboard history entries. Pinned and favorited items are always kept.",
          )}
        </p>
        <Select value={retention} onChange={handleRetentionChange} options={RETENTION_OPTIONS} />
      </div>

      {/* History Stats */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">{l10n.t("History")}</label>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <span className="text-xs text-muted-foreground">
            {l10n.t("Stored entries")}:{" "}
            <span className="text-foreground font-medium">{entryCount}</span>
          </span>
          <button
            onClick={handleClear}
            disabled={clearing || entryCount === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2Icon className="w-3 h-3" />
            {l10n.t("Clear History")}
          </button>
        </div>
      </div>
    </div>
  );
}
