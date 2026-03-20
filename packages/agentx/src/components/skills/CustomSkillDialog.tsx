import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/slices/store";
import {
  addInstalledSkill,
  updateInstalledSkill,
  type SkillDefinition,
} from "@/slices/settingsSlice";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@agentx/l10n";
import { v4 as uuidv4 } from "uuid";
import { XIcon } from "lucide-react";

const CATEGORIES = [
  "Coding",
  "Writing",
  "Analysis",
  "Productivity",
  "Creative",
  "Marketing",
  "Education",
  "Other",
];

interface CustomSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, dialog enters edit mode for this skill */
  editSkill?: SkillDefinition | null;
}

export function CustomSkillDialog({ open, onOpenChange, editSkill }: CustomSkillDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  const isEdit = !!editSkill;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Other");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Populate form when editing
  useEffect(() => {
    if (editSkill) {
      setTitle(editSkill.title);
      setDescription(editSkill.description);
      setContent(editSkill.content);
      setCategory(editSkill.category || "Other");
      setTags(editSkill.tags || []);
      setTagInput("");
    } else {
      resetForm();
    }
  }, [editSkill, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setContent("");
    setCategory("Other");
    setTags([]);
    setTagInput("");
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;

    const skill: SkillDefinition = {
      id: editSkill?.id || uuidv4(),
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      category,
      tags,
      author: editSkill?.author || "Custom",
      voteCount: editSkill?.voteCount || 0,
      isCustom: true,
    };

    if (isEdit) {
      dispatch(updateInstalledSkill(skill));
    } else {
      dispatch(addInstalledSkill(skill));
    }

    onOpenChange(false);
    resetForm();
  };

  const canSave = title.trim().length > 0 && content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? l10n.t("Edit Skill") : l10n.t("Create Custom Skill")}
        maxWidth="2xl"
        className="h-[min(640px,85vh)] flex flex-col"
      >
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              {l10n.t("Title")}
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={l10n.t("e.g. Code Reviewer, SQL Expert...")}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              {l10n.t("Description")}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={l10n.t("Brief description of what this skill does")}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Content (system prompt / instructions) */}
          <div className="flex-1 flex flex-col">
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              {l10n.t("Skill Content")}
              <span className="text-destructive ml-0.5">*</span>
              <span className="text-muted-foreground font-normal ml-1.5">
                ({l10n.t("Markdown supported")})
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={l10n.t(
                "Write the skill instructions, system prompt, or documentation here...",
              )}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring resize-none min-h-[180px] font-mono leading-relaxed"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              {l10n.t("Category")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    category === cat
                      ? "bg-foreground text-background"
                      : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  }`}
                >
                  {l10n.t(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[12px] font-medium text-foreground mb-1.5">
              {l10n.t("Tags")}
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-foreground/[0.06] text-[11px] text-muted-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-foreground transition-colors"
                  >
                    <XIcon className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder={l10n.t("Type a tag and press Enter")}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/30">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {l10n.t("Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEdit ? l10n.t("Save Changes") : l10n.t("Create Skill")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
