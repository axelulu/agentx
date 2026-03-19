import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { removeInstalledSkill } from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { TrashIcon, StarIcon, ExternalLinkIcon } from "lucide-react";
import { SkillStoreDialog } from "@/components/skills/SkillStoreDialog";

export function SkillsConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const installedSkills = useSelector((s: RootState) => s.settings.installedSkills);
  const [storeOpen, setStoreOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          {l10n.t("Manage installed skills and browse the Skill Store.")}
        </p>
        <button
          onClick={() => setStoreOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity shrink-0"
        >
          <ExternalLinkIcon className="w-3.5 h-3.5" />
          {l10n.t("Browse Skill Store")}
        </button>
      </div>

      {installedSkills.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-muted-foreground">
          {l10n.t("No skills installed")}
        </div>
      ) : (
        <div className="space-y-2">
          {installedSkills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{skill.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{skill.description}</p>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                <StarIcon className="w-3 h-3" />
                {skill.voteCount}
              </div>
              <button
                onClick={() => dispatch(removeInstalledSkill(skill.id))}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SkillStoreDialog open={storeOpen} onOpenChange={setStoreOpen} />
    </div>
  );
}
