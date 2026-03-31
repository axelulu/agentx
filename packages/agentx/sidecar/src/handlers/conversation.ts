import type { AgentRuntime } from "@agentx/runtime";
import type { NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function registerConversationHandlers(
  handlers: HandlerMap,
  runtime: AgentRuntime,
  notify: NotifyFn,
): void {
  // Conversation CRUD
  handlers["conversation:create"] = (title?: string) => runtime.createConversation(title);
  handlers["conversation:list"] = () => runtime.listConversations();
  handlers["conversation:delete"] = (id: string) => runtime.deleteConversation(id);
  handlers["conversation:messages"] = (id: string) => runtime.getActiveMessages(id);
  handlers["conversation:updateTitle"] = (id: string, title: string) =>
    runtime.updateConversationTitle(id, title);
  handlers["conversation:search"] = (query: string) => runtime.searchConversations(query);
  handlers["conversation:getSystemPrompt"] = (id: string) =>
    runtime.getConversationSystemPrompt(id);
  handlers["conversation:setSystemPrompt"] = (id: string, prompt: string) =>
    runtime.setConversationSystemPrompt(id, prompt);
  handlers["conversation:setFolder"] = (id: string, folderId: string | null) =>
    runtime.setConversationFolder(id, folderId);
  handlers["conversation:setFavorite"] = (id: string, isFavorite: boolean) =>
    runtime.setConversationFavorite(id, isFavorite);
  handlers["conversation:branchInfo"] = (id: string) => runtime.getBranchInfo(id);
  handlers["conversation:switchBranch"] = (id: string, targetMessageId: string) =>
    runtime.switchBranch(id, targetMessageId);

  // Agent
  handlers["agent:send"] = async (conversationId: string, content: string | unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runtime.sendMessage(conversationId, content as any);
  };
  handlers["agent:regenerate"] = (conversationId: string, assistantMessageId: string) =>
    runtime.regenerateMessage(conversationId, assistantMessageId);
  handlers["agent:abort"] = (conversationId: string) => runtime.abort(conversationId);
  handlers["agent:subscribe"] = (conversationId: string) => {
    runtime.subscribe(conversationId, (evt) => {
      notify("agent:event", evt);
    });
  };
  handlers["agent:unsubscribe"] = (conversationId: string) => runtime.unsubscribe(conversationId);
  handlers["agent:status"] = (conversationId?: string) => runtime.getSessionStatus(conversationId);
  handlers["agent:runningConversations"] = () => runtime.getRunningConversations();

  // Memory
  handlers["memory:getConfig"] = () =>
    runtime?.getMemoryConfig() ?? {
      enabled: true,
      maxSummaries: 50,
      maxFacts: 100,
      autoExtract: true,
    };
  handlers["memory:setConfig"] = async (config: unknown) => {
    await runtime?.setMemoryConfig(config as Parameters<typeof runtime.setMemoryConfig>[0]);
  };
  handlers["memory:getSummaries"] = async () => (await runtime?.getMemorySummaries()) ?? [];
  handlers["memory:deleteSummary"] = async (id: string) => {
    await runtime?.deleteMemorySummary(id);
  };
  handlers["memory:getFacts"] = async () => (await runtime?.getMemoryFacts()) ?? [];
  handlers["memory:deleteFact"] = async (id: string) => {
    await runtime?.deleteMemoryFact(id);
  };
  handlers["memory:updateFact"] = async (id: string, content: string) => {
    return await runtime?.updateMemoryFact(id, content);
  };

  // Tool Approval
  handlers["tool:respondApproval"] = (
    conversationId: string,
    approvalId: string,
    approved: boolean,
  ) => {
    try {
      runtime?.resolveToolApproval(conversationId, approvalId, approved);
    } catch (err) {
      console.error("[Sidecar] respondApproval failed:", err);
    }
  };
}
