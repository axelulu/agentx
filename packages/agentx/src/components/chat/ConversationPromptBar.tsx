import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@agentx/l10n";
import { ScrollTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

export interface ConversationPromptHandle {
  open: () => void;
}

/**
 * Toolbar button that opens a dialog for editing the per-conversation system prompt.
 * Placed inside ChatInput toolbar alongside attach, KB, MCP, skills buttons.
 */
export const ConversationPromptButton = forwardRef<ConversationPromptHandle>(
  function ConversationPromptButton(_props, ref) {
    const currentConversationId = useSelector((s: RootState) => s.chat.currentConversationId);

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [loaded, setLoaded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const hasCustom = draft.trim().length > 0;

    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

    // Load per-conversation prompt when conversation changes
    useEffect(() => {
      if (!currentConversationId) {
        setDraft("");
        setLoaded(true);
        return;
      }
      setLoaded(false);
      window.api.conversation.getSystemPrompt(currentConversationId).then((prompt: string) => {
        setDraft(prompt ?? "");
        setLoaded(true);
      });
    }, [currentConversationId]);

    // Reload when dialog opens (in case it changed externally)
    useEffect(() => {
      if (open && currentConversationId) {
        window.api.conversation.getSystemPrompt(currentConversationId).then((prompt: string) => {
          setDraft(prompt ?? "");
          setLoaded(true);
        });
      }
    }, [open, currentConversationId]);

    // Focus textarea when opened
    useEffect(() => {
      if (open && loaded) {
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    }, [open, loaded]);

    // Save on close
    const commit = useCallback(() => {
      if (!currentConversationId) return;
      window.api.conversation.setSystemPrompt(currentConversationId, draft.trim());
    }, [currentConversationId, draft]);

    const handleOpenChange = useCallback(
      (next: boolean) => {
        if (!next) commit();
        setOpen(next);
      },
      [commit],
    );

    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground/60 hover:text-muted-foreground/90 hover:bg-foreground/[0.05] transition-colors relative"
            >
              <ScrollTextIcon className={cn("w-4 h-4", hasCustom && "text-foreground")} />
              {hasCustom && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-foreground" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{l10n.t("Conversation system prompt")}</TooltipContent>
        </Tooltip>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            showCloseButton={false}
            maxWidth="xl"
            className="p-0 gap-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-medium text-foreground">
                {l10n.t("System Prompt")}
              </span>
              {hasCustom && (
                <button
                  onClick={() => {
                    setDraft("");
                    textareaRef.current?.focus();
                  }}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  {l10n.t("Clear")}
                </button>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              disabled={!loaded}
              placeholder={l10n.t("Instructions for this conversation...")}
              rows={8}
              className={cn(
                "w-full bg-transparent px-4 py-3",
                "text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/30",
                "outline-none resize-none min-h-[180px] max-h-[50vh]",
                "disabled:opacity-50",
              )}
            />
            <div className="px-4 py-2.5 border-t border-border">
              <span className="text-[11px] text-muted-foreground/40">
                {hasCustom ? l10n.t("Override active") : l10n.t("Using global default")}
              </span>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
