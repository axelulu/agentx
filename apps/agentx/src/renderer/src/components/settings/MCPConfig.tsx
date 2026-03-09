import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadMCPServers,
  upsertMCPServer,
  deleteMCPServer,
  type MCPServerConfig,
} from "@/slices/settingsSlice";
import { l10n } from "@workspace/l10n";
import { InputBox } from "@/components/ui/InputBox";
import { v4 as uuidv4 } from "uuid";
import { PlusIcon, XIcon } from "lucide-react";
import { AccordionCard, FieldRow, AddButton } from "./SettingsAccordion";

export function MCPConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const mcpServers = useSelector((state: RootState) => state.settings.mcpServers);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadMCPServers());
  }, [dispatch]);

  const handleAdd = (transport: "stdio" | "sse") => {
    const config: MCPServerConfig = {
      id: uuidv4(),
      name: transport === "stdio" ? l10n.t("New Stdio Server") : l10n.t("New SSE Server"),
      transport,
      command: transport === "stdio" ? "" : undefined,
      args: transport === "stdio" ? [] : undefined,
      url: transport === "sse" ? "" : undefined,
      env: {},
      enabled: true,
    };
    dispatch(upsertMCPServer(config));
    setExpandedId(config.id);
  };

  const handleSave = (config: MCPServerConfig) => {
    dispatch(upsertMCPServer(config));
  };

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      {mcpServers.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {mcpServers.map((server) => (
            <AccordionCard
              key={server.id}
              expanded={expandedId === server.id}
              onToggle={() => toggle(server.id)}
              onRemove={() => {
                dispatch(deleteMCPServer(server.id));
                if (expandedId === server.id) setExpandedId(null);
              }}
              title={server.name || l10n.t("Untitled")}
              subtitle={server.transport}
              enabled={server.enabled}
            >
              <FieldRow label={l10n.t("Name")}>
                <InputBox
                  value={server.name}
                  onChange={(e) => handleSave({ ...server, name: e.target.value })}
                  placeholder={l10n.t("Server name")}
                  className="h-7 text-[12px] rounded-md"
                />
              </FieldRow>

              {server.transport === "stdio" && (
                <>
                  <FieldRow label={l10n.t("Command")}>
                    <InputBox
                      value={server.command ?? ""}
                      onChange={(e) => handleSave({ ...server, command: e.target.value })}
                      placeholder="npx"
                      className="h-7 text-[12px] rounded-md"
                    />
                  </FieldRow>
                  <FieldRow label={l10n.t("Args")}>
                    <InputBox
                      value={(server.args ?? []).join(" ")}
                      onChange={(e) =>
                        handleSave({
                          ...server,
                          args: e.target.value ? e.target.value.split(" ") : [],
                        })
                      }
                      placeholder="-y @mcp/server-fs /path"
                      className="h-7 text-[12px] rounded-md"
                    />
                  </FieldRow>
                </>
              )}

              {server.transport === "sse" && (
                <FieldRow label={l10n.t("URL")}>
                  <InputBox
                    value={server.url ?? ""}
                    onChange={(e) => handleSave({ ...server, url: e.target.value })}
                    placeholder="http://localhost:3001/sse"
                    className="h-7 text-[12px] rounded-md"
                  />
                </FieldRow>
              )}

              <EnvEditor
                env={server.env ?? {}}
                onChange={(env) => handleSave({ ...server, env })}
              />

              {/* Enabled toggle */}
              <div className="flex items-center pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(e) => handleSave({ ...server, enabled: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-[11px] text-muted-foreground">{l10n.t("Enabled")}</span>
                </label>
              </div>
            </AccordionCard>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <AddButton label={l10n.t("Stdio")} onClick={() => handleAdd("stdio")} />
        <AddButton label={l10n.t("SSE")} onClick={() => handleAdd("sse")} />
      </div>
    </div>
  );
}

function EnvEditor({
  env,
  onChange,
}: {
  env: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
}) {
  const entries = Object.entries(env);

  const handleKeyChange = (oldKey: string, newKey: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  };

  const handleValueChange = (key: string, value: string) => {
    onChange({ ...env, [key]: value });
  };

  const handleRemove = (key: string) => {
    const { [key]: _, ...rest } = env;
    void _;
    onChange(rest);
  };

  const handleAdd = () => {
    let newKey = "";
    let counter = 0;
    while (newKey in env) {
      counter++;
      newKey = `KEY_${counter}`;
    }
    onChange({ ...env, [newKey]: "" });
  };

  return (
    <div className="flex items-start gap-3">
      <label className="w-14 shrink-0 text-[11px] text-muted-foreground/50 text-right pt-2">
        {l10n.t("Env")}
      </label>
      <div className="flex-1 space-y-1.5">
        {entries.map(([key, value], idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <InputBox
              value={key}
              onChange={(e) => handleKeyChange(key, e.target.value)}
              placeholder="KEY"
              className="h-7 text-[11px] rounded-md w-28 font-mono"
            />
            <span className="text-[11px] text-muted-foreground/40">=</span>
            <InputBox
              value={value}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="value"
              className="h-7 text-[11px] rounded-md flex-1 font-mono"
            />
            <button
              type="button"
              onClick={() => handleRemove(key)}
              className="p-1 text-muted-foreground/30 hover:text-destructive transition-colors"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          {l10n.t("Add Variable")}
        </button>
      </div>
    </div>
  );
}
