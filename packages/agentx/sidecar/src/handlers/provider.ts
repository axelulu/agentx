import type { AgentRuntime, ProviderConfig } from "@agentx/runtime";
import { CollectionStore, type NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function createProviderStore(
  filePath: string,
  notify: NotifyFn,
  runtime: AgentRuntime,
): CollectionStore<ProviderConfig> {
  return new CollectionStore<ProviderConfig>(filePath, notify, "provider", (items) => {
    for (const config of items) {
      runtime.setProviderConfig(config);
    }
  });
}

export function registerProviderHandlers(
  handlers: HandlerMap,
  store: CollectionStore<ProviderConfig>,
  runtime: AgentRuntime,
): void {
  handlers["provider:list"] = () => store.list();
  handlers["provider:set"] = (config: ProviderConfig) => {
    store.set(config);
    runtime.setProviderConfig(config);
  };
  handlers["provider:remove"] = (id: string) => {
    const items = store.list().filter((p) => p.id !== id);
    store.replace(items);
    runtime.removeProvider(id);
  };
  handlers["provider:setActive"] = (id: string) => {
    const configs = store.list();
    for (const p of configs) p.isActive = p.id === id;
    store.replace(configs);
    runtime.setActiveProvider(id);
  };
}
