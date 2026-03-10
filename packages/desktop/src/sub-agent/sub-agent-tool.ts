/**
 * Sub-agent tools:
 *
 * 1. `sub_agent` — spawn independent agent loops that run in parallel.
 *    Now with agent IDs and enhanced progress reporting.
 *
 * 2. `orchestrate_sub_agents` — coordinate a batch of sub-agents with:
 *    - Shared blackboard for inter-agent communication
 *    - DAG-based dependency ordering (depends_on)
 *    - File conflict detection
 *    - Structured progress visualization
 */

import { randomUUID } from "node:crypto";
import { agentLoop } from "@workspace/agent";
import type {
  AgentTool,
  StreamFn,
  AgentConfig,
  NamedToolHandler,
  ToolInputSchema,
  AgentToolResult,
} from "@workspace/agent";
import { SubAgentOrchestrator } from "./orchestrator.js";
import type { SubAgentTask } from "./types.js";

const SUB_AGENT_SYSTEM_PROMPT = `You are a focused sub-agent executing a specific task. Complete the task thoroughly and return a clear summary of what you accomplished. Be concise but complete. Do not ask follow-up questions — just execute the task with the tools available to you.`;

const MAX_SUB_AGENT_TURNS = 30;
const DEFAULT_SUB_AGENT_TURNS = 10;

export interface SubAgentDeps {
  streamFn: StreamFn;
  model: string;
  /** Parent's tools — should already exclude sub_agent to prevent recursion */
  tools: AgentTool[];
}

// ---------------------------------------------------------------------------
// sub_agent tool (enhanced)
// ---------------------------------------------------------------------------

