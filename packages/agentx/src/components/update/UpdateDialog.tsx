import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  closeUpdateDialog,
  downloadUpdate,
  installUpdate,
  checkForUpdates,
} from "@/slices/updateSlice";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { LoaderIcon, RotateCcwIcon } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

const btnFilled = cn(
  "px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors",
  "bg-foreground/10 text-foreground hover:bg-foreground/15",
);

const btnGhost = cn(
  "px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors",
  "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
);

export function UpdateDialog() {
  const dispatch = useDispatch<AppDispatch>();
  const { state, version, progress, error, dialogOpen } = useSelector((s: RootState) => s.update);

  const canClose = state !== "downloading";

  const handleOpenChange = (open: boolean) => {
    if (!open && canClose) {
      dispatch(closeUpdateDialog());
    }
  };

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={handleOpenChange}
      closeOnClickOutside={canClose}
      closeOnEscape={canClose}
    >
      <DialogContent showCloseButton={false} maxWidth="xs" className="!p-5 !gap-0 !rounded-xl">
        {/* Checking */}
        {state === "checking" && (
          <div className="flex items-center gap-2.5 py-1">
            <LoaderIcon className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
            <p className="text-[13px] text-muted-foreground">{l10n.t("Checking for updates...")}</p>
          </div>
        )}

        {/* Up to date */}
        {state === "not-available" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-[14px] font-medium text-foreground">
                {l10n.t("You're up to date")}
              </h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                {l10n.t("AgentX ${version} is the latest version.", {
                  version: __APP_VERSION__,
                })}
              </p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => dispatch(closeUpdateDialog())} className={btnFilled}>
                {l10n.t("OK")}
              </button>
            </div>
          </div>
        )}

        {/* Update available */}
        {state === "available" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-[14px] font-medium text-foreground">
                {l10n.t("Update Available")}
              </h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                {l10n.t("AgentX {{newVersion}} is available (you have {{currentVersion}}).", {
                  newVersion: version ?? "",
                  currentVersion: __APP_VERSION__,
                })}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => dispatch(closeUpdateDialog())} className={btnGhost}>
                {l10n.t("Later")}
              </button>
              <button onClick={() => dispatch(downloadUpdate())} className={btnFilled}>
                {l10n.t("Download")}
              </button>
            </div>
          </div>
        )}

        {/* Downloading */}
        {state === "downloading" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-foreground">{l10n.t("Downloading...")}</p>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {progress ? `${progress.percent.toFixed(0)}%` : ""}
              </span>
            </div>
            {progress && (
              <>
                <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/40 transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                  </span>
                  <span>{formatSpeed(progress.bytesPerSecond)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Downloaded — ready to install */}
        {state === "downloaded" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-[14px] font-medium text-foreground">
                {l10n.t("Ready to Install")}
              </h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                {l10n.t("AgentX ${version} has been downloaded. Restart to complete the update.", {
                  version: version ?? "",
                })}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => dispatch(closeUpdateDialog())} className={btnGhost}>
                {l10n.t("Later")}
              </button>
              <button onClick={() => dispatch(installUpdate())} className={btnFilled}>
                {l10n.t("Restart & Update")}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-[14px] font-medium text-foreground">{l10n.t("Update Failed")}</h3>
              {error && <p className="text-[11px] text-muted-foreground mt-1 break-all">{error}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => dispatch(closeUpdateDialog())} className={btnGhost}>
                {l10n.t("Close")}
              </button>
              <button
                onClick={() => dispatch(checkForUpdates())}
                className={cn(btnFilled, "inline-flex items-center gap-1")}
              >
                <RotateCcwIcon className="w-3 h-3" />
                {l10n.t("Retry")}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
