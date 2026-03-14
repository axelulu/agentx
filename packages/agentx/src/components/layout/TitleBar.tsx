import { toggleSidebar } from "@/slices/uiSlice";
import { l10n } from "@agentx/l10n";
import { PanelLeftIcon } from "lucide-react";
import { useDispatch } from "react-redux";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { AppLogo } from "@/components/ui/AppLogo";

export function TitleBar() {
  const dispatch = useDispatch();

  return (
    <div
      className="flex items-center h-11 px-4 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS traffic light space */}
      <div className="w-16 shrink-0" />

      <div
        className="flex items-center gap-1.5 ml-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <AppLogo size={20} className="shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
            >
              <PanelLeftIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{l10n.t("Toggle Sidebar")}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1" />
    </div>
  );
}
