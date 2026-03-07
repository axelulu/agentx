import { useTheme } from "@/hooks/useTheme";
import { toggleSidebar, toggleSettings } from "@/slices/uiSlice";
import {
  PanelLeftIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";
import { useDispatch } from "react-redux";

export function TitleBar() {
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="flex items-center h-12 px-4 border-b border-border select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS traffic light space */}
      <div className="w-16 shrink-0" />

      <div
        className="flex items-center gap-1 ml-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Toggle Sidebar"
        >
          <PanelLeftIcon className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1" />

      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Toggle Theme"
        >
          {theme === "dark" ? (
            <SunIcon className="w-4 h-4 text-muted-foreground" />
          ) : (
            <MoonIcon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={() => dispatch(toggleSettings())}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