export function createSubAgentTool(deps: SubAgentDeps): NamedToolHandler {
  return {
    name: "sub_agent",
    description:
      "Spawn an independent sub-agent to handle a self-contained task. Multiple sub_agent calls in the same turn run in parallel. Use this to decompose complex work into concurrent subtasks (e.g., modifying multiple files simultaneously, researching while implementing). Each sub-agent has access to all tools except sub_agent itself.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "A self-contained task description. Must include all necessary context — the sub-agent cannot see the parent conversation.",
        },
        context: {
          type: "string",
          description:
            "Optional additional context such as file contents, prior results, or constraints.",
        },
        max_turns: {
          type: "number",
          description: `Maximum number of agent turns (default: ${DEFAULT_SUB_AGENT_TURNS}, max: ${MAX_SUB_AGENT_TURNS}). Increase for complex multi-step tasks.`,
        },
      },
      required: ["task"],
    } as ToolInputSchema,
    options: {
      category: "parallel" as const,
      timeoutMs: 300_000, // 5 minutes
    },
    async handler(
      args: Record<string, unknown>,
      ctx: { signal: AbortSignal; emitProgress?: (update: string) => void },
    ): Promise<AgentToolResult> {
      const task = args.task as string;
      const context = (args.context as string) ?? "";
      const rawMaxTurns = (args.max_turns as number) ?? DEFAULT_SUB_AGENT_TURNS;
      const maxTurns = Math.min(Math.max(1, Math.round(rawMaxTurns)), MAX_SUB_AGENT_TURNS);
      const agentId = `sub_${randomUUID().slice(0, 6)}`;

      // Build system prompt with task and context
      let systemPrompt =
        SUB_AGENT_SYSTEM_PROMPT + `\n\n## Agent ID\n${agentId}\n\n## Task\n` + task;
      if (context) {
        systemPrompt += "\n\n## Context\n" + context;
      }

      const config: AgentConfig = {
        model: deps.model,
        systemPrompt,
        tools: deps.tools, // already excludes sub_agent
        streamFn: deps.streamFn,
        maxTurns,
      };

      const emitProgress = ctx.emitProgress;
      const stream = agentLoop(task, config, ctx.signal);

      let lastContent = "";
      let turnCount = 0;

      for await (const event of stream) {
        if (ctx.signal.aborted) break;

        switch (event.type) {
          case "turn_start":
            turnCount = event.turn;
            emitProgress?.(
              JSON.stringify({
                type: "sub_agent_turn",
                agentId,
                turn: event.turn,
                maxTurns,
              }) + "\n",
            );
            break;

          case "tool_start":
            emitProgress?.(
              JSON.stringify({
                type: "sub_agent_tool",
                agentId,
                tool: event.toolName,
                args: summarizeArgs(event.arguments),
                status: "start",
              }) + "\n",
            );
            break;

          case "tool_end":
            emitProgress?.(
              JSON.stringify({
                type: "sub_agent_tool",
                agentId,
                tool: event.toolName,
                isError: event.result.isError ?? false,
                status: "end",
              }) + "\n",
            );
            break;

          case "message_delta":
            lastContent += event.delta;
            break;

          case "message_end":
            lastContent = event.content;
            break;

          case "error":
            emitProgress?.(
              JSON.stringify({
                type: "sub_agent_error",
                agentId,
                message: event.error.message,
              }) + "\n",
            );
            break;

          case "agent_end":
            if (event.result.error) {
              return {
                content: `[${agentId}] Sub-agent error after ${turnCount} turns: ${event.result.error.message}`,
                isError: true,
              };
            }
            break;
        }
      }

      if (ctx.signal.aborted) {
        return {
          content: `[${agentId}] Sub-agent aborted after ${turnCount} turns.`,
          isError: true,
        };
      }

      const resultContent = lastContent.trim() || "(Sub-agent completed with no text output)";
      return {
        content: `[${agentId}] Sub-agent completed in ${turnCount} turns.\n\n${resultContent}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// orchestrate_sub_agents tool
// ---------------------------------------------------------------------------

export function createOrchestratorTool(deps: SubAgentDeps): NamedToolHandler {
  return {
    name: "orchestrate_sub_agents",
    description: `Coordinate multiple sub-agents with inter-agent communication, dependency ordering, and conflict detection.

Use this instead of multiple sub_agent calls when you need:
- Agents to share intermediate results via a shared blackboard
- Ordered execution (agent B waits for agent A to finish)
- Conflict detection when multiple agents modify the same files
- A unified progress view of all agents

Each agent gets blackboard tools (blackboard_write, blackboard_read, blackboard_list, blackboard_wait) to communicate with siblings.`,
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Array of sub-agent task definitions",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description:
                  "Unique ID for this agent (auto-generated if omitted). Referenced by depends_on.",
              },
              label: {
                type: "string",
                description:
                  "Short human-readable label for progress display (e.g., 'Implement API routes').",
              },
              task: {
                type: "string",
                description: "Self-contained task description with all necessary context.",
              },
              context: {
                type: "string",
                description: "Optional additional context.",
              },
              max_turns: {
                type: "number",
                description: `Max turns per agent (default: ${DEFAULT_SUB_AGENT_TURNS}, max: ${MAX_SUB_AGENT_TURNS}).`,
              },
              depends_on: {
                type: "array",
                items: { type: "string" },
                description: "IDs of tasks that must complete before this one starts.",
              },
            },
            required: ["label", "task"],
          },
        },
      },
      required: ["tasks"],
    } as ToolInputSchema,
    options: {
      category: "sequential" as const,
      timeoutMs: 600_000, // 10 minutes for a full orchestration
    },
    async handler(
      args: Record<string, unknown>,
      ctx: { signal: AbortSignal; emitProgress?: (update: string) => void },
    ): Promise<AgentToolResult> {
      const rawTasks = args.tasks as SubAgentTask[];
      if (!rawTasks || rawTasks.length === 0) {
        return { content: "No tasks provided.", isError: true };
      }
      if (rawTasks.length > 10) {
        return { content: "Maximum 10 sub-agents per orchestration.", isError: true };
      }

      // Filter out orchestration tools from child agents to prevent recursion
      const childTools = deps.tools.filter(
        (t) => t.name !== "sub_agent" && t.name !== "orchestrate_sub_agents",
      );

      const orchestrator = new SubAgentOrchestrator({
        streamFn: deps.streamFn,
        model: deps.model,
        tools: childTools,
      });

      const result = await orchestrator.execute(rawTasks, ctx.signal, ctx.emitProgress);

      // Build output
      const parts: string[] = [];
      parts.push(`# Orchestration Report (batch: ${orchestrator.batchId})`);
      parts.push(result.summary);
      parts.push(`\nTotal time: ${(result.totalDurationMs / 1000).toFixed(1)}s`);

      parts.push("\n---\n## Agent Results\n");
      for (const r of result.results) {
        const statusIcon =
          r.status === "completed"
            ? "[OK]"
            : r.status === "error"
              ? "[ERR]"
              : r.status === "cancelled"
                ? "[SKIP]"
                : "[?]";
        parts.push(`### ${statusIcon} ${r.label} (${r.agentId})`);
        parts.push(
          `Status: ${r.status} | Turns: ${r.turns} | Duration: ${(r.durationMs / 1000).toFixed(1)}s`,
        );
        if (r.filesModified.length > 0) {
          parts.push(`Files modified: ${r.filesModified.join(", ")}`);
        }
        if (r.error) {
          parts.push(`Error: ${r.error}`);
        }
        parts.push(`\n${r.output}\n`);
      }

      const hasErrors = result.results.some((r) => r.status === "error");

      return {
        content: parts.join("\n"),
        isError: hasErrors,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produce a short summary of tool arguments for progress reporting */
function summarizeArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  const [key, val] = entries[0]!;
  const str = String(val ?? "");
  const truncated = str.length > 80 ? str.slice(0, 77) + "..." : str;
  return `${key}: ${truncated}`;
}
