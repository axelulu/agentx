import { useState, useCallback, useRef, useEffect } from "react";
import type { Message, ToolCallData } from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import { cn } from "@/lib/utils";
import {
  BotIcon,
  WrenchIcon,
  ChevronRightIcon,
  CopyIcon,
  CheckIcon,
  PencilIcon,
  RefreshCwIcon,
  LoaderIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  BanIcon,
  FileTextIcon,
  TerminalIcon,
  FileIcon,
  FilePenIcon,
  FolderIcon,
  PlayCircleIcon,
  Music2Icon,
  Volume2Icon,
  SquareIcon,
  DownloadIcon,
  FileJsonIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolResultRenderer } from "./ToolResultRenderer";
import { getPreviewType, fileUrl } from "@/lib/filePreview";
import { FilePreviewDialog } from "@/components/ui/FilePreviewDialog";
import { exportSingleMessage } from "@/lib/performExport";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  /** Called when user clicks "Edit" on their own message — content goes to input */
  onEdit?: (content: string, filePaths?: string[]) => void;
  /** Called when user clicks "Regenerate" on an assistant message */
  onRegenerate?: (messageId: string) => void;
  /** Whether the agent is currently streaming (hides regenerate) */
  isStreaming?: boolean;
  /** Whether this specific message is the one actively receiving streamed content */
  isActiveStreamingMessage?: boolean;
  /** Whether the previous message is also from the assistant (hide duplicate avatar) */
  isConsecutiveAssistant?: boolean;
  /** TTS — read aloud */
  onSpeak?: (text: string, messageId?: string) => void;
  onStopSpeaking?: () => void;
  speakingMessageId?: string | null;
  /** Whether to animate the entrance of this bubble */
  animate?: boolean;
}

// ---------------------------------------------------------------------------
// Tiny action button (hover-revealed)
// ---------------------------------------------------------------------------

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
        >
          <Icon className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Copy hook — shows check icon briefly after copy
// ---------------------------------------------------------------------------

function useCopy() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return { copied, copy };
}

// ---------------------------------------------------------------------------
// Single message export button with inline dropdown
// ---------------------------------------------------------------------------

