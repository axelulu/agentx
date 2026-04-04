/**
 * Data hook for the Dynamic Island — manages agent state without Redux.
 * Uses window.api bridge directly (standalone window pattern).
 */
import { useState, useEffect, useRef, useCallback } from "react";

export interface IslandAgent {
  conversationId: string;
  title: string;
  startedAt: number;
  status: "thinking" | "tool" | "streaming" | "waiting_approval" | "idle";
  currentTool?: string;
  currentToolArgs?: Record<string, unknown>;
  pendingApproval?: {
    approvalId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
  /** Accumulated streaming content from message_delta events */
  streamingContent?: string;
}

export interface IslandState {
  agents: IslandAgent[];
  hasApprovalPending: boolean;
}

interface AgentEvent {
  type: string;
  conversationId?: string;
  toolCallId?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  approvalId?: string;
  delta?: string;
  content?: string;
  error?: string;
  [key: string]: unknown;
}

export function useIslandData(): IslandState {
  const [agents, setAgents] = useState<IslandAgent[]>([]);
  const agentsRef = useRef<IslandAgent[]>([]);

  // Keep ref in sync
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const upsertAgent = useCallback(
    (convId: string, updater: (existing?: IslandAgent) => IslandAgent) => {
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.conversationId === convId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = updater(updated[idx]);
          return updated;
        }
        return [...prev, updater(undefined)];
      });
    },
    [],
  );

  const removeAgent = useCallback((convId: string) => {
    setAgents((prev) => prev.filter((a) => a.conversationId !== convId));
  }, []);

  // Fetch initial running conversations
  const fetchRunning = useCallback(async () => {
    try {
      const rawRunning = (await window.api.agent.runningConversations()) as unknown;
      // API returns string[] (conversation IDs), not objects
      const runningRaw = Array.isArray(rawRunning) ? rawRunning : [];
      const runningIds = new Set(
        runningRaw.map((r: unknown) => (typeof r === "string" ? r : (r as { id?: string })?.id)),
      );
      // Remove undefined entries
      runningIds.delete(undefined as unknown as string);

      setAgents((prev) => {
        // Keep existing agents that are still running (preserves accumulated streamingContent)
        const kept = prev.filter((a) => runningIds.has(a.conversationId));
        // Add newly discovered running conversations
        const existingIds = new Set(prev.map((a) => a.conversationId));
        const newAgents = [...runningIds]
          .filter((id) => !existingIds.has(id))
          .map((id) => ({
            conversationId: id,
            title: "Agent",
            startedAt: Date.now(),
            status: "thinking" as const,
          }));
        return [...kept, ...newAgents];
      });
    } catch {
      // Sidecar not ready yet — ignore
    }
  }, []);

  // Subscribe to agent events
  useEffect(() => {
    fetchRunning();

    const cleanup = window.api.agent.onEvent((event: unknown) => {
      const e = event as AgentEvent;
      const convId = e.conversationId;
      if (!convId) return;

      switch (e.type) {
        case "agent_start":
        case "turn_start":
          upsertAgent(convId, (existing) => ({
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: "thinking",
          }));
          break;

        case "tool_start":
          upsertAgent(convId, (existing) => ({
            ...(existing || {
              conversationId: convId,
              title: "Agent",
              startedAt: Date.now(),
            }),
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: "tool",
            currentTool: e.toolName,
            currentToolArgs: e.arguments,
          }));
          break;

        case "tool_end":
          upsertAgent(convId, (existing) => ({
            ...(existing || {
              conversationId: convId,
              title: "Agent",
              startedAt: Date.now(),
            }),
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: "thinking",
            currentTool: undefined,
            currentToolArgs: undefined,
          }));
          break;

        case "tool_approval_request":
          upsertAgent(convId, (existing) => ({
            ...(existing || {
              conversationId: convId,
              title: "Agent",
              startedAt: Date.now(),
            }),
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: "waiting_approval",
            pendingApproval: {
              approvalId: e.approvalId!,
              toolName: e.toolName!,
              arguments: e.arguments || {},
            },
          }));
          break;

        case "message_start":
          upsertAgent(convId, (existing) => ({
            ...(existing || {
              conversationId: convId,
              title: "Agent",
              startedAt: Date.now(),
            }),
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: existing?.status || "thinking",
            streamingContent: "",
          }));
          break;

        case "message_delta":
          upsertAgent(convId, (existing) => ({
            ...(existing || {
              conversationId: convId,
              title: "Agent",
              startedAt: Date.now(),
            }),
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: "streaming",
            currentTool: undefined,
            currentToolArgs: undefined,
            pendingApproval: existing?.pendingApproval,
            streamingContent: (existing?.streamingContent || "") + (e.delta || ""),
          }));
          break;

        case "message_end":
          upsertAgent(convId, (existing) => ({
            ...(existing || {
              conversationId: convId,
              title: "Agent",
              startedAt: Date.now(),
            }),
            conversationId: convId,
            title: existing?.title || "Agent",
            startedAt: existing?.startedAt || Date.now(),
            status: existing?.status || "thinking",
            streamingContent: e.content || existing?.streamingContent || "",
          }));
          break;

        case "agent_end":
        case "turn_end":
          removeAgent(convId);
          break;

        case "error":
          removeAgent(convId);
          break;
      }
    });

    // Poll as fallback sync (same pattern as MenuBarPanel)
    const interval = setInterval(fetchRunning, 5000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [fetchRunning, upsertAgent, removeAgent]);

  return {
    agents,
    hasApprovalPending: agents.some((a) => a.status === "waiting_approval"),
  };
}
