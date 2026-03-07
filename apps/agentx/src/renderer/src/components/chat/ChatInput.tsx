import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setInputValue } from "@/slices/chatSlice";
import { useAgent } from "@/hooks/useAgent";
import { l10n } from "@workspace/l10n";
import { ArrowUpIcon, SquareIcon, PaperclipIcon, GlobeIcon, ImageIcon } from "lucide-react";
import { useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

export function ChatInput() {
  const dispatch = useDispatch<AppDispatch>();
  const { inputValue, isStreaming, error } = useSelector((state: RootState) => state.chat);
  const { providers } = useSelector((state: RootState) => state.settings);
  const { sendMessage, abort } = useAgent();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = providers.find((p) => p.isActive);
  const modelLabel = activeProvider?.defaultModel ?? "—";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    const hasProvider = providers.some((p) => p.apiKey);
    if (!hasProvider) return;

    dispatch(setInputValue(""));
    sendMessage(content);
  }, [inputValue, isStreaming, providers, dispatch, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = inputValue.trim().length > 0;

  return (
    <div className="px-5 py-4">
      {error && (
        <div className="max-w-3xl mx-auto mb-2.5 px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        <div className="border border-foreground/15 rounded-xl overflow-hidden transition-colors bg-card focus-within:border-foreground/30">
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
            <ToolbarButton title={l10n.t("Attach file")}>
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
