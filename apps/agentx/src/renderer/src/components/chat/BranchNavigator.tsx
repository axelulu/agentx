import { ChevronLeft, ChevronRight } from "lucide-react";
import { l10n } from "@workspace/l10n";

interface BranchNavigatorProps {
  siblings: string[];
  activeIndex: number;
  onSwitchBranch: (targetMessageId: string) => void;
}

export function BranchNavigator({ siblings, activeIndex, onSwitchBranch }: BranchNavigatorProps) {
  if (siblings.length <= 1) return null;

  const canGoLeft = activeIndex > 0;
  const canGoRight = activeIndex < siblings.length - 1;

  return (
    <div className="inline-flex items-center gap-0.5 text-xs text-muted-foreground select-none">
      <button
        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-default"
        disabled={!canGoLeft}
        onClick={() => canGoLeft && onSwitchBranch(siblings[activeIndex - 1])}
        aria-label={l10n.t("Previous branch")}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="min-w-[2.5rem] text-center tabular-nums">
        {activeIndex + 1}/{siblings.length}
      </span>
      <button
        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-default"
        disabled={!canGoRight}
        onClick={() => canGoRight && onSwitchBranch(siblings[activeIndex + 1])}
        aria-label={l10n.t("Next branch")}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
