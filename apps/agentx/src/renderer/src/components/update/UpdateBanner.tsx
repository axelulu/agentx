import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { dismissUpdate, downloadUpdate, installUpdate } from "@/slices/updateSlice";
import type { AppDispatch } from "@/slices/store";
import { l10n } from "@workspace/l10n";
import { DownloadIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function UpdateBanner() {
  const dispatch = useDispatch<AppDispatch>();
  const { state, version, progress, dismissed } = useSelector((s: RootState) => s.update);

  if (dismissed) return null;
  if (!["available", "downloading", "downloaded"].includes(state)) return null;

  return (
    <div className="mx-4 mt-1 animate-in slide-in-from-top-2 duration-200">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          {/* Content */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {state === "available" && (
              <>
                <DownloadIcon className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-[12px] text-foreground truncate">
                  {l10n.t("A new version is available: {{version}}", { version: version ?? "" })}
                </span>
              </>
            )}

            {state === "downloading" && (
              <>
                <RefreshCwIcon className="w-4 h-4 text-blue-500 shrink-0 animate-spin" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-[12px] text-foreground">
                    {l10n.t("Downloading update...")}
                    {progress && ` ${progress.percent.toFixed(0)}%`}
                  </span>
                  {progress && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatSpeed(progress.bytesPerSecond)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {state === "downloaded" && (
              <>
                <DownloadIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[12px] text-foreground">
                    {l10n.t("Update {{version}} is ready to install.", { version: version ?? "" })}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {l10n.t("The update will be installed when you quit the app.")}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {state === "available" && (
              <>
                <button
                  onClick={() => dispatch(downloadUpdate())}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                    "bg-blue-600 text-white hover:bg-blue-700",
                  )}
                >
                  {l10n.t("Download")}
                </button>
                <button
                  onClick={() => dispatch(dismissUpdate())}
                  className="p-1 rounded-md hover:bg-foreground/10 transition-colors text-muted-foreground"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {state === "downloaded" && (
              <>
                <button
                  onClick={() => dispatch(installUpdate())}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                    "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  {l10n.t("Restart & Update")}
                </button>
                <button
                  onClick={() => dispatch(dismissUpdate())}
                  className="p-1 rounded-md hover:bg-foreground/10 transition-colors text-muted-foreground"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
