import { useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { removeInstalledSkill, type SkillDefinition } from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import {
  TrashIcon,
  StarIcon,
  ExternalLinkIcon,
  ZapIcon,
  ArrowLeftIcon,
  TagIcon,
  UserIcon,
  PlusIcon,
  PencilIcon,
} from "lucide-react";
import { SkillStoreDialog } from "@/components/skills/SkillStoreDialog";
import { CustomSkillDialog } from "@/components/skills/CustomSkillDialog";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

export function SkillsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const installedSkills = useSelector((s: RootState) => s.settings.installedSkills);
  const [storeOpen, setStoreOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillDefinition | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);
  const [pendingUninstallId, setPendingUninstallId] = useState<string | null>(null);

  // Keep selected skill in sync (it may be uninstalled while viewing)
  const activeSkill = useMemo(() => {
    if (!selectedSkill) return null;
    return installedSkills.find((s) => s.id === selectedSkill.id) ?? null;
  }, [selectedSkill, installedSkills]);

  const handleUninstall = (id: string) => {
    dispatch(removeInstalledSkill(id));
    if (selectedSkill?.id === id) setSelectedSkill(null);
  };

  const confirmDialog = (
    <Dialog
      open={!!pendingUninstallId}
      onOpenChange={(open) => {
        if (!open) setPendingUninstallId(null);
      }}
    >
      <DialogContent maxWidth="sm" showCloseButton={false}>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              {l10n.t("Uninstall Skill")}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              {l10n.t(
                "Are you sure you want to uninstall this skill? This action cannot be undone.",
              )}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setPendingUninstallId(null)}
              className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {l10n.t("Cancel")}
            </button>
            <button
              onClick={() => {
                if (pendingUninstallId) handleUninstall(pendingUninstallId);
                setPendingUninstallId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
            >
              <TrashIcon className="w-3 h-3" />
              {l10n.t("Uninstall")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Detail view
  if (activeSkill) {
    return (
      <>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          <div className="max-w-3xl mx-auto w-full px-4 py-10">
            {/* Back button */}
            <button
              onClick={() => setSelectedSkill(null)}
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              {l10n.t("Back to Skills")}
            </button>

            {/* Skill header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-foreground/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                  <ZapIcon className="w-4.5 h-4.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold text-foreground leading-tight">
                    {activeSkill.title}
                  </h2>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {activeSkill.description}
                  </p>
                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {activeSkill.isCustom && (
                      <span className="px-1.5 py-px rounded text-[10px] font-semibold uppercase tracking-wider bg-accent text-accent-foreground">
                        {l10n.t("Custom")}
                      </span>
                    )}
                    {activeSkill.author && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <UserIcon className="w-3 h-3" />
                        {activeSkill.author}
                      </span>
                    )}
                    {!activeSkill.isCustom && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <StarIcon className="w-3 h-3" />
                        {activeSkill.voteCount}
                      </span>
                    )}
                    {activeSkill.category && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <TagIcon className="w-3 h-3" />
                        {activeSkill.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeSkill.isCustom && (
                  <button
                    onClick={() => {
                      setEditingSkill(activeSkill);
                      setCustomDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-foreground bg-foreground/[0.06] hover:bg-foreground/[0.1] transition-colors"
                  >
                    <PencilIcon className="w-3 h-3" />
                    {l10n.t("Edit")}
                  </button>
                )}
                <button
                  onClick={() => setPendingUninstallId(activeSkill.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
                >
                  <TrashIcon className="w-3 h-3" />
                  {l10n.t("Uninstall")}
                </button>
              </div>
            </div>

            {/* Tags */}
            {activeSkill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {activeSkill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-foreground/[0.04] text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Markdown content */}
            {activeSkill.content ? (
              <div className="border-t border-border pt-6">
                <div className="prose-skill">
                  <MarkdownRenderer content={activeSkill.content} />
                </div>
              </div>
            ) : (
              <div className="border-t border-border pt-6">
                <p className="text-[12px] text-muted-foreground text-center py-8">
                  {l10n.t("No documentation available for this skill.")}
                </p>
              </div>
            )}
          </div>
        </div>
        {confirmDialog}
        <CustomSkillDialog
          open={customDialogOpen}
          onOpenChange={(open) => {
            setCustomDialogOpen(open);
            if (!open) setEditingSkill(null);
          }}
          editSkill={editingSkill}
        />
      </>
    );
  }

  // Grid view
  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
      <div className="max-w-3xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{l10n.t("Skills")}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Extend your agent with installable skills")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingSkill(null);
                setCustomDialogOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1] transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              {l10n.t("Create Skill")}
            </button>
            <button
              onClick={() => setStoreOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <ExternalLinkIcon className="w-3 h-3" />
              {l10n.t("Skill Store")}
            </button>
          </div>
        </div>

        {/* Skill cards */}
        {installedSkills.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center py-16 gap-3">
            <ZapIcon className="w-6 h-6 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">{l10n.t("No skills installed")}</p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => {
                  setEditingSkill(null);
                  setCustomDialogOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1] transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                {l10n.t("Create Skill")}
              </button>
              <button
                onClick={() => setStoreOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                <ExternalLinkIcon className="w-3 h-3" />
                {l10n.t("Browse Skill Store")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {installedSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onClick={() => setSelectedSkill(skill)}
                onUninstall={() => setPendingUninstallId(skill.id)}
              />
            ))}

            {/* Add more card */}
            <button
              onClick={() => setStoreOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border hover:border-border hover:bg-foreground/[0.01] transition-all"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">
                {l10n.t("Browse more")}
              </span>
            </button>
          </div>
        )}
      </div>

      <SkillStoreDialog open={storeOpen} onOpenChange={setStoreOpen} />
      <CustomSkillDialog
        open={customDialogOpen}
        onOpenChange={(open) => {
          setCustomDialogOpen(open);
          if (!open) setEditingSkill(null);
        }}
        editSkill={editingSkill}
      />
      {confirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillCard
// ---------------------------------------------------------------------------

function SkillCard({
  skill,
  onClick,
  onUninstall,
}: {
  skill: SkillDefinition;
  onClick: () => void;
  onUninstall: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border hover:border-border hover:bg-foreground/[0.015] transition-all cursor-pointer"
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-foreground/[0.04] flex items-center justify-center shrink-0">
        <ZapIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground group-hover:text-foreground leading-snug truncate transition-colors">
            {skill.title}
          </p>
          {skill.isCustom ? (
            <span className="shrink-0 px-1.5 py-px rounded text-[9px] font-semibold uppercase tracking-wider bg-accent text-accent-foreground">
              {l10n.t("Custom")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
              <StarIcon className="w-2.5 h-2.5" />
              {skill.voteCount}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate leading-relaxed">
          {skill.description}
        </p>
        {skill.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {skill.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-px rounded bg-foreground/[0.03] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Uninstall button (hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUninstall();
        }}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        <TrashIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
