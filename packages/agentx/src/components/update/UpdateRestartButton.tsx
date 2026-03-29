import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { installUpdate } from "@/slices/updateSlice";
import { l10n } from "@agentx/l10n";
import { ArrowUpCircleIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

/**
 * Small button shown in the top-left (next to sidebar toggle) when an update
 * has been downloaded and is ready to install. Clicking restarts the app.
 */
export function UpdateRestartButton() {
  const dispatch = useDispatch<AppDispatch>();
  const updateState = useSelector((s: RootState) => s.update.state);
  const version = useSelector((s: RootState) => s.update.version);

  if (updateState !== "downloaded") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => dispatch(installUpdate())}
          className="fixed top-2 left-[104px] z-50 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <ArrowUpCircleIcon className="w-3 h-3" />
          <span>{l10n.t("Restart")}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {version
          ? `${l10n.t("Update to")} v${version} — ${l10n.t("click to restart")}`
          : l10n.t("Update is ready — click to restart")}
      </TooltipContent>
    </Tooltip>
  );
}
