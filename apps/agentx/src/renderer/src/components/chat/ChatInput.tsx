import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setInputValue, setError } from "@/slices/chatSlice";
import { openSettingsSection } from "@/slices/uiSlice";
import { useAgent } from "@/hooks/useAgent";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { l10n } from "@workspace/l10n";
import type { TokenUsage } from "@/slices/chatSlice";
import {
  ArrowUpIcon,
  SquareIcon,
  PaperclipIcon,
  FileIcon,
  FolderIcon,
  XIcon,
  PlayCircleIcon,
  Music2Icon,
  BookOpenIcon,
  PlugIcon,
  MicIcon,
  Loader2Icon,
} from "lucide-react";
import { getPreviewType, fileUrl } from "@/lib/filePreview";
import { FilePreviewDialog } from "@/components/ui/FilePreviewDialog";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { SkillSelector } from "@/components/skills/SkillSelector";
import { ConversationPromptButton } from "./ConversationPromptBar";

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

export interface ChatInputHandle {
  addFiles: (paths: string[]) => void;
}

export const ChatInput = forwardRef<ChatInputHandle>(function ChatInput(_props, ref) {
  const dispatch = useDispatch<AppDispatch>();
  const { inputValue, isStreaming, error, sessionUsage, conversationUsage } = useSelector(
    (state: RootState) => state.chat,
  );
  const { providers } = useSelector((state: RootState) => state.settings);
  const { sendMessage, abort } = useAgent();
  const {
    isRecording,
    recordingDuration,
    isTranscribing,
    error: voiceError,
    toggleRecording,
    cancelRecording,
  } = useVoiceInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const activeProvider = providers.find((p) => p.isActive);
  const modelLabel = activeProvider?.defaultModel ?? "—";

  const handleMicClick = useCallback(async () => {
    const hasProvider = providers.some(
      (p) => (p.type === "openai" || p.type === "custom") && p.apiKey,
    );
    if (!hasProvider && !isRecording) {
      dispatch(setError(l10n.t("No OpenAI provider for transcription")));
      dispatch(openSettingsSection("providers"));
      return;
    }
    const text = await toggleRecording();
    if (text) {
      dispatch(setInputValue(inputValue ? `${inputValue} ${text}` : text));
      textareaRef.current?.focus();
    }
  }, [providers, isRecording, toggleRecording, dispatch, inputValue]);

  // Auto-focus textarea on mount and when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

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

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles]);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text && attachments.length === 0) return;
    if (isStreaming) return;

    const hasProvider = providers.some((p) => p.apiKey);
    if (!hasProvider) {
      dispatch(setError(l10n.t("Please configure an AI provider first")));
      dispatch(openSettingsSection("providers"));
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
                <AttachmentChip
                  key={file.path}
                  file={file}
                  onRemove={removeAttachment}
                  onPreview={setPreviewPath}
                />
              ))}
            </div>
          )}
          <FilePreviewDialog path={previewPath} onClose={() => setPreviewPath(null)} />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => dispatch(setInputValue(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder={l10n.t("Message AgentX...")}
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-[13px] text-foreground placeholder:text-foreground/35 max-h-[200px] leading-relaxed px-4 pt-3 pb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isStreaming}
          />

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 mx-2.5 mb-1 rounded-md bg-destructive/10 text-destructive text-[12px]">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="font-medium">
                {l10n.t("Recording...")} {Math.floor(recordingDuration / 60)}:
                {String(recordingDuration % 60).padStart(2, "0")}
              </span>
              <button
                onClick={cancelRecording}
                className="ml-auto p-0.5 rounded hover:bg-destructive/20 transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Voice error */}
          {voiceError && (
            <div className="px-3 py-1.5 mx-2.5 mb-1 text-[11px] text-destructive bg-destructive/10 rounded-md">
              {voiceError}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-2.5 pb-2.5">
            <ToolbarButton title={l10n.t("Attach file")} onClick={handleAttachClick}>
              <PaperclipIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              title={l10n.t("Knowledge Base")}
              onClick={() => dispatch(openSettingsSection("knowledgeBase"))}
            >
              <BookOpenIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              title={l10n.t("MCP Servers")}
              onClick={() => dispatch(openSettingsSection("mcp"))}
            >
              <PlugIcon className="w-4 h-4" />
            </ToolbarButton>
            <SkillSelector />
            <ConversationPromptButton />
            <ToolbarButton
              title={isRecording ? l10n.t("Stop recording") : l10n.t("Voice input")}
              onClick={handleMicClick}
            >
              {isTranscribing ? (
                <Loader2Icon className="w-4 h-4 animate-spin" />
              ) : (
                <MicIcon className={cn("w-4 h-4", isRecording && "text-destructive")} />
              )}
            </ToolbarButton>

            {/* Model + token usage */}
            <div className="flex items-center gap-1.5 ml-1 text-[11px] tabular-nums">
              <span className="text-muted-foreground/40">{modelLabel}</span>
              <TokenUsageInline sessionUsage={sessionUsage} conversationUsage={conversationUsage} />
            </div>

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
});

function AttachmentChip({
  file,
  onRemove,
  onPreview,
}: {
  file: AttachedFile;
  onRemove: (path: string) => void;
  onPreview: (path: string) => void;
}) {
  const displayPath = shortenPath(file.path);
  const sizeLabel = file.size > 0 ? formatFileSize(file.size) : null;
  const previewType = file.isDirectory ? null : getPreviewType(file.path);

  const handleClick = () => {
    if (previewType) {
      onPreview(file.path);
    } else {
      window.api.fs.openPath(file.path);
    }
  };

  const ChipIcon =
    previewType === "video"
      ? PlayCircleIcon
      : previewType === "audio"
        ? Music2Icon
        : file.isDirectory
          ? FolderIcon
          : FileIcon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/[0.05] hover:bg-foreground/[0.08] text-[12px] text-foreground/70 max-w-[280px] group transition-colors cursor-pointer"
          onClick={handleClick}
        >
          {previewType === "image" ? (
            <img
              src={fileUrl(file.path)}
              alt=""
              className="w-5 h-5 object-cover rounded shrink-0"
            />
          ) : (
            <ChipIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          )}
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

// ---------------------------------------------------------------------------
// Inline token usage (sits next to the model label in the toolbar)
// ---------------------------------------------------------------------------

function formatTokenCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

function TokenUsageInline({
  sessionUsage,
  conversationUsage,
}: {
  sessionUsage: TokenUsage;
  conversationUsage: TokenUsage;
}) {
  const hasSession = sessionUsage.inputTokens > 0 || sessionUsage.outputTokens > 0;
  if (!hasSession) return null;

  const showTotal =
    conversationUsage.inputTokens !== sessionUsage.inputTokens ||
    conversationUsage.outputTokens !== sessionUsage.outputTokens;

  return (
    <>
      <span className="text-muted-foreground/25">·</span>
      <span className="text-muted-foreground/50">
        {formatTokenCount(sessionUsage.inputTokens)} → {formatTokenCount(sessionUsage.outputTokens)}
      </span>
      {showTotal && (
        <>
          <span className="text-muted-foreground/25">·</span>
          <span className="text-muted-foreground/35">
            {l10n.t("Total")} {formatTokenCount(conversationUsage.inputTokens)} →{" "}
            {formatTokenCount(conversationUsage.outputTokens)}
          </span>
        </>
      )}
    </>
  );
}
