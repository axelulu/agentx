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
import { ChevronDownIcon, PlusIcon, Trash2Icon, CheckIcon } from "lucide-react";

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
        <div className="space-y-1.5 mb-4">
          {providers.map((provider) => {
            const isOpen = expandedId === provider.id;
            return (
              <div
                key={provider.id}
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors",
                  provider.isActive
                    ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                    : "border-border",
                )}
              >
                {/* Row */}
                <button
                  onClick={() => toggle(provider.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/[0.03] transition-colors"
                >
                  <span className="text-[13px] text-foreground flex-1 truncate">
                    {provider.name}
                  </span>
                  {provider.defaultModel && (
                    <span className="text-[11px] text-muted-foreground/50">
                      {provider.defaultModel}
                    </span>
                  )}
                  {provider.isActive && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-medium leading-none">
                      <CheckIcon className="w-2.5 h-2.5" />
                      {l10n.t("Active")}
                    </span>
                  )}
                  <ChevronDownIcon
                    className={cn(
                      "w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-150 shrink-0",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* Detail */}
                {isOpen && (
                  <div className="border-t border-border/50 px-3 pb-3 pt-2.5 space-y-2.5">
                    <FieldRow label={l10n.t("API Key")}>
                      <InputBox
                        type="password"
                        value={provider.apiKey}
                        onChange={(e) => handleSave({ ...provider, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="h-7 text-[12px] rounded-md"
                      />
                    </FieldRow>

                    {provider.type === "openai" && (
                      <FieldRow label={l10n.t("Model")}>
                        <select
                          value={provider.defaultModel ?? "gpt-4o"}
                          onChange={(e) =>
                            handleSave({ ...provider, defaultModel: e.target.value })
                          }
                          className="w-full h-7 rounded-md border border-border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
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
                            className="h-7 text-[12px] rounded-md"
                          />
                        </FieldRow>
                        <FieldRow label={l10n.t("Model")}>
                          <InputBox
                            value={provider.defaultModel ?? ""}
                            onChange={(e) =>
                              handleSave({ ...provider, defaultModel: e.target.value })
                            }
                            placeholder={l10n.t("e.g. gpt-4o")}
                            className="h-7 text-[12px] rounded-md"
                          />
                        </FieldRow>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        {!provider.isActive && provider.apiKey && (
                          <button
                            onClick={() => dispatch(setActiveProvider(provider.id))}
                            className="text-[12px] font-medium text-foreground px-2.5 py-1 rounded-md bg-foreground/[0.06] hover:bg-foreground/[0.1] transition-colors"
                          >
                            {l10n.t("Set Active")}
                          </button>
                        )}
                        {provider.isActive && (
                          <span className="text-[11px] text-emerald-500/70">
                            {l10n.t("Currently active provider")}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          dispatch(removeProvider(provider.id));
                          setExpandedId(null);
                        }}
                        className="p-1.5 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title={l10n.t("Remove")}
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          {l10n.t("OpenAI")}
        </button>
        <button
          onClick={() => handleAdd("custom")}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          {l10n.t("Custom (OpenAI Compatible)")}
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-14 shrink-0 text-[11px] text-muted-foreground/50 text-right">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}
