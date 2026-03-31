import type { AgentRuntime, KnowledgeBaseItem } from "@agentx/runtime";
import { CollectionStore, type NotifyFn } from "../stores";
import { registerCollectionHandlers, type HandlerMap } from "./register-handlers";

export function createKBStore(
  filePath: string,
  notify: NotifyFn,
  runtime: AgentRuntime,
): CollectionStore<KnowledgeBaseItem> {
  return new CollectionStore<KnowledgeBaseItem>(filePath, notify, "kb", (items) => {
    runtime.setKnowledgeBase(items);
  });
}

export function registerKBHandlers(
  handlers: HandlerMap,
  store: CollectionStore<KnowledgeBaseItem>,
): void {
  registerCollectionHandlers(handlers, "kb", store);
}
