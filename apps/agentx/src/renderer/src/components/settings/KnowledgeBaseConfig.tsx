import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadKnowledgeBase,
  upsertKBItem,
  deleteKBItem,
  type KnowledgeBaseItem,
} from "@/slices/settingsSlice";
import { l10n } from "@workspace/l10n";
import { InputBox } from "@/components/ui/InputBox";
import { v4 as uuidv4 } from "uuid";
import { FileTextIcon, TypeIcon } from "lucide-react";
import { AccordionSection, AccordionCard, FieldRow, ToggleSwitch } from "./SettingsAccordion";

export function KnowledgeBaseConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const knowledgeBase = useSelector((state: RootState) => state.settings.knowledgeBase);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadKnowledgeBase());
  }, [dispatch]);

  const handleAddFile = async () => {
    try {
      const paths = await window.api.fs.selectFile();
      if (!paths || paths.length === 0) return;
      const filePath = paths[0];
      const name = filePath.split("/").pop() ?? filePath;
      const item: KnowledgeBaseItem = {
        id: uuidv4(),
        name,
        type: "file",
        filePath,
        enabled: true,
        createdAt: Date.now(),
      };
      dispatch(upsertKBItem(item));
      setExpandedId(item.id);
    } catch (err) {
      console.error("[KB] Failed to add file:", err);
    }
  };

  const handleAddText = () => {
    const item: KnowledgeBaseItem = {
      id: uuidv4(),
      name: "",
      type: "text",
      content: "",
      enabled: true,
      createdAt: Date.now(),
    };
    dispatch(upsertKBItem(item));
    setExpandedId(item.id);
  };

  const handleSave = (item: KnowledgeBaseItem) => {
    dispatch(upsertKBItem(item));
  };

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <AccordionSection
      hasItems={knowledgeBase.length > 0}
      emptyMessage={l10n.t("No knowledge base entries")}
      addActions={[
        { label: l10n.t("Add File"), onClick: handleAddFile },
        { label: l10n.t("Add Text"), onClick: handleAddText },
      ]}
    >
      {knowledgeBase.map((item) => (
        <AccordionCard
          key={item.id}
          expanded={expandedId === item.id}
          onToggle={() => toggle(item.id)}
          onRemove={() => {
            dispatch(deleteKBItem(item.id));
            if (expandedId === item.id) setExpandedId(null);
          }}
          title={item.name || l10n.t("Untitled")}
          subtitle={item.type === "file" ? l10n.t("File") : l10n.t("Text")}
          enabled={item.enabled}
          titlePrefix={
            item.type === "file" ? (
              <FileTextIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            ) : (
              <TypeIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            )
          }
        >
          <FieldRow label={l10n.t("Name")}>
            <InputBox
              value={item.name}
              onChange={(e) => handleSave({ ...item, name: e.target.value })}
              placeholder={l10n.t("Entry name")}
              className="h-7 text-[12px] rounded-md bg-secondary"
            />
          </FieldRow>

          {item.type === "file" && (
            <FieldRow label={l10n.t("Path")}>
              <span className="text-[12px] text-muted-foreground truncate block py-1">
                {item.filePath}
              </span>
            </FieldRow>
          )}

          {item.type === "text" && (
            <FieldRow label={l10n.t("Content")} align="start">
              <textarea
                value={item.content ?? ""}
                onChange={(e) => handleSave({ ...item, content: e.target.value })}
                placeholder={l10n.t("Enter text content...")}
                rows={4}
                className="w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            </FieldRow>
          )}

          <FieldRow label={l10n.t("Enabled")}>
            <ToggleSwitch
              checked={item.enabled}
              onChange={(v) => handleSave({ ...item, enabled: v })}
            />
          </FieldRow>
        </AccordionCard>
      ))}
    </AccordionSection>
  );
}
