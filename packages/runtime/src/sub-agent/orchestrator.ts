/**
 * SubAgentOrchestrator — coordinates a batch of sub-agents with:
 *  - DAG-based execution ordering (depends_on)
 *  - Shared blackboard for inter-agent communication
 *  - File conflict detection across parallel agents
 *  - Structured progress reporting
 */

import { randomUUID } from "node:crypto";
import { agentLoop } from "@agentx/agent";
import type {
  AgentTool,
  StreamFn,
  AgentConfig,
  AgentToolResult,
  ToolExecutionContext,
} from "@agentx/agent";
import { Blackboard } from "./blackboard.js";
import type {
  SubAgentTask,
  SubAgentResult,
  SubAgentStatus,
  FileConflict,
  OrchestratedResult,
  SubAgentProgressEntry,
} from "./types.js";

// ---------------------------------------------------------------------------
// Internal tracker per agent
// ---------------------------------------------------------------------------

interface AgentTracker {
  task: SubAgentTask;
  agentId: string;
  status: SubAgentStatus;
  currentTurn: number;
  maxTurns: number;
  activeTool?: string;
  lastMessage?: string;
  filesModified: Set<string>;
  filesRead: Set<string>;
  output: string;
  error?: string;
  durationMs: number;
  /** Resolves when this agent finishes */
  promise?: Promise<void>;
  resolveComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface OrchestratorDeps {
  streamFn: StreamFn;
  model: string;
  /** Parent's tools — already excludes sub_agent / orchestrate_sub_agents */
  tools: AgentTool[];
}

const SUB_AGENT_SYSTEM_PROMPT = `You are a focused sub-agent executing a specific task as part of a coordinated multi-agent operation.

Complete your assigned task thoroughly and return a clear summary.
Do NOT ask follow-up questions — just execute with the tools available.

You have access to a shared blackboard for coordinating with sibling agents:
- Use blackboard_write to publish intermediate results or status for other agents
- Use blackboard_read to check if other agents have published results you need
- Use blackboard_list to see all entries on the blackboard
- Use blackboard_wait to block until a specific key is published (useful for dependencies)`;

const MAX_TURNS = 30;
const DEFAULT_TURNS = 10;

export class SubAgentOrchestrator {
  private deps: OrchestratorDeps;
  private blackboard: Blackboard;
  private trackers = new Map<string, AgentTracker>();
  readonly batchId: string;

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
    this.blackboard = new Blackboard();
    this.batchId = randomUUID().slice(0, 8);
  }

  /**
   * Execute a batch of sub-agent tasks with coordination.
   */
  async execute(
    tasks: SubAgentTask[],
    signal: AbortSignal,
    emitProgress?: (update: string) => void,
  ): Promise<OrchestratedResult> {
    const startTime = Date.now();

    // Assign IDs and create trackers
    for (const task of tasks) {
      const agentId = task.id ?? `agent_${randomUUID().slice(0, 6)}`;
      task.id = agentId;
      const maxTurns = Math.min(
        Math.max(1, Math.round(task.max_turns ?? DEFAULT_TURNS)),
        MAX_TURNS,
      );
      this.trackers.set(agentId, {
        task,
        agentId,
        status: "pending",
        currentTurn: 0,
        maxTurns,
        filesModified: new Set(),
        filesRead: new Set(),
        output: "",
        durationMs: 0,
      });
    }

    // Validate depends_on references
    for (const task of tasks) {
      for (const dep of task.depends_on ?? []) {
        if (!this.trackers.has(dep)) {
          throw new Error(`Task "${task.id}" depends on unknown task "${dep}"`);
        }
      }
    }

    // Emit initial progress
    this.emitProgressSnapshot(emitProgress);

    // Execute with DAG ordering
    await this.executeDag(tasks, signal, emitProgress);

    // Detect file conflicts
    const conflicts = this.detectConflicts();

    // Build results
    const results: SubAgentResult[] = [];
    for (const tracker of this.trackers.values()) {
      results.push({
        agentId: tracker.agentId,
        label: tracker.task.label,
        status: tracker.status,
        output: tracker.output,
        filesModified: [...tracker.filesModified],
        filesRead: [...tracker.filesRead],
        turns: tracker.currentTurn,
        durationMs: tracker.durationMs,
        error: tracker.error,
      });
    }

    // Build summary
    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "error").length;
    const cancelled = results.filter((r) => r.status === "cancelled").length;
    let summary = `Orchestration complete: ${completed}/${results.length} succeeded`;
    if (failed > 0) summary += `, ${failed} failed`;
    if (cancelled > 0) summary += `, ${cancelled} cancelled`;
    if (conflicts.length > 0) {
      summary += `\n\n⚠ File conflicts detected (${conflicts.length}):\n`;
      for (const c of conflicts) {
        summary += `  - ${c.filePath}: modified by ${c.modifiedBy.join(", ")}\n`;
      }
    }

