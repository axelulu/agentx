import type { AgentRuntime, SkillDefinition } from "@agentx/runtime";
import { searchSkills } from "@agentx/runtime";
import { CollectionStore, type NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function createSkillsStore(
  filePath: string,
  notify: NotifyFn,
  runtime: AgentRuntime,
): CollectionStore<SkillDefinition> {
  return new CollectionStore<SkillDefinition>(filePath, notify, "skills", (items) => {
    runtime.setInstalledSkills(items);
  });
}

export function registerSkillsHandlers(
  handlers: HandlerMap,
  store: CollectionStore<SkillDefinition>,
  runtime: AgentRuntime,
): void {
  handlers["skills:search"] = async (query: string, tag?: string, perPage?: number) => {
    return await searchSkills(query, tag, perPage);
  };
  handlers["skills:listInstalled"] = () => store.list();
  handlers["skills:install"] = (skill: SkillDefinition) => {
    store.set(skill);
  };
  handlers["skills:uninstall"] = (id: string) => {
    store.remove(id);
  };
  handlers["skills:getEnabled"] = (conversationId: string) =>
    runtime.getConversationEnabledSkills(conversationId);
  handlers["skills:setEnabled"] = (conversationId: string, skillIds: string[]) =>
    runtime.setConversationEnabledSkills(conversationId, skillIds);
}