function MessageExportButton({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExport = async (format: "markdown" | "json") => {
    setOpen(false);
    try {
      await exportSingleMessage(message, format);
    } catch (err) {
      console.error("[Export] Failed:", err);
    }
  };

  return (
    <div ref={ref} className="relative">
      <ActionButton icon={DownloadIcon} label={l10n.t("Export")} onClick={() => setOpen(!open)} />
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-card shadow-lg py-1">
          <button
            onClick={() => handleExport("markdown")}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <FileTextIcon className="w-3.5 h-3.5 text-muted-foreground" />
            {l10n.t("Export as Markdown")}
          </button>
          <button
            onClick={() => handleExport("json")}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <FileJsonIcon className="w-3.5 h-3.5 text-muted-foreground" />
            {l10n.t("Export as JSON")}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

export function MessageBubble({
  message,
  onEdit,
  onRegenerate,
  isStreaming,
  isActiveStreamingMessage,
  isConsecutiveAssistant,
  onSpeak,
  onStopSpeaking,
  speakingMessageId,
  animate = true,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  if (isTool) {
    return <ToolResultBubble message={message} animate={animate} />;
  }

  if (isUser) {
    return <UserBubble message={message} onEdit={onEdit} animate={animate} />;
  }

  return (
    <AssistantBubble
      message={message}
      onRegenerate={onRegenerate}
      isStreaming={isStreaming}
      isActiveStreamingMessage={isActiveStreamingMessage}
      isConsecutiveAssistant={isConsecutiveAssistant}
      onSpeak={onSpeak}
      onStopSpeaking={onStopSpeaking}
      speakingMessageId={speakingMessageId}
      animate={animate}
    />
  );
}

// ---------------------------------------------------------------------------
// Parse "[Attached files]" block from message content
// ---------------------------------------------------------------------------

function parseAttachments(content: string): {
  text: string;
  files: { path: string; name: string; isDirectory: boolean }[];
} {
  const marker = "[Attached files]\n";
  const idx = content.indexOf(marker);
  if (idx === -1) return { text: content, files: [] };

  const text = content.substring(0, idx).replace(/\n+$/, "");
  const fileSection = content.substring(idx + marker.length);
  const files = fileSection
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const raw = line.substring(2);
      const isDirectory = raw.endsWith("/");
      const path = isDirectory ? raw.slice(0, -1) : raw;
      const name = path.split("/").pop() ?? path;
      return { path, name, isDirectory };
    });

  return { text, files };
}

// ---------------------------------------------------------------------------
// User bubble — right-aligned, actions below-right
// ---------------------------------------------------------------------------

function UserBubble({
  message,
  onEdit,
  animate = true,
}: {
  message: Message;
  onEdit?: (content: string, filePaths?: string[]) => void;
  animate?: boolean;
}) {
  const { copied, copy } = useCopy();
  const { text, files } = parseAttachments(message.content ?? "");
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const handleFileClick = (file: { path: string; isDirectory: boolean }) => {
    const pt = file.isDirectory ? null : getPreviewType(file.path);
    if (pt) {
      setPreviewPath(file.path);
    } else {
      window.api.fs.openPath(file.path);
    }
  };

  const hasAttachments = files.length > 0;

  return (
    <div className={cn("group/msg flex flex-col items-end", animate && "animate-slide-up")}>
      {/* Bubble */}
      <div className="text-[13px] leading-relaxed bg-foreground/[0.05] rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[75%]">
        {/* File chips — all in one horizontal row */}
        {hasAttachments && (
          <div className={cn("flex flex-wrap gap-1.5", text && "mb-2")}>
            {files.map((file) => {
              const pt = file.isDirectory ? null : getPreviewType(file.path);
              const Icon =
                pt === "video"
                  ? PlayCircleIcon
                  : pt === "audio"
                    ? Music2Icon
                    : file.isDirectory
                      ? FolderIcon
                      : FileIcon;
              return (
                <button
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] transition-colors max-w-[200px]"
                >
                  {pt === "image" ? (
                    <img
                      src={fileUrl(file.path)}
                      alt=""
                      className="w-4 h-4 object-cover rounded shrink-0"
                    />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-foreground/80">{file.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {/* Text content */}
        {text && <div className="whitespace-pre-wrap break-words">{text}</div>}
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
        <ActionButton
          icon={copied ? CheckIcon : CopyIcon}
          label={copied ? l10n.t("Copied") : l10n.t("Copy")}
          onClick={() => copy(text || (message.content ?? ""))}
        />
        {onEdit && (
          <ActionButton
            icon={PencilIcon}
            label={l10n.t("Edit")}
            onClick={() =>
              onEdit(
                text || (message.content ?? ""),
                files.length > 0 ? files.map((f) => f.path) : undefined,
              )
            }
          />
        )}
        <MessageExportButton message={message} />
      </div>

      {hasAttachments && (
        <FilePreviewDialog path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant bubble — left-aligned with avatar, actions below content
// ---------------------------------------------------------------------------

function AssistantBubble({
  message,
  onRegenerate,
  isStreaming,
  isActiveStreamingMessage,
  isConsecutiveAssistant,
  onSpeak,
  onStopSpeaking,
  speakingMessageId,
  animate = true,
}: {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  isStreaming?: boolean;
  isActiveStreamingMessage?: boolean;
  isConsecutiveAssistant?: boolean;
  onSpeak?: (text: string, messageId?: string) => void;
  onStopSpeaking?: () => void;
  speakingMessageId?: string | null;
  animate?: boolean;
}) {
  const { copied, copy } = useCopy();
  const hasContent = !!message.content;
  const isSpeakingThis = speakingMessageId === message.id;
  // Only show typing indicator / streaming cursor for the actively streaming message
  const showStreamingUI = isActiveStreamingMessage ?? isStreaming;

  return (
    <div
      className={cn(
        "group/msg flex gap-3",
        animate && !isConsecutiveAssistant && "animate-slide-up",
      )}
    >
      {/* Avatar */}
      <div className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 bg-foreground text-background">
        <BotIcon className="w-3 h-3" />
      </div>

      {/* Content + actions */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Tool call blocks — each rendered as a prominent step */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-2">
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message text (markdown + thinking) */}
        {message.content ? (
          <MarkdownRenderer content={message.content} isStreaming={showStreamingUI} />
        ) : showStreamingUI ? (
          <TypingIndicator />
        ) : null}

        {/* Action buttons — visible on hover, hidden while streaming */}
        {hasContent && (
          <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
            <ActionButton
              icon={copied ? CheckIcon : CopyIcon}
              label={copied ? l10n.t("Copied") : l10n.t("Copy")}
              onClick={() => copy(message.content ?? "")}
            />
            {onSpeak && (
              <ActionButton
                icon={isSpeakingThis ? SquareIcon : Volume2Icon}
                label={isSpeakingThis ? l10n.t("Stop reading") : l10n.t("Read aloud")}
                onClick={() =>
                  isSpeakingThis ? onStopSpeaking?.() : onSpeak(message.content ?? "", message.id)
                }
              />
            )}
            {onRegenerate && !isStreaming && (
              <ActionButton
                icon={RefreshCwIcon}
                label={l10n.t("Regenerate")}
                onClick={() => onRegenerate(message.id)}
              />
            )}
            <MessageExportButton message={message} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typing indicator — three bouncing dots
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool call block — prominent step display within the assistant response
// ---------------------------------------------------------------------------

const TOOL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  file_read: FileTextIcon,
  file_create: FileIcon,
  file_rewrite: FilePenIcon,
  shell_run: TerminalIcon,
  task_complete: CheckCircleIcon,
};

function toolArgsSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "file_read":
    case "file_create":
    case "file_rewrite":
      return String(args.file_path ?? "");
    case "shell_run":
      return String(args.command ?? "");
    case "task_complete":
      return String(args.summary ?? "");
    default: {
      const keys = Object.keys(args);
      if (keys.length === 0) return "";
      return keys.map((k) => `${k}: ${JSON.stringify(args[k])}`).join(", ");
    }
  }
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCallData }) {
  // null = auto (no user interaction yet), true/false = user-controlled
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const ToolIcon = TOOL_ICON_MAP[toolCall.name] ?? WrenchIcon;
  const summary = toolArgsSummary(toolCall.name, toolCall.arguments);
  const isRunning = toolCall.status === "running";
  const isError = toolCall.status === "error";
  const isDone = toolCall.status === "done";
  const isCancelled = toolCall.status === "cancelled";
  const hasResult = !!toolCall.result;
  const resultContent = toolCall.result?.content ?? "";
  const isLongResult = resultContent.length > 300;

  // Resolve effective expanded state:
  //   - User has explicitly toggled → use their choice
  //   - Auto mode → expand short results when done
  const expanded = userExpanded ?? (hasResult && !isLongResult && isDone);

  const handleToggle = () => {
    if (!hasResult) return;
    setUserExpanded(!expanded);
  };

  return (
    <div
      className={cn(
        "rounded-lg border text-xs overflow-hidden",
        isError
          ? "border-destructive/20 bg-destructive/[0.04]"
          : "border-foreground/[0.08] bg-foreground/[0.02]",
      )}
    >
      {/* Header */}
      <div
        role={hasResult ? "button" : undefined}
        tabIndex={hasResult ? 0 : undefined}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (hasResult && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 text-left select-none",
          hasResult && "cursor-pointer hover:bg-foreground/[0.03]",
        )}
      >
        {isRunning ? (
          <LoaderIcon className="w-3 h-3 text-muted-foreground animate-spin shrink-0" />
        ) : isError ? (
          <AlertCircleIcon className="w-3 h-3 text-destructive shrink-0" />
        ) : isCancelled ? (
          <BanIcon className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        ) : (
          <ToolIcon className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium text-foreground">{toolCall.name}</span>
        {summary && (
          <span className="text-muted-foreground truncate flex-1 min-w-0">{summary}</span>
        )}
        {hasResult && (
          <ChevronRightIcon
            className={cn(
              "w-3 h-3 text-muted-foreground/50 shrink-0 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        )}
        {isCancelled && (
          <span className="text-[10px] text-muted-foreground/50 shrink-0">
            {l10n.t("cancelled")}
          </span>
        )}
        {isDone && !isError && !hasResult && (
          <CheckIcon className="w-3 h-3 text-emerald-500 shrink-0" />
        )}
      </div>

      {/* Result (expandable) */}
      {expanded && (
        <div
          className={cn(
            "px-3 pb-2 max-h-64 overflow-auto border-t border-foreground/[0.05]",
            isError ? "text-destructive/80" : "text-muted-foreground/80",
          )}
        >
          <ToolResultRenderer content={resultContent} toolName={toolCall.name} isError={isError} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool result bubble — fallback for standalone tool messages (loaded from old data)
// ---------------------------------------------------------------------------

function ToolResultBubble({ message, animate = true }: { message: Message; animate?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const content = message.content ?? "";
  const isLong = content.length > 200;

  return (
    <div className={cn("flex gap-3", animate && "animate-slide-up")}>
      {/* Avatar */}
      <div className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 bg-foreground text-background">
        <BotIcon className="w-3 h-3" />
      </div>

      <div
        className={cn(
          "rounded-lg px-3 py-2 text-xs max-w-[90%]",
          message.isError
            ? "bg-destructive/[0.06] text-destructive"
            : "bg-foreground/[0.03] text-muted-foreground",
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 font-medium mb-0.5"
        >
          <ChevronRightIcon
            className={cn("w-3 h-3 transition-transform duration-150", expanded && "rotate-90")}
          />
          {l10n.t("Tool result")}
        </button>
        {(expanded || !isLong) && (
          <div className="whitespace-pre-wrap break-words font-mono mt-1 text-[11px] leading-relaxed opacity-80">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
