import { ExportMenu } from "@/components/chat/ExportMenu";

export function TitleBar() {
  return (
    <div
      className="flex items-center h-10 px-4 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
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