    // Blackboard final state
    const bbEntries = this.blackboard.list();
    if (bbEntries.length > 0) {
      summary += `\nBlackboard entries (${bbEntries.length}):\n`;
      for (const e of bbEntries.slice(0, 20)) {
        const val = e.value.length > 100 ? e.value.slice(0, 97) + "..." : e.value;
        summary += `  [${e.agentId}] ${e.key} = ${val}\n`;
      }
    }

    this.blackboard.clear();

    return {
      results,
      conflicts,
      summary,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // ---------------------------------------------------------------------------
  // DAG execution
  // ---------------------------------------------------------------------------

  private async executeDag(
    tasks: SubAgentTask[],
    signal: AbortSignal,
    emitProgress?: (update: string) => void,
  ): Promise<void> {
    // Create completion promises for each agent
    const completionMap = new Map<string, Promise<void>>();

    for (const tracker of this.trackers.values()) {
      let resolveComplete!: () => void;
      const promise = new Promise<void>((r) => {
        resolveComplete = r;
      });
      tracker.promise = promise;
      tracker.resolveComplete = resolveComplete;
      completionMap.set(tracker.agentId, promise);
    }

    // Launch all agents — those with dependencies wait internally
    const agentPromises: Promise<void>[] = [];
    for (const task of tasks) {
      const tracker = this.trackers.get(task.id!)!;
      agentPromises.push(this.runSingleAgent(tracker, completionMap, signal, emitProgress));
    }

    await Promise.allSettled(agentPromises);
  }

  private async runSingleAgent(
    tracker: AgentTracker,
    completionMap: Map<string, Promise<void>>,
    signal: AbortSignal,
    emitProgress?: (update: string) => void,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Wait for dependencies
      const deps = tracker.task.depends_on ?? [];
      if (deps.length > 0) {
        tracker.lastMessage = `Waiting for: ${deps.join(", ")}`;
        this.emitProgressSnapshot(emitProgress);

        await Promise.all(deps.map((id) => completionMap.get(id)!));

        // Check if any dependency failed
        for (const depId of deps) {
          const depTracker = this.trackers.get(depId);
          if (depTracker && depTracker.status === "error") {
            tracker.status = "cancelled";
            tracker.error = `Dependency "${depId}" failed`;
            tracker.durationMs = Date.now() - startTime;
            tracker.resolveComplete?.();
            this.emitProgressSnapshot(emitProgress);
            return;
          }
        }
      }

      if (signal.aborted) {
        tracker.status = "cancelled";
        tracker.durationMs = Date.now() - startTime;
        tracker.resolveComplete?.();
        return;
      }

      // Build tools: base tools + blackboard tools
      const agentTools = [...this.deps.tools, ...this.createBlackboardTools(tracker.agentId)];

      // Build system prompt
      let systemPrompt = SUB_AGENT_SYSTEM_PROMPT + `\n\n## Your Agent ID\n${tracker.agentId}`;
      systemPrompt += `\n\n## Task\n${tracker.task.task}`;
      if (tracker.task.context) {
        systemPrompt += `\n\n## Context\n${tracker.task.context}`;
      }

      // Add dependency results as context
      if (deps.length > 0) {
        const depResults: string[] = [];
        for (const depId of deps) {
          const depTracker = this.trackers.get(depId);
          if (depTracker && depTracker.output) {
            depResults.push(`### ${depId} (${depTracker.task.label}):\n${depTracker.output}`);
          }
        }
        if (depResults.length > 0) {
          systemPrompt += `\n\n## Dependency Results\n${depResults.join("\n\n")}`;
        }
      }

      const config: AgentConfig = {
        model: this.deps.model,
        systemPrompt,
        tools: agentTools,
        streamFn: this.deps.streamFn,
        maxTurns: tracker.maxTurns,
      };

      // Run agent loop
      tracker.status = "running";
      this.emitProgressSnapshot(emitProgress);

      const stream = agentLoop(tracker.task.task, config, signal);
      let lastContent = "";

      for await (const event of stream) {
        if (signal.aborted) break;

        switch (event.type) {
          case "turn_start":
            tracker.currentTurn = event.turn;
            tracker.activeTool = undefined;
            this.emitProgressSnapshot(emitProgress);
            break;

          case "tool_start":
            tracker.activeTool = event.toolName;
            // Track file operations
            this.trackFileOperation(tracker, event.toolName, event.arguments);
            this.emitProgressSnapshot(emitProgress);
            break;

          case "tool_end":
            tracker.activeTool = undefined;
            this.emitProgressSnapshot(emitProgress);
            break;

          case "message_delta":
            lastContent += event.delta;
            break;

          case "message_end":
            lastContent = event.content;
            tracker.lastMessage = lastContent.slice(0, 120);
            break;

          case "error":
            tracker.error = event.error.message;
            break;

          case "agent_end":
            if (event.result.error) {
              tracker.status = "error";
              tracker.error = event.result.error.message;
            } else {
              tracker.status = "completed";
            }
            break;
        }
      }

      if (signal.aborted && tracker.status === "running") {
        tracker.status = "cancelled";
      }

      if (tracker.status === "running") {
        tracker.status = "completed";
      }

      tracker.output = lastContent.trim() || "(No text output)";
    } catch (err) {
      tracker.status = "error";
      tracker.error = err instanceof Error ? err.message : String(err);
    } finally {
      tracker.durationMs = Date.now() - startTime;
      tracker.resolveComplete?.();
      this.emitProgressSnapshot(emitProgress);
    }
  }

