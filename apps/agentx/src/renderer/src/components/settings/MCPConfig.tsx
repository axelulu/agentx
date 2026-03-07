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
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";

export function MCPConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const mcpServers = useSelector((state: RootState) => state.settings.mcpServers);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load data when this panel mounts
  useEffect(() => {
    dispatch(loadMCPServers());
  }, [dispatch]);

  const handleAdd = (transport: "stdio" | "sse") => {
    const config: MCPServerConfig = {
      id: uuidv4(),
      name: transport === "stdio" ? "New Stdio Server" : "New SSE Server",
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

  const handleRemove = (id: string) => {
    dispatch(deleteMCPServer(id));
    if (expandedId === id) setExpandedId(null);
  };

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      {mcpServers.length > 0 && (
        <div className="space-y-2 mb-4">
          {mcpServers.map((server) => {
            const isOpen = expandedId === server.id;
            return (
              <div key={server.id} className="rounded-lg border border-border overflow-hidden">
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => toggle(server.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      server.enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
                    )}
                  />
                  <span className="text-[13px] text-foreground flex-1 truncate">
                    {server.name || l10n.t("Untitled")}
                  </span>
                  <span className="text-[11px] text-muted-foreground/40 font-mono mr-1">
                    {server.transport}
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
                        value={server.name}
                        onChange={(e) => handleSave({ ...server, name: e.target.value })}
                        placeholder={l10n.t("Server name")}
                        className="h-8 text-[13px] rounded-md"
                      />
                    </FieldRow>

                    {server.transport === "stdio" && (
                      <>
                        <FieldRow label={l10n.t("Command")}>
                          <InputBox
                            value={server.command ?? ""}
                            onChange={(e) => handleSave({ ...server, command: e.target.value })}
                            placeholder="npx"
                            className="h-8 text-[13px] rounded-md"
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
                            className="h-8 text-[13px] rounded-md"
                          />
                        </FieldRow>
                      </>
                    )}

                    {server.transport === "sse" && (
                      <FieldRow label="URL">
                        <InputBox
                          value={server.url ?? ""}
                          onChange={(e) => handleSave({ ...server, url: e.target.value })}
                          placeholder="http://localhost:3001/sse"
                          className="h-8 text-[13px] rounded-md"
                        />
                      </FieldRow>
                    )}

                    {/* Environment variables */}
                    <EnvEditor
                      env={server.env ?? {}}
                      onChange={(env) => handleSave({ ...server, env })}
                    />

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={(e) => handleSave({ ...server, enabled: e.target.checked })}
                          className="rounded border-border"
                        />
                        <span className="text-[12px] text-muted-foreground">
                          {l10n.t("Enabled")}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemove(server.id)}
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
          onClick={() => handleAdd("stdio")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Stdio
        </button>
        <button
          type="button"
          onClick={() => handleAdd("sse")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          SSE
        </button>
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
    onChange(rest);
  };

  const handleAdd = () => {
    // Use a temp key to avoid overwriting existing empty key
    let newKey = "";
    let counter = 0;
    while (newKey in env) {
      counter++;
      newKey = `KEY_${counter}`;
    }
    onChange({ ...env, [newKey]: "" });
  };

  return (
    <div className="flex items-start gap-4">
      <label className="w-16 shrink-0 text-[12px] text-muted-foreground/60 text-right pt-2">
        {l10n.t("Env")}
      </label>
      <div className="flex-1 space-y-1.5">
        {entries.map(([key, value], idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <InputBox
              value={key}
              onChange={(e) => handleKeyChange(key, e.target.value)}
              placeholder="KEY"
              className="h-7 text-[12px] rounded-md w-28 font-mono"
            />
            <span className="text-[12px] text-muted-foreground/40">=</span>
            <InputBox
              value={value}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="value"
              className="h-7 text-[12px] rounded-md flex-1 font-mono"
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
