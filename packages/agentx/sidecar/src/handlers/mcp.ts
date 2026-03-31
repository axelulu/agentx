import type { AgentRuntime, MCPServerConfig } from "@agentx/runtime";
import { CollectionStore, type NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function createMCPStore(
  filePath: string,
  notify: NotifyFn,
  runtime: AgentRuntime,
): CollectionStore<MCPServerConfig> {
  return new CollectionStore<MCPServerConfig>(filePath, notify, "mcp", (items) => {
    runtime.setMCPConfigs(items).catch((err) => {
      console.error("[Sidecar/MCP] Failed to apply configs:", err);
    });
  });
}

export function registerMCPHandlers(
  handlers: HandlerMap,
  store: CollectionStore<MCPServerConfig>,
  runtime: AgentRuntime,
): void {
  handlers["mcp:list"] = () => store.list();
  handlers["mcp:set"] = (config: MCPServerConfig) => {
    store.set(config);
  };
  handlers["mcp:remove"] = (id: string) => {
    store.remove(id);
  };
  handlers["mcp:status"] = () => runtime?.getMCPServerStates() ?? [];
  handlers["mcp:reconnect"] = async () => {
    const configs = store.list();
    await runtime?.setMCPConfigs(configs);
  };
}
