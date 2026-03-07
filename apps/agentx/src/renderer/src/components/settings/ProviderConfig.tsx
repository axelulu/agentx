import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  saveProvider,
  removeProvider,
  setActiveProvider,
  type ProviderConfig as ProviderConfigType,
} from "@/slices/settingsSlice";
import { l10n } from "@workspace/l10n";
import { InputBox } from "@/components/ui/InputBox";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { ChevronDownIcon, PlusIcon } from "lucide-react";

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

export function ProviderConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const providers = useSelector((state: RootState) => state.settings.providers);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = (type: "openai" | "custom") => {
    const config: ProviderConfigType = {
      id: uuidv4(),
      name: type === "openai" ? "OpenAI" : "Custom",
      type,
      apiKey: "",
      defaultModel: type === "openai" ? "gpt-4o" : "",
      isActive: providers.length === 0,
    };
    dispatch(saveProvider(config));
    setExpandedId(config.id);
  };

  const handleSave = (config: ProviderConfigType) => {
    dispatch(saveProvider(config));
  };

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      {/* Provider list */}
      {providers.length > 0 && (
        <div className="space-y-2 mb-4">
          {providers.map((provider) => {
            const isOpen = expandedId === provider.id;
            return (
              <div key={provider.id} className="rounded-lg border border-border overflow-hidden">
                {/* Row */}
                <button
                  onClick={() => toggle(provider.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
                >
                  {provider.isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <span className="text-[13px] text-foreground flex-1 truncate">
                    {provider.name}
                  </span>
                  <span className="text-[12px] text-muted-foreground/40 mr-1">
                    {provider.defaultModel || "—"}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-150 shrink-0",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* Detail */}
                {isOpen && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-2.5">
                    <FieldRow label={l10n.t("API Key")}>
                      <InputBox
                        type="password"
                        value={provider.apiKey}
                        onChange={(e) => handleSave({ ...provider, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="h-8 text-[13px] rounded-md"
                      />
                    </FieldRow>

                    {provider.type === "openai" && (
                      <FieldRow label={l10n.t("Model")}>
                        <select
                          value={provider.defaultModel ?? "gpt-4o"}
                          onChange={(e) =>
                            handleSave({ ...provider, defaultModel: e.target.value })
                          }
                          className="w-full h-8 rounded-md border border-border bg-transparent px-2.5 text-[13px] outline-none focus:ring-1 focus:ring-ring"
                        >
                          {OPENAI_MODELS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </FieldRow>
                    )}

                    {provider.type === "custom" && (
                      <>
                        <FieldRow label={l10n.t("Base URL")}>
                          <InputBox
                            value={provider.baseUrl ?? ""}
                            onChange={(e) => handleSave({ ...provider, baseUrl: e.target.value })}
                            placeholder="https://api.example.com/v1"
                            className="h-8 text-[13px] rounded-md"
                          />
                        </FieldRow>
                        <FieldRow label={l10n.t("Model")}>
                          <InputBox
                            value={provider.defaultModel ?? ""}
                            onChange={(e) =>
                              handleSave({ ...provider, defaultModel: e.target.value })
                            }
                            placeholder={l10n.t("e.g. gpt-4o")}
                            className="h-8 text-[13px] rounded-md"
                          />
                        </FieldRow>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        {!provider.isActive && provider.apiKey && (
                          <button
                            onClick={() => dispatch(setActiveProvider(provider.id))}
                            className="text-[12px] font-medium text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-foreground/[0.05] transition-colors"
                          >
                            {l10n.t("Set Active")}
                          </button>
                        )}
                        {provider.isActive && (
                          <span className="text-[12px] text-emerald-500 font-medium">
                            {l10n.t("Active")}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          dispatch(removeProvider(provider.id));
                          setExpandedId(null);
                        }}
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

      {/* Add */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAdd("openai")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          OpenAI
        </button>
        <button
          onClick={() => handleAdd("custom")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {l10n.t("Custom (OpenAI Compatible)")}
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-16 shrink-0 text-[12px] text-muted-foreground/60 text-right">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}
