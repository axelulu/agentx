import { toggleSidebar } from "@/slices/uiSlice";
import { l10n } from "@agentx/l10n";
import { PanelLeftIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { AppLogo } from "@/components/ui/AppLogo";
import { ExportMenu } from "@/components/chat/ExportMenu";

export function TitleBar() {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen);

  return (
    <div
      className="flex items-center h-10 px-4 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Traffic light spacer — only needed when sidebar is closed */}
      {!sidebarOpen && <div className="w-16 shrink-0" />}

      <div
        className="flex items-center gap-1.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <AppLogo size={20} className="shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
            >
              <PanelLeftIcon className="w-4 h-4 text-foreground/80" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{l10n.t("Toggle Sidebar")}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1" />

      {/* Right side actions */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <ExportMenu />
      </div>
    </div>
  );
}
