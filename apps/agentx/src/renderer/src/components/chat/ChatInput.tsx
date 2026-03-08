import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setInputValue, setError } from "@/slices/chatSlice";
import { setSettingsOpen } from "@/slices/uiSlice";
import { useAgent } from "@/hooks/useAgent";
import { l10n } from "@workspace/l10n";
import {
  ArrowUpIcon,
  SquareIcon,
  PaperclipIcon,
  GlobeIcon,
  ImageIcon,
  FileIcon,
  FolderIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useEffect,
  useState,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

interface AttachedFile {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Shorten a path for display: ~/Dev/project/src/foo.ts → ~/…/src/foo.ts */
function shortenPath(fullPath: string): string {
  const home = fullPath.startsWith("/Users/") ? fullPath.replace(/^\/Users\/[^/]+/, "~") : fullPath;
  const parts = home.split("/");
  if (parts.length <= 3) return home;
  return `${parts[0]}/…/${parts.slice(-2).join("/")}`;
}

const MAX_ATTACHMENTS = 10;

export function ChatInput() {
  const dispatch = useDispatch<AppDispatch>();
  const { inputValue, isStreaming, error } = useSelector((state: RootState) => state.chat);
  const { providers } = useSelector((state: RootState) => state.settings);
  const { sendMessage, abort } = useAgent();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const activeProvider = providers.find((p) => p.isActive);
  const modelLabel = activeProvider?.defaultModel ?? "—";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const addFiles = useCallback(async (paths: string[]) => {
    setAttachments((prev) => {
      const existing = new Set(prev.map((a) => a.path));
      const merged = [...prev];
      for (const filePath of paths) {
        if (merged.length >= MAX_ATTACHMENTS) break;
        if (existing.has(filePath)) continue;
        existing.add(filePath);
        const name = filePath.split("/").pop() ?? filePath;
        // stat is async — push a placeholder and resolve below
        merged.push({ path: filePath, name, size: 0, isDirectory: false });
      }
      return merged.slice(0, MAX_ATTACHMENTS);
    });

    // Resolve stat info for newly added files asynchronously
    for (const filePath of paths) {
      const info = await window.api.fs.stat(filePath);
      if (!info) continue;
      setAttachments((prev) =>
        prev.map((a) =>
          a.path === filePath ? { ...a, size: info.size, isDirectory: info.isDirectory } : a,
        ),
      );
    }
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text && attachments.length === 0) return;
    if (isStreaming) return;

    const hasProvider = providers.some((p) => p.apiKey);
    if (!hasProvider) {
      dispatch(setError(l10n.t("Please configure an AI provider first")));
      dispatch(setSettingsOpen(true));
      return;
    }

    let content = text;
    if (attachments.length > 0) {
      const fileList = attachments.map((a) => `- ${a.path}${a.isDirectory ? "/" : ""}`).join("\n");
      content = content
        ? `${content}\n\n[Attached files]\n${fileList}`
        : `[Attached files]\n${fileList}`;
    }

    dispatch(setInputValue(""));
    setAttachments([]);
    sendMessage(content);
  }, [inputValue, attachments, isStreaming, providers, dispatch, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Paths were already extracted by the preload's capture-phase drop listener
    // using webUtils.getPathForFile() on the original (non-cloned) File objects.
    const paths = window.api.fs.getDroppedPaths();
    if (paths.length > 0) await addFiles(paths);
  };

  const handleAttachClick = async () => {
    const paths = await window.api.fs.selectFile({ multi: true });
    if (paths && paths.length > 0) await addFiles(paths);
  };

  const canSend = inputValue.trim().length > 0 || attachments.length > 0;

  return (
    <div className="px-5 py-4">
      {error && (
        <div className="max-w-3xl mx-auto mb-2.5 px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border rounded-xl overflow-hidden transition-colors bg-card focus-within:border-foreground/30",
            isDragOver ? "border-foreground/40 bg-foreground/[0.03]" : "border-foreground/15",
          )}
        >
          {/* Drop overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-foreground/30 bg-foreground/[0.05]">
              <span className="text-sm text-muted-foreground font-medium">
                {l10n.t("Drop files here")}
              </span>
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {attachments.map((file) => (
                <AttachmentChip key={file.path} file={file} onRemove={removeAttachment} />
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => dispatch(setInputValue(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder={l10n.t("Message AgentX...")}
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-[13px] text-foreground placeholder:text-foreground/35 max-h-[200px] leading-relaxed px-4 pt-3 pb-2"
            disabled={isStreaming}
          />

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-2.5 pb-2.5">
            <ToolbarButton title={l10n.t("Attach file")} onClick={handleAttachClick}>
              <PaperclipIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title={l10n.t("Web search")}>
              <GlobeIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title={l10n.t("Generate image")}>
              <ImageIcon className="w-4 h-4" />
            </ToolbarButton>

            {/* Model label */}
            <span className="ml-1 text-[11px] text-muted-foreground/40 truncate max-w-[120px]">
              {modelLabel}
            </span>

            <div className="flex-1" />

            {/* Send / Stop */}
            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={abort}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                  >
                    <SquareIcon className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{l10n.t("Stop")}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
                      canSend
                        ? "bg-foreground text-background hover:opacity-90"
                        : "bg-foreground/10 text-muted-foreground/30",
                    )}
                  >
                    <ArrowUpIcon className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{l10n.t("Send")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: AttachedFile;
  onRemove: (path: string) => void;
}) {
  const Icon = file.isDirectory ? FolderIcon : FileIcon;
  const displayPath = shortenPath(file.path);
  const sizeLabel = file.size > 0 ? formatFileSize(file.size) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/[0.05] hover:bg-foreground/[0.08] text-[12px] text-foreground/70 max-w-[280px] group transition-colors">
          <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{file.name}</span>
          {sizeLabel && <span className="shrink-0 text-muted-foreground/50">{sizeLabel}</span>}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(file.path);
            }}
            className="shrink-0 ml-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <span className="font-mono text-[11px] break-all">{displayPath}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  const btn = (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
    >
      {children}
    </button>
  );

  if (!title) return btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
