import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TagIcon,
  SparklesIcon,
  XIcon,
  Loader2Icon,
  CheckIcon,
  PlusIcon,
  FileIcon,
} from "lucide-react";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

interface FileTagsPanelProps {
  filePaths: string[];
  onClose: () => void;
  onTagApplied?: (path: string, tags: string[]) => void;
}

interface FileTagState {
  path: string;
  name: string;
  tags: string[];
  comment: string;
  analysis: FileAnalysisResult | null;
  status: "idle" | "analyzing" | "done" | "error";
  error?: string;
}

const FINDER_TAG_COLORS: Record<string, string> = {
  Red: "bg-red-500",
  Orange: "bg-orange-500",
  Yellow: "bg-yellow-500",
  Green: "bg-green-500",
  Blue: "bg-blue-500",
  Purple: "bg-purple-500",
  Gray: "bg-gray-500",
};

export function FileTagsPanel({ filePaths, onClose, onTagApplied }: FileTagsPanelProps) {
  const [files, setFiles] = useState<FileTagState[]>(() =>
    filePaths.map((path) => ({
      path,
      name: path.split("/").pop() ?? path,
      tags: [],
      comment: "",
      analysis: null,
      status: "idle",
    })),
  );
  const [newTag, setNewTag] = useState("");
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);

  const loadExistingTags = useCallback(async (path: string) => {
    const info = await window.api.fileTags.get(path);
    setFiles((prev) =>
      prev.map((f) =>
        f.path === path
          ? { ...f, tags: info.tags, comment: info.comment, analysis: info.agentxAnalysis }
          : f,
      ),
    );
  }, []);

  const analyzeFile = useCallback(
    async (path: string) => {
      setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, status: "analyzing" } : f)));

      try {
        const result = await window.api.fileTags.analyze(path);
        setFiles((prev) =>
          prev.map((f) =>
            f.path === path
              ? {
                  ...f,
                  status: "done",
                  analysis: result,
                  tags: result.tags ?? f.tags,
                  comment: result.summary ?? f.comment,
                }
              : f,
          ),
        );
        onTagApplied?.(path, result.tags ?? []);
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) => (f.path === path ? { ...f, status: "error", error: String(err) } : f)),
        );
      }
    },
    [onTagApplied],
  );

  const analyzeAll = useCallback(async () => {
    setIsAnalyzingAll(true);
    for (const file of files) {
      if (file.status !== "done") {
        await analyzeFile(file.path);
      }
    }
    setIsAnalyzingAll(false);
  }, [files, analyzeFile]);

  const addTagToFile = useCallback(
    async (path: string, tag: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.path === path && !f.tags.includes(tag) ? { ...f, tags: [...f.tags, tag] } : f,
        ),
      );
      const file = files.find((f) => f.path === path);
      if (file) {
        const updatedTags = file.tags.includes(tag) ? file.tags : [...file.tags, tag];
        await window.api.fileTags.set(path, updatedTags);
        onTagApplied?.(path, updatedTags);
      }
    },
    [files, onTagApplied],
  );

  const removeTagFromFile = useCallback(
    async (path: string, tag: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f)),
      );
      const file = files.find((f) => f.path === path);
      if (file) {
        const updatedTags = file.tags.filter((t) => t !== tag);
        await window.api.fileTags.set(path, updatedTags);
      }
    },
    [files],
  );

  const handleAddNewTag = useCallback(
    (path: string) => {
      if (newTag.trim()) {
        addTagToFile(path, newTag.trim());
        setNewTag("");
      }
    },
    [newTag, addTagToFile],
  );

  // Load existing tags on mount
  useEffect(() => {
    filePaths.forEach(loadExistingTags);
  }, [filePaths, loadExistingTags]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="border border-border/50 rounded-xl bg-card shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
          <div className="flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-foreground/60" />
            <span className="text-sm font-medium text-foreground/80">
              {l10n.t("Smart File Tags")}
            </span>
            <span className="text-xs text-muted-foreground/50">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={analyzeAll}
              disabled={isAnalyzingAll}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                isAnalyzingAll
                  ? "bg-foreground/[0.05] text-muted-foreground/50"
                  : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.1]",
              )}
            >
              {isAnalyzingAll ? (
                <Loader2Icon className="w-3 h-3 animate-spin" />
              ) : (
                <SparklesIcon className="w-3 h-3" />
              )}
              {l10n.t("Analyze All")}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-foreground/[0.05] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{l10n.t("Close")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* File list */}
        <div className="max-h-[300px] overflow-y-auto">
          {files.map((file) => (
            <div key={file.path} className="px-4 py-3 border-b border-border/20 last:border-b-0">
              {/* File name + status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="text-xs font-medium text-foreground/70 truncate">
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {file.status === "analyzing" && (
                    <Loader2Icon className="w-3 h-3 animate-spin text-foreground/40" />
                  )}
                  {file.status === "done" && <CheckIcon className="w-3 h-3 text-green-500" />}
                  {file.status === "idle" && (
                    <button
                      onClick={() => analyzeFile(file.path)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-foreground/[0.05] hover:bg-foreground/[0.08] text-foreground/60 transition-colors"
                    >
                      <SparklesIcon className="w-3 h-3" />
                      {l10n.t("Analyze")}
                    </button>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-1.5">
                {file.tags.map((tag) => {
                  const colorClass = FINDER_TAG_COLORS[tag];
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-foreground/[0.06] text-foreground/70"
                    >
                      {colorClass && <span className={cn("w-2 h-2 rounded-full", colorClass)} />}
                      {tag}
                      <button
                        onClick={() => removeTagFromFile(file.path, tag)}
                        className="ml-0.5 text-muted-foreground/40 hover:text-foreground/60"
                      >
                        <XIcon className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
                {/* Add tag input */}
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewTag(file.path);
                      }
                    }}
                    placeholder={l10n.t("Add tag...")}
                    className="w-16 px-1.5 py-0.5 text-[11px] bg-transparent border-b border-border/30 focus:border-foreground/30 outline-none text-foreground/60 placeholder:text-muted-foreground/30"
                  />
                  <button
                    onClick={() => handleAddNewTag(file.path)}
                    className="text-muted-foreground/30 hover:text-foreground/50"
                  >
                    <PlusIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* AI summary */}
              {file.analysis?.summary && (
                <p className="text-[11px] text-muted-foreground/60 mt-1 line-clamp-2">
                  {file.analysis.summary}
                </p>
              )}

              {/* Error */}
              {file.error && <p className="text-[11px] text-destructive mt-1">{file.error}</p>}
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
