import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@agentx/l10n";
import { ScrollTextIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

/**
 * Toolbar button that opens a dialog for editing the per-conversation system prompt.
 * Placed inside ChatInput toolbar alongside attach, KB, MCP, skills buttons.
 */
export function ConversationPromptButton() {
  const currentConversationId = useSelector((s: RootState) => s.chat.currentConversationId);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasCustom = draft.trim().length > 0;

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
          title={l10n.t("Conversation System Prompt")}
          description={l10n.t(
            "Override for the current conversation only. Leave empty to use the global prompt.",
          )}
          maxWidth="xl"
          className="p-4 gap-3"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            disabled={!loaded}
            placeholder={l10n.t("Enter conversation-specific instructions...")}
            rows={10}
            className={cn(
              "w-full bg-secondary border border-border rounded-md px-3 py-2",
              "text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40",
              "outline-none focus:ring-1 focus:ring-ring focus:border-border",
              "resize-y min-h-[200px] max-h-[60vh]",
              "disabled:opacity-50",
            )}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/50">
              {hasCustom ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground mr-1.5 align-middle" />
                  {l10n.t("Custom")}
                </>
              ) : (
                l10n.t("Using global default")
              )}
            </span>
            {hasCustom && (
              <button
                onClick={() => {
                  setDraft("");
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2Icon className="w-3 h-3" />
                {l10n.t("Clear")}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
