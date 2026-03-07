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
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { ChevronDownIcon, PlusIcon, FileTextIcon, TypeIcon } from "lucide-react";

export function KnowledgeBaseConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const knowledgeBase = useSelector((state: RootState) => state.settings.knowledgeBase);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load data when this panel mounts
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

  const handleRemove = (id: string) => {
    dispatch(deleteKBItem(id));
    if (expandedId === id) setExpandedId(null);
  };

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      {knowledgeBase.length > 0 && (
        <div className="space-y-2 mb-4">
          {knowledgeBase.map((item) => {
            const isOpen = expandedId === item.id;
            return (
              <div key={item.id} className="rounded-lg border border-border overflow-hidden">
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      item.enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
                    )}
                  />
                  {item.type === "file" ? (
                    <FileTextIcon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  ) : (
                    <TypeIcon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="text-[13px] text-foreground flex-1 truncate">
                    {item.name || l10n.t("Untitled")}
                  </span>
                  <span className="text-[12px] text-muted-foreground/40 mr-1">
                    {item.type === "file" ? l10n.t("File") : l10n.t("Text")}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-150 shrink-0",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-2.5">
                    <FieldRow label={l10n.t("Name")}>
                      <InputBox
                        value={item.name}
                        onChange={(e) => handleSave({ ...item, name: e.target.value })}
                        placeholder={l10n.t("Entry name")}
                        className="h-8 text-[13px] rounded-md"
                      />
                    </FieldRow>

                    {item.type === "file" && (
                      <FieldRow label={l10n.t("Path")}>
                        <span className="text-[13px] text-muted-foreground truncate block py-1">
                          {item.filePath}
                        </span>
                      </FieldRow>
                    )}

                    {item.type === "text" && (
                      <FieldRow label={l10n.t("Content")}>
                        <textarea
                          value={item.content ?? ""}
                          onChange={(e) => handleSave({ ...item, content: e.target.value })}
                          placeholder={l10n.t("Enter text content...")}
                          rows={4}
                          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-ring resize-y"
                        />
                      </FieldRow>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => handleSave({ ...item, enabled: e.target.checked })}
                          className="rounded border-border"
                        />
                        <span className="text-[12px] text-muted-foreground">
                          {l10n.t("Enabled")}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="text-[12px] text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        {l10n.t("Remove")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddFile}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {l10n.t("Add File")}
        </button>
        <button
          type="button"
          onClick={handleAddText}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {l10n.t("Add Text")}
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <label className="w-16 shrink-0 text-[12px] text-muted-foreground/60 text-right pt-2">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}
