import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CodeIcon,
  LanguagesIcon,
  FileTextIcon,
  TagIcon,
  SearchIcon,
  WrenchIcon,
  BugIcon,
  PenIcon,
  ImageIcon,
  LinkIcon,
  XIcon,
  ArrowRightIcon,
  SparklesIcon,
} from "lucide-react";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

interface DropActionPanelProps {
  detection: DropContentDetection | null;
  droppedContent: DroppedContent | null;
  onAction: (action: DropAction, content: DroppedContent) => void;
  onDismiss: () => void;
}

export interface DroppedContent {
  type: "files" | "text" | "url" | "code" | "html";
  text?: string;
  html?: string;
  filePaths?: string[];
}

function getActionConfig(): Record<string, { icon: typeof CodeIcon; label: string }> {
  return {
    explain: { icon: CodeIcon, label: l10n.t("Explain") },
    optimize: { icon: WrenchIcon, label: l10n.t("Optimize") },
    review: { icon: SearchIcon, label: l10n.t("Review") },
    debug: { icon: BugIcon, label: l10n.t("Debug") },
    convert: { icon: ArrowRightIcon, label: l10n.t("Convert") },
    describe: { icon: ImageIcon, label: l10n.t("Describe") },
    edit: { icon: PenIcon, label: l10n.t("Edit") },
    analyze: { icon: SparklesIcon, label: l10n.t("Analyze") },
    tag: { icon: TagIcon, label: l10n.t("Smart Tag") },
    summarize: { icon: FileTextIcon, label: l10n.t("Summarize") },
    translate: { icon: LanguagesIcon, label: l10n.t("Translate") },
    rewrite: { icon: PenIcon, label: l10n.t("Rewrite") },
    expand: { icon: SparklesIcon, label: l10n.t("Expand") },
    fetch: { icon: LinkIcon, label: l10n.t("Fetch") },
    bookmark: { icon: TagIcon, label: l10n.t("Bookmark") },
    extract_text: { icon: FileTextIcon, label: l10n.t("Extract Text") },
  };
}

function getTypeLabels(): Record<string, string> {
  return {
    files: l10n.t("Files"),
    url: "URL",
    code: l10n.t("Code"),
    text: l10n.t("Text"),
    html: "HTML",
  };
}

export function DropActionPanel({
  detection,
  droppedContent,
  onAction,
  onDismiss,
}: DropActionPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (detection && droppedContent) {
      setIsVisible(true);
    }
  }, [detection, droppedContent]);

  const handleAction = useCallback(
    (action: DropAction) => {
      if (!droppedContent) return;
      setIsVisible(false);
      setTimeout(() => onAction(action, droppedContent), 200);
    },
    [droppedContent, onAction],
  );

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  if (!detection || !droppedContent) return null;

  const typeLabels = getTypeLabels();
  const actionConfig = getActionConfig();
  const contentLabel = typeLabels[detection.contentType] ?? detection.contentType;
  const infoDetails: string[] = [];
  if (detection.info.fileCount) {
    infoDetails.push(l10n.t("${count} file(s)", { count: detection.info.fileCount }));
  }
  if (detection.info.wordCount) {
    infoDetails.push(l10n.t("${count} words", { count: detection.info.wordCount }));
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="mb-2"
        >
          <div className="bg-card/80 backdrop-blur-sm border border-border/40 rounded-lg shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground/60">
                  {contentLabel}
                  {infoDetails.length > 0 && (
                    <span className="ml-1 text-muted-foreground/40">
                      · {infoDetails.join(", ")}
                    </span>
                  )}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDismiss}
                    className="p-0.5 rounded hover:bg-foreground/[0.05] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{l10n.t("Dismiss")}</TooltipContent>
              </Tooltip>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-1 px-2.5 pb-2">
              {detection.actions.map((action) => {
                const cfg = actionConfig[action];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]",
                      "bg-foreground/[0.06] hover:bg-foreground/[0.12] transition-colors",
                      "text-foreground/70 hover:text-foreground/90",
                    )}
                  >
                    <Icon className="w-3 h-3 opacity-70" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Preview snippet */}
            {droppedContent.text && (
              <div className="px-2.5 pb-2">
                <div className="text-[10px] text-muted-foreground/40 line-clamp-2 font-mono bg-foreground/[0.02] rounded px-2 py-1">
                  {droppedContent.text.slice(0, 200)}
                  {droppedContent.text.length > 200 && "…"}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
