import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { toggleSkill } from "@/slices/chatSlice";
import { l10n } from "@agentx/l10n";
import { ZapIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkillStoreDialog } from "./SkillStoreDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

const POPOVER_WIDTH = 256; // w-64

export function SkillSelector() {
  const dispatch = useDispatch<AppDispatch>();
  const installedSkills = useSelector((s: RootState) => s.settings.installedSkills);
  const enabledSkills = useSelector((s: RootState) => s.chat.enabledSkills);
  const currentConversationId = useSelector((s: RootState) => s.chat.currentConversationId);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const activeCount = enabledSkills.length;

  // Compute popover position from the button's bounding rect
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Place above the button, left-aligned
    setPosition({
      top: rect.top - 8, // 8px gap (mb-2)
      left: rect.left,
    });
  }, []);

  // Recalculate on open, scroll, resize
  useLayoutEffect(() => {
    if (!popoverOpen) return;
    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [popoverOpen, updatePosition]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  // Close on Escape
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [popoverOpen]);

  const handleToggle = (id: string) => {
    dispatch(toggleSkill(id));
    // Persist to backend
    if (currentConversationId) {
      const next = enabledSkills.includes(id)
        ? enabledSkills.filter((s) => s !== id)
        : [...enabledSkills, id];
      window.api.skills.setEnabled(currentConversationId, next).catch(console.error);
    }
  };

  // Clamp left so the popover doesn't overflow the right edge of the viewport
  const clampedLeft = Math.min(position.left, window.innerWidth - POPOVER_WIDTH - 12);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={() => setPopoverOpen(!popoverOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors relative"
          >
            <ZapIcon className={cn("w-4 h-4", activeCount > 0 && "text-amber-500")} />
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{l10n.t("Skills")}</TooltipContent>
      </Tooltip>

      {popoverOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              transform: `translate(${clampedLeft}px, ${position.top}px) translateY(-100%)`,
            }}
            className="w-64 bg-card border border-border rounded-lg shadow-xl z-[100] overflow-hidden"
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
                          <svg
                            className="w-2.5 h-2.5 text-background"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
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
          </div>,
          document.body,
        )}

      <SkillStoreDialog open={storeOpen} onOpenChange={setStoreOpen} />
    </>
  );
}