  // ---------------------------------------------------------------------------
  // Blackboard tools (injected into each sub-agent)
  // ---------------------------------------------------------------------------

  private createBlackboardTools(agentId: string): AgentTool[] {
    const bb = this.blackboard;

    return [
      {
        name: "blackboard_write",
        description:
          "Write a key-value entry to the shared blackboard. Other agents can read this. Use to publish intermediate results or signal completion of a subtask.",
        parameters: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Key name (use descriptive names like 'api_schema' or 'agent_a_result')",
            },
            value: { type: "string", description: "Value to store" },
          },
          required: ["key", "value"],
        },
        category: "parallel" as const,
        async execute(args: Record<string, unknown>): Promise<AgentToolResult> {
          bb.put(args.key as string, args.value as string, agentId);
          return { content: `Written to blackboard: ${args.key}` };
        },
      },
      {
        name: "blackboard_read",
        description:
          "Read a specific key from the shared blackboard. Returns the value and which agent wrote it.",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string", description: "Key to read" },
          },
          required: ["key"],
        },
        category: "parallel" as const,
        async execute(args: Record<string, unknown>): Promise<AgentToolResult> {
          const entry = bb.get(args.key as string);
          if (!entry) {
            return { content: `Key "${args.key}" not found on blackboard.` };
          }
          return {
            content: `[${entry.agentId}] ${entry.key} = ${entry.value}`,
          };
        },
      },
      {
        name: "blackboard_list",
        description:
          "List all entries on the shared blackboard, optionally filtered by key prefix or agent ID.",
        parameters: {
          type: "object",
          properties: {
            prefix: { type: "string", description: "Filter by key prefix (optional)" },
            agent_id: { type: "string", description: "Filter by agent ID (optional)" },
          },
        },
        category: "parallel" as const,
        async execute(args: Record<string, unknown>): Promise<AgentToolResult> {
          const entries = bb.list({
            prefix: args.prefix as string | undefined,
            agentId: args.agent_id as string | undefined,
          });
          if (entries.length === 0) {
            return { content: "Blackboard is empty (no matching entries)." };
          }
          const lines = entries.map(
            (e) =>
              `[${e.agentId}] ${e.key} = ${e.value.length > 200 ? e.value.slice(0, 197) + "..." : e.value}`,
          );
          return { content: lines.join("\n") };
        },
      },
      {
        name: "blackboard_wait",
        description:
          "Wait for a specific key to appear on the blackboard (blocks until published or timeout). Useful when you need a result from another agent.",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string", description: "Key to wait for" },
            timeout_ms: {
              type: "number",
              description: "Timeout in milliseconds (default: 60000)",
            },
          },
          required: ["key"],
        },
        category: "parallel" as const,
        async execute(args: Record<string, unknown>): Promise<AgentToolResult> {
          try {
            const entry = await bb.waitFor(
              args.key as string,
              (args.timeout_ms as number) ?? 60_000,
            );
            return {
              content: `[${entry.agentId}] ${entry.key} = ${entry.value}`,
            };
          } catch (err) {
            return {
              content: err instanceof Error ? err.message : String(err),
              isError: true,
            };
          }
        },
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // File tracking
  // ---------------------------------------------------------------------------

  private trackFileOperation(
    tracker: AgentTracker,
    toolName: string,
    args: Record<string, unknown>,
  ): void {
    const filePath = (args.file_path as string) ?? (args.path as string) ?? "";
    if (!filePath) return;

    switch (toolName) {
      case "file_read":
        tracker.filesRead.add(filePath);
        break;
      case "file_create":
      case "file_rewrite":
        tracker.filesModified.add(filePath);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Conflict detection
  // ---------------------------------------------------------------------------

  private detectConflicts(): FileConflict[] {
    const fileToAgents = new Map<string, string[]>();

    for (const tracker of this.trackers.values()) {
      for (const file of tracker.filesModified) {
        if (!fileToAgents.has(file)) fileToAgents.set(file, []);
        fileToAgents.get(file)!.push(tracker.agentId);
      }
    }

    const conflicts: FileConflict[] = [];
    for (const [filePath, agents] of fileToAgents) {
      if (agents.length > 1) {
        conflicts.push({ filePath, modifiedBy: agents });
      }
    }
    return conflicts;
  }

  // ---------------------------------------------------------------------------
  // Progress snapshot
  // ---------------------------------------------------------------------------

  private emitProgressSnapshot(emitProgress?: (update: string) => void): void {
    if (!emitProgress) return;

    const agents: SubAgentProgressEntry[] = [];
    for (const tracker of this.trackers.values()) {
      agents.push({
        agentId: tracker.agentId,
        label: tracker.task.label,
        status: tracker.status,
        currentTurn: tracker.currentTurn,
        maxTurns: tracker.maxTurns,
        activeTool: tracker.activeTool,
        lastMessage: tracker.lastMessage,
      });
    }

    emitProgress(
      JSON.stringify({
        type: "sub_agent_progress",
        batchId: this.batchId,
        agents,
      }) + "\n",
    );
  }
}
