import { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { toggleSkill } from "@/slices/chatSlice";
import { l10n } from "@agentx/l10n";
import { ZapIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkillStoreDialog } from "./SkillStoreDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { Popover } from "@/components/ui/Popover";

export function SkillSelector() {
  const dispatch = useDispatch<AppDispatch>();
  const installedSkills = useSelector((s: RootState) => s.settings.installedSkills);
  const enabledSkills = useSelector((s: RootState) => s.chat.enabledSkills);
  const currentConversationId = useSelector((s: RootState) => s.chat.currentConversationId);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeCount = enabledSkills.length;

  const handleToggle = (id: string) => {
    dispatch(toggleSkill(id));
    if (currentConversationId) {
      const next = enabledSkills.includes(id)
        ? enabledSkills.filter((s) => s !== id)
        : [...enabledSkills, id];
      window.api.skills.setEnabled(currentConversationId, next).catch(console.error);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={() => setPopoverOpen(!popoverOpen)}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground/60 hover:text-muted-foreground/90 hover:bg-foreground/[0.05] transition-colors relative"
          >
            <ZapIcon className={cn("w-4 h-4", activeCount > 0 && "text-foreground")} />
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-foreground text-[9px] font-bold text-background flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{l10n.t("Skills")}</TooltipContent>
      </Tooltip>

      <Popover
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        anchorRef={buttonRef}
        placement="top-start"
        className="w-64"
      >
        <div className="px-3 py-2 border-b border-border">
          <span className="text-[12px] font-semibold text-foreground">
            {l10n.t("Skills")}
            {activeCount > 0 && (
              <span className="text-muted-foreground font-normal ml-1">
                ({activeCount} {l10n.t("Active").toLowerCase()})
              </span>
            )}
          </span>
        </div>

        <div className="max-h-[200px] overflow-y-auto">
          {installedSkills.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
              {l10n.t("No skills installed")}
            </div>
          ) : (
            installedSkills.map((skill) => {
              const enabled = enabledSkills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  onClick={() => handleToggle(skill.id)}
                  disabled={!currentConversationId}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-accent/50 transition-colors disabled:opacity-50",
                    enabled && "bg-accent/30",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      enabled ? "bg-foreground border-foreground" : "border-foreground/20",
                    )}
                  >
                    {enabled && (
                      <svg className="w-2.5 h-2.5 text-background" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="truncate text-foreground">{skill.title}</span>
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={() => {
            setPopoverOpen(false);
            setStoreOpen(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 border-t border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {l10n.t("Browse Skill Store")}
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </Popover>

      <SkillStoreDialog open={storeOpen} onOpenChange={setStoreOpen} />
    </>
  );
}
