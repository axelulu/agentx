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
import { v4 as uuidv4 } from "uuid";
import { AccordionSection, AccordionCard, FieldRow } from "./SettingsAccordion";

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
    <AccordionSection
      hasItems={providers.length > 0}
      emptyMessage={l10n.t("No AI providers configured")}
      addActions={[
        { label: l10n.t("OpenAI"), onClick: () => handleAdd("openai") },
        { label: l10n.t("Custom (OpenAI Compatible)"), onClick: () => handleAdd("custom") },
      ]}
    >
      {providers.map((provider) => (
        <AccordionCard
          key={provider.id}
          expanded={expandedId === provider.id}
          onToggle={() => toggle(provider.id)}
          onRemove={() => {
            dispatch(removeProvider(provider.id));
            setExpandedId(null);
          }}
          title={provider.name}
          subtitle={provider.defaultModel || undefined}
          active={provider.isActive}
          onActivate={
            !provider.isActive && provider.apiKey
              ? () => dispatch(setActiveProvider(provider.id))
              : undefined
          }
        >
          <FieldRow label={l10n.t("API Key")}>
            <InputBox
              type="password"
              value={provider.apiKey}
              onChange={(e) => handleSave({ ...provider, apiKey: e.target.value })}
              placeholder="sk-..."
              className="h-7 text-[12px] rounded-md bg-secondary"
            />
          </FieldRow>

          {provider.type === "openai" && (
            <FieldRow label={l10n.t("Model")}>
              <select
                value={provider.defaultModel ?? "gpt-4o"}
                onChange={(e) => handleSave({ ...provider, defaultModel: e.target.value })}
                className="w-full h-7 rounded-md border border-border bg-secondary px-2 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-ring"
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
                  className="h-7 text-[12px] rounded-md bg-secondary"
                />
              </FieldRow>
              <FieldRow label={l10n.t("Model")}>
                <InputBox
                  value={provider.defaultModel ?? ""}
                  onChange={(e) => handleSave({ ...provider, defaultModel: e.target.value })}
                  placeholder={l10n.t("e.g. gpt-4o")}
                  className="h-7 text-[12px] rounded-md bg-secondary"
                />
              </FieldRow>
            </>
          )}
        </AccordionCard>
      ))}
    </AccordionSection>
  );
}
