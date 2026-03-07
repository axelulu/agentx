import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { setProviderConfig } from "@/slices/settingsSlice";
import { InputBox } from "@/components/ui/InputBox";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-20250514",
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: [],
  },
];

export function ProviderConfig() {
  const dispatch = useDispatch();
  const providers = useSelector(
    (state: RootState) => state.settings.providers
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        AI Providers
      </h3>

      {PROVIDERS.map((provider) => {
        const config = providers[provider.id];
        if (!config) return null;

        return (
          <div
            key={provider.id}
            className={cn(
              "border border-border rounded-xl p-4 space-y-3 transition-colors",
              config.enabled ? "border-primary/30 bg-primary/5" : ""
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{provider.name}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) =>
                    dispatch(
                      setProviderConfig({
                        provider: provider.id,
                        config: { enabled: e.target.checked },
                      })
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            {config.enabled && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    API Key
                  </label>
                  <InputBox
                    type="password"
                    value={config.apiKey}
                    onChange={(e) =>
                      dispatch(
                        setProviderConfig({
                          provider: provider.id,
                          config: { apiKey: e.target.value },
                        })
                      )
                    }
                    placeholder={`Enter ${provider.name} API key`}
                  />
                </div>

                {provider.models.length > 0 && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Model
                    </label>
                    <select
                      value={config.selectedModel}
                      onChange={(e) =>
                        dispatch(
                          setProviderConfig({
                            provider: provider.id,
                            config: { selectedModel: e.target.value },
                          })
                        )
                      }
                      className="w-full h-9 rounded-lg border border-border bg-transparent px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                    >
                      {provider.models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {provider.id === "openrouter" && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Model ID
                    </label>
                    <InputBox
                      value={config.selectedModel}
                      onChange={(e) =>
                        dispatch(
                          setProviderConfig({
                            provider: provider.id,
                            config: { selectedModel: e.target.value },
                          })
                        )
                      }
                      placeholder="e.g. anthropic/claude-3.5-sonnet"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
