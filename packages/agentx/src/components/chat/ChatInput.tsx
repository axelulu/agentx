import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setInputValue, setError } from "@/slices/chatSlice";
import { openSettingsSection } from "@/slices/uiSlice";
import { useAgent } from "@/hooks/useAgent";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { l10n } from "@agentx/l10n";
import type { TokenUsage } from "@/slices/chatSlice";
import {
  ArrowUpIcon,
  SquareIcon,
  PaperclipIcon,
  FileIcon,
  FolderIcon,
  XIcon,
  ImageIcon,
  PlayCircleIcon,
  Music2Icon,
  BookOpenIcon,
  PlugIcon,
  MicIcon,
  Loader2Icon,
  CameraIcon,
  PlusIcon,
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
  type ClipboardEvent,
} from "react";
import { createPortal } from "react-dom";
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

interface ImageAttachment {
  id: string;
  data: string;
  mimeType: string;
  name: string;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);

function isImageFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

let imageCounter = 0;

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
  const { providers, voice } = useSelector((state: RootState) => state.settings);
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
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const activeProvider = providers.find((p) => p.isActive);
  const modelLabel = activeProvider?.defaultModel ?? "—";

  const handleMicClick = useCallback(async () => {
    const hasDedicatedStt = !!(voice?.sttApiUrl && voice?.sttApiKey);
    const hasProvider = providers.some(
      (p) => (p.type === "openai" || p.type === "custom") && p.apiKey,
    );
    if (!hasDedicatedStt && !hasProvider && !isRecording) {
      dispatch(openSettingsSection("voice"));
      return;
    }
    const text = await toggleRecording();
    if (text) {
      dispatch(setInputValue(inputValue ? `${inputValue} ${text}` : text));
      textareaRef.current?.focus();
    }
  }, [providers, voice, isRecording, toggleRecording, dispatch, inputValue]);

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
    const imagePaths: string[] = [];
    const nonImagePaths: string[] = [];
    for (const p of paths) {
      if (isImageFile(p)) {
        imagePaths.push(p);
      } else {
        nonImagePaths.push(p);
      }
    }

    // Read image files as base64 and add to imageAttachments
    for (const filePath of imagePaths) {
      const result = await window.api.fs.readFileBase64(filePath);
      if (!result) continue;
      const name = filePath.split("/").pop() ?? filePath;
      setImageAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) return prev;
        return [
          ...prev,
          { id: `img_${++imageCounter}`, data: result.data, mimeType: result.mimeType, name },
        ];
      });
    }

    // Non-image files: add to regular attachments
    if (nonImagePaths.length > 0) {
      setAttachments((prev) => {
        const existing = new Set(prev.map((a) => a.path));
        const merged = [...prev];
        for (const filePath of nonImagePaths) {
          if (merged.length >= MAX_ATTACHMENTS) break;
          if (existing.has(filePath)) continue;
          existing.add(filePath);
          const name = filePath.split("/").pop() ?? filePath;
          merged.push({ path: filePath, name, size: 0, isDirectory: false });
        }
        return merged.slice(0, MAX_ATTACHMENTS);
      });

      for (const filePath of nonImagePaths) {
        const info = await window.api.fs.stat(filePath);
        if (!info) continue;
        setAttachments((prev) =>
          prev.map((a) =>
            a.path === filePath ? { ...a, size: info.size, isDirectory: info.isDirectory } : a,
          ),
        );
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles]);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  const removeImageAttachment = useCallback((id: string) => {
    setImageAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
          if (!match) return;
          const mimeType = match[1]!;
          const data = match[2]!;
          const name = `Pasted image ${++imageCounter}`;
          setImageAttachments((prev) => {
            if (prev.length >= MAX_ATTACHMENTS) return prev;
            return [...prev, { id: `img_${imageCounter}`, data, mimeType, name }];
          });
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text && attachments.length === 0 && imageAttachments.length === 0) return;
    if (isStreaming) return;

    const hasProvider = providers.some((p) => p.apiKey);
    if (!hasProvider) {
      dispatch(setError(l10n.t("Please configure an AI provider first")));
      dispatch(openSettingsSection("providers"));
      return;
    }

    // Append non-image file paths as text (existing behavior)
    let textContent = text;
    if (attachments.length > 0) {
      const fileList = attachments.map((a) => `- ${a.path}${a.isDirectory ? "/" : ""}`).join("\n");
      textContent = textContent
        ? `${textContent}\n\n[Attached files]\n${fileList}`
        : `[Attached files]\n${fileList}`;
    }

    dispatch(setInputValue(""));
    setAttachments([]);

    // Build ContentPart[] if images are present
    if (imageAttachments.length > 0) {
      const parts: ContentPart[] = [];
      if (textContent) parts.push({ type: "text", text: textContent });
      for (const img of imageAttachments) {
        parts.push({ type: "image", data: img.data, mimeType: img.mimeType });
      }
      setImageAttachments([]);
      sendMessage(parts);
    } else {
      sendMessage(textContent);
    }
  }, [inputValue, attachments, imageAttachments, isStreaming, providers, dispatch, sendMessage]);

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

  const handleScreenCapture = useCallback(async () => {
    const result = await window.api.screen.capture();
    if (!result) return; // user cancelled
    setImageAttachments((prev) => {
      if (prev.length >= MAX_ATTACHMENTS) return prev;
      return [
        ...prev,
        {
          id: `img_${++imageCounter}`,
          data: result.data,
          mimeType: result.mimeType,
          name: `Screenshot ${new Date().toLocaleTimeString()}`,
        },
      ];
    });
  }, []);

  const canSend =
    inputValue.trim().length > 0 || attachments.length > 0 || imageAttachments.length > 0;

  return (
    <div className="px-5 py-3 pb-5">
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
            "relative border rounded-2xl overflow-hidden transition-all bg-card focus-within:border-foreground/30",
            isDragOver ? "border-foreground/30 bg-foreground/[0.02]" : "border-border",
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
          {(attachments.length > 0 || imageAttachments.length > 0) && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {imageAttachments.map((img) => (
                <ImageAttachmentChip key={img.id} image={img} onRemove={removeImageAttachment} />
              ))}
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
            onPaste={handlePaste}
            placeholder={l10n.t("Message AgentX...")}
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-foreground/35 max-h-[200px] leading-relaxed px-5 pt-3.5 pb-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex items-center gap-1.5 px-3 pb-3">
            <ToolbarButton title={l10n.t("Attach file")} onClick={handleAttachClick}>
              <PaperclipIcon className="w-4 h-4" />
            </ToolbarButton>
            <MoreToolsMenu
              onScreenCapture={handleScreenCapture}
              onKnowledgeBase={() => dispatch(openSettingsSection("knowledgeBase"))}
              onMCP={() => dispatch(openSettingsSection("mcp"))}
              onMic={handleMicClick}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
            />
            <SkillSelector />
            <ConversationPromptButton />

            {/* Model label */}
            <div className="flex items-center gap-1.5 ml-1.5 text-xs tabular-nums">
              <span className="text-muted-foreground/35 font-medium">{modelLabel}</span>
              <TokenUsageInline sessionUsage={sessionUsage} conversationUsage={conversationUsage} />
            </div>

            <div className="flex-1" />

            {/* Send / Stop */}
            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={abort}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all"
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
                      "flex items-center justify-center w-8 h-8 rounded-full transition-all",
                      canSend
                        ? "bg-foreground text-background hover:opacity-90"
                        : "bg-foreground/8 text-muted-foreground/25",
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

function ImageAttachmentChip({
  image,
  onRemove,
}: {
  image: ImageAttachment;
  onRemove: (id: string) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/[0.05] hover:bg-foreground/[0.08] text-[12px] text-foreground/70 max-w-[280px] group transition-colors">
          <img
            src={`data:${image.mimeType};base64,${image.data}`}
            alt=""
            className="w-5 h-5 object-cover rounded shrink-0"
          />
          <span className="truncate font-medium">{image.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(image.id);
            }}
            className="shrink-0 ml-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <img
          src={`data:${image.mimeType};base64,${image.data}`}
          alt={image.name}
          className="max-w-[200px] max-h-[150px] rounded"
        />
      </TooltipContent>
    </Tooltip>
  );
}

function MoreToolsMenu({
  onScreenCapture,
  onKnowledgeBase,
  onMCP,
  onMic,
  isRecording,
  isTranscribing,
}: {
  onScreenCapture: () => void;
  onKnowledgeBase: () => void;
  onMCP: () => void;
  onMic: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Position the menu above the button, adjusting for viewport edges
  useEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const btnRect = btnRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    const vw = window.innerWidth;

    let left = btnRect.left;
    const bottom = window.innerHeight - btnRect.top + 6;

    // Keep within viewport horizontally
    if (left + menu.offsetWidth > vw - 8) {
      left = Math.max(8, vw - menu.offsetWidth - 8);
    }

    menu.style.left = `${left}px`;
    menu.style.bottom = `${bottom}px`;
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors",
          open && "bg-foreground/[0.07] text-foreground",
        )}
      >
        <PlusIcon className="w-4 h-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[180px] rounded-xl border border-border bg-popover shadow-lg py-1.5"
            style={{ left: 0, bottom: 0 }}
          >
            <MenuItemButton
              icon={CameraIcon}
              label={l10n.t("Screenshot")}
              onClick={() => {
                onScreenCapture();
                setOpen(false);
              }}
            />
            <MenuItemButton
              icon={BookOpenIcon}
              label={l10n.t("Knowledge Base")}
              onClick={() => {
                onKnowledgeBase();
                setOpen(false);
              }}
            />
            <MenuItemButton
              icon={PlugIcon}
              label={l10n.t("MCP Servers")}
              onClick={() => {
                onMCP();
                setOpen(false);
              }}
            />
            <MenuItemButton
              icon={isTranscribing ? Loader2Icon : MicIcon}
              label={isRecording ? l10n.t("Stop recording") : l10n.t("Voice input")}
              onClick={() => {
                onMic();
                setOpen(false);
              }}
              iconClassName={cn(
                isRecording && "text-destructive",
                isTranscribing && "animate-spin",
              )}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItemButton({
  icon: Icon,
  label,
  onClick,
  iconClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  iconClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-foreground/80 hover:bg-foreground/[0.05] transition-colors"
    >
      <Icon className={cn("w-4 h-4 text-muted-foreground/70", iconClassName)} />
      {label}
    </button>
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
