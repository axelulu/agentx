import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  closeUpdateDialog,
  downloadUpdate,
  installUpdate,
  checkForUpdates,
} from "@/slices/updateSlice";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@workspace/l10n";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  DownloadIcon,
  LoaderIcon,
  AlertCircleIcon,
  RotateCcwIcon,
  RefreshCwIcon,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

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
      <DialogContent
        title={l10n.t("Software Update")}
        showCloseButton={canClose}
        maxWidth="xs"
        className="!p-4 !gap-0 !rounded-xl"
      >
        <div className="flex flex-col items-center gap-3 pt-1 pb-1">
          {/* Checking */}
          {state === "checking" && (
            <>
              <LoaderIcon className="w-6 h-6 text-blue-500 animate-spin" />
              <p className="text-[13px] text-muted-foreground">
                {l10n.t("Checking for updates...")}
              </p>
            </>
          )}

          {/* Up to date */}
          {state === "not-available" && (
            <>
              <CheckCircle2Icon className="w-6 h-6 text-emerald-500" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-foreground">
                  {l10n.t("You're up to date")}
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {l10n.t("AgentX ${version} is the latest version.", {
                    version: __APP_VERSION__,
                  })}
                </p>
              </div>
              <button
                onClick={() => dispatch(closeUpdateDialog())}
                className={cn(
                  "w-full px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                  "bg-foreground/10 text-foreground hover:bg-foreground/15",
                )}
              >
                {l10n.t("OK")}
              </button>
            </>
          )}

          {/* Update available */}
          {state === "available" && (
            <>
              <DownloadIcon className="w-6 h-6 text-blue-500" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-foreground">
                  {l10n.t("A new version is available")}
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {l10n.t("AgentX ${newVersion} is available (you have ${currentVersion}).", {
                    newVersion: version ?? "",
                    currentVersion: __APP_VERSION__,
                  })}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => dispatch(closeUpdateDialog())}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  {l10n.t("Later")}
                </button>
                <button
                  onClick={() => dispatch(downloadUpdate())}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    "bg-blue-600 text-white hover:bg-blue-700",
                  )}
                >
                  {l10n.t("Download")}
                </button>
              </div>
            </>
          )}

          {/* Downloading */}
          {state === "downloading" && (
            <>
              <RefreshCwIcon className="w-5 h-5 text-blue-500 animate-spin" />
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-foreground">{l10n.t("Downloading update...")}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {progress ? `${progress.percent.toFixed(0)}%` : ""}
                  </span>
                </div>
                {progress && (
                  <>
                    <div className="w-full h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                      </span>
                      <span>{formatSpeed(progress.bytesPerSecond)}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Downloaded - ready to install */}
          {state === "downloaded" && (
            <>
              <CheckCircle2Icon className="w-6 h-6 text-emerald-500" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-foreground">
                  {l10n.t("Update ready to install")}
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {l10n.t(
                    "AgentX ${version} has been downloaded. Restart now to complete the update.",
                    { version: version ?? "" },
                  )}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => dispatch(closeUpdateDialog())}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  {l10n.t("Later")}
                </button>
                <button
                  onClick={() => dispatch(installUpdate())}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  {l10n.t("Restart & Update")}
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {state === "error" && (
            <>
              <AlertCircleIcon className="w-6 h-6 text-red-500" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-foreground">
                  {l10n.t("Update check failed")}
                </p>
                {error && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-all">{error}</p>
                )}
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => dispatch(closeUpdateDialog())}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  {l10n.t("Close")}
                </button>
                <button
                  onClick={() => dispatch(checkForUpdates())}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors inline-flex items-center justify-center gap-1",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  <RotateCcwIcon className="w-3 h-3" />
                  {l10n.t("Retry")}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
