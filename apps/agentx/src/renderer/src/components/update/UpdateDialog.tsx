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

  // Don't allow closing during download
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
      <DialogContent title={l10n.t("Software Update")} showCloseButton={canClose} maxWidth="sm">
        <div className="flex flex-col items-center gap-4 py-2">
          {/* Checking */}
          {state === "checking" && (
            <>
              <LoaderIcon className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm text-muted-foreground">{l10n.t("Checking for updates...")}</p>
            </>
          )}

          {/* Up to date */}
          {state === "not-available" && (
            <>
              <CheckCircle2Icon className="w-10 h-10 text-emerald-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{l10n.t("You're up to date")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {l10n.t("AgentX ${version} is the latest version.", {
                    version: __APP_VERSION__,
                  })}
                </p>
              </div>
              <button
                onClick={() => dispatch(closeUpdateDialog())}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full",
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
              <DownloadIcon className="w-10 h-10 text-blue-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {l10n.t("A new version is available")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {l10n.t("AgentX {{newVersion}} is available (you have {{currentVersion}}).", {
                    newVersion: version ?? "",
                    currentVersion: __APP_VERSION__,
                  })}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => dispatch(closeUpdateDialog())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  {l10n.t("Later")}
                </button>
                <button
                  onClick={() => dispatch(downloadUpdate())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
              <RefreshCwIcon className="w-10 h-10 text-blue-500 animate-spin" />
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{l10n.t("Downloading update...")}</p>
                  <span className="text-xs text-muted-foreground">
                    {progress ? `${progress.percent.toFixed(0)}%` : ""}
                  </span>
                </div>
                {progress && (
                  <>
                    <div className="w-full h-2 rounded-full bg-foreground/10 overflow-hidden">
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
              <CheckCircle2Icon className="w-10 h-10 text-emerald-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {l10n.t("Update ready to install")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {l10n.t(
                    "AgentX {{version}} has been downloaded. Restart now to complete the update.",
                    { version: version ?? "" },
                  )}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => dispatch(closeUpdateDialog())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  {l10n.t("Later")}
                </button>
                <button
                  onClick={() => dispatch(installUpdate())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
              <AlertCircleIcon className="w-10 h-10 text-red-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {l10n.t("Update check failed")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => dispatch(closeUpdateDialog())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  {l10n.t("Close")}
                </button>
                <button
                  onClick={() => dispatch(checkForUpdates())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5",
                    "bg-foreground/10 text-foreground hover:bg-foreground/15",
                  )}
                >
                  <RotateCcwIcon className="w-3.5 h-3.5" />
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
