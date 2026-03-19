import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadMCPServers,
  upsertMCPServer,
  deleteMCPServer,
  type MCPServerConfig,
} from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { InputBox } from "@/components/ui/InputBox";
import { v4 as uuidv4 } from "uuid";
import { PlusIcon, XIcon, RefreshCwIcon } from "lucide-react";
import { AccordionSection, AccordionCard, FieldRow, ToggleSwitch } from "./SettingsAccordion";

function StatusDot({ status }: { status: MCPServerState["status"] }) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
        ? "bg-yellow-500 animate-pulse"
        : status === "error"
          ? "bg-red-500"
          : "bg-foreground/[0.12]";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function MCPConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const mcpServers = useSelector((state: RootState) => state.settings.mcpServers);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [serverStates, setServerStates] = useState<MCPServerState[]>([]);

  useEffect(() => {
    dispatch(loadMCPServers());
    // Load initial status
    window.api.mcp
      .status()
      .then(setServerStates)
      .catch(() => {});
  }, [dispatch]);

  // Subscribe to live status updates
  useEffect(() => {
    const unsub = window.api.mcp.onStatusUpdate((states) => {
      setServerStates(states);
    });
    return unsub;
  }, []);

  const getServerState = useCallback(
    (id: string) => serverStates.find((s) => s.id === id),
    [serverStates],
  );

  const handleReconnect = useCallback(() => {
    window.api.mcp.reconnect().catch(() => {});
  }, []);

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
    <AccordionSection
      hasItems={mcpServers.length > 0}
      emptyMessage={l10n.t("No MCP servers configured")}
      addActions={[
        { label: l10n.t("Stdio"), onClick: () => handleAdd("stdio") },
        { label: l10n.t("SSE"), onClick: () => handleAdd("sse") },
      ]}
    >
      {mcpServers.map((server) => {
        const state = getServerState(server.id);
        return (
          <AccordionCard
            key={server.id}
            expanded={expandedId === server.id}
            onToggle={() => toggle(server.id)}
            onRemove={() => {
              dispatch(deleteMCPServer(server.id));
              if (expandedId === server.id) setExpandedId(null);
            }}
            title={server.name || l10n.t("Untitled")}
            subtitle={
              <span className="inline-flex items-center gap-1.5">
                {state && <StatusDot status={state.status} />}
                {server.transport}
                {state?.status === "connected" && (
                  <span className="text-muted-foreground/50">
                    ({state.toolCount} {state.toolCount === 1 ? "tool" : "tools"})
                  </span>
                )}
              </span>
            }
            enabled={server.enabled}
          >
            {/* Connection status banner */}
            {state?.status === "error" && state.error && (
              <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md bg-destructive/10 text-destructive text-[11px]">
                <span className="flex-1 truncate">{state.error}</span>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] hover:underline"
                >
                  <RefreshCwIcon className="w-3 h-3" />
                  {l10n.t("Reconnect")}
                </button>
              </div>
            )}

            <FieldRow label={l10n.t("Name")}>
              <InputBox
                value={server.name}
                onChange={(e) => handleSave({ ...server, name: e.target.value })}
                placeholder={l10n.t("Server name")}
                className="h-7 text-[12px] rounded-md bg-background"
              />
            </FieldRow>

            {server.transport === "stdio" && (
              <>
                <FieldRow label={l10n.t("Command")}>
                  <InputBox
                    value={server.command ?? ""}
                    onChange={(e) => handleSave({ ...server, command: e.target.value })}
                    placeholder="npx"
                    className="h-7 text-[12px] rounded-md bg-background"
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
                    className="h-7 text-[12px] rounded-md bg-background"
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
                  className="h-7 text-[12px] rounded-md bg-background"
                />
              </FieldRow>
            )}

            <EnvEditor env={server.env ?? {}} onChange={(env) => handleSave({ ...server, env })} />

            <FieldRow label={l10n.t("Enabled")}>
              <ToggleSwitch
                checked={server.enabled}
                onChange={(v) => handleSave({ ...server, enabled: v })}
              />
            </FieldRow>
          </AccordionCard>
        );
      })}
    </AccordionSection>
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
      <label className="w-14 shrink-0 text-[11px] text-muted-foreground/70 text-right pt-2">
        {l10n.t("Env")}
      </label>
      <div className="flex-1 space-y-1.5">
        {entries.map(([key, value], idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <InputBox
              value={key}
              onChange={(e) => handleKeyChange(key, e.target.value)}
              placeholder="KEY"
              className="h-7 text-[11px] rounded-md w-28 font-mono bg-background"
            />
            <span className="text-[11px] text-muted-foreground/50">=</span>
            <InputBox
              value={value}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="value"
              className="h-7 text-[11px] rounded-md flex-1 font-mono bg-background"
            />
            <button
              type="button"
              onClick={() => handleRemove(key)}
              className="p-1 text-muted-foreground/40 hover:text-muted-foreground hover:bg-background rounded transition-colors"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          {l10n.t("Add Variable")}
        </button>
      </div>
    </div>
  );
}
