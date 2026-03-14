/**
 * AI agent tool handler: manage_scheduled_task
 * Allows the AI to create, list, update, and delete scheduled tasks via chat.
 */

import { randomUUID } from "node:crypto";
import type { ScheduledTaskManager } from "./scheduled-task-manager.js";
import type { ScheduledTask } from "./types.js";

interface NamedToolHandler {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  options: { category: string };
  handler: (args: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>;
}

/**
 * Persistence callback — called after each mutation so the IPC layer
 * can write the updated task list to disk.
 */
type PersistFn = (tasks: ScheduledTask[]) => void;

export function createSchedulerToolHandlers(
  manager: ScheduledTaskManager,
  persistFn: PersistFn,
): NamedToolHandler[] {
  return [manageScheduledTask(manager, persistFn)];
}

function manageScheduledTask(
  manager: ScheduledTaskManager,
  persistFn: PersistFn,
): NamedToolHandler {
  return {
    name: "manage_scheduled_task",
    description:
      "Create, list, update, or delete scheduled tasks. Tasks can run shell commands or send agent prompts on a cron, interval, or one-time schedule.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "list", "update", "delete"],
          description: "The action to perform",
        },
        task_id: {
          type: "string",
          description: "Task ID (required for update and delete)",
        },
        title: {
          type: "string",
          description: "Task title (required for create)",
        },
        description: {
          type: "string",
          description: "Task description",
        },
        schedule_type: {
          type: "string",
          enum: ["cron", "interval", "once"],
          description: "Schedule type (required for create)",
        },
        cron: {
          type: "string",
          description: 'Cron expression, 5-field format (e.g. "*/5 * * * *")',
        },
        interval_ms: {
          type: "number",
          description: "Interval in milliseconds",
        },
        run_at: {
          type: "string",
          description: "ISO 8601 date for one-time tasks",
        },
        action_type: {
          type: "string",
          enum: ["shell", "prompt"],
          description: "Action type (required for create)",
        },
        command: {
          type: "string",
          description: "Shell command to run",
        },
        prompt: {
          type: "string",
          description: "Agent prompt text",
        },
        timeout_ms: {
          type: "number",
          description: "Shell command timeout in ms (default: 60000)",
        },
        enabled: {
          type: "boolean",
          description: "Whether the task is enabled (default: true)",
        },
      },
      required: ["action"],
    },
    options: { category: "sequential" },
    async handler(args) {
      const action = args.action as string;

      switch (action) {
        case "create": {
          const title = args.title as string | undefined;
          const scheduleType = args.schedule_type as string | undefined;
          const actionType = args.action_type as string | undefined;

          if (!title || !scheduleType || !actionType) {
            return {
              content:
                "Missing required fields: title, schedule_type, and action_type are required for create",
              isError: true,
            };
          }

          const now = Date.now();
          const task: ScheduledTask = {
            id: randomUUID(),
            title,
            description: (args.description as string) || "",
            schedule: {
              type: scheduleType as "cron" | "interval" | "once",
              cron: args.cron as string | undefined,
              intervalMs: args.interval_ms as number | undefined,
              runAt: args.run_at as string | undefined,
            },
            action: {
              type: actionType as "shell" | "prompt",
              command: args.command as string | undefined,
              prompt: args.prompt as string | undefined,
              timeoutMs: args.timeout_ms as number | undefined,
            },
            enabled: args.enabled !== false,
            createdAt: now,
            updatedAt: now,
          };

          manager.addTask(task);
          persistFn(manager.getTasks());

          return {
            content: JSON.stringify(
              { success: true, task_id: task.id, message: `Created task "${title}"` },
              null,
              2,
            ),
          };
        }

        case "list": {
          const tasks = manager.getTasks();
          return {
            content: JSON.stringify(
              tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                schedule: t.schedule,
                action: { type: t.action.type },
                enabled: t.enabled,
                lastRunAt: t.lastRunAt,
                lastRunResult: t.lastRunResult,
                lastRunError: t.lastRunError,
                nextRunAt: t.nextRunAt,
              })),
              null,
              2,
            ),
          };
        }

        case "update": {
          const taskId = args.task_id as string | undefined;
          if (!taskId) {
            return { content: "task_id is required for update", isError: true };
          }

          const updates: Partial<ScheduledTask> = {};

          if (args.title !== undefined) updates.title = args.title as string;
          if (args.description !== undefined) updates.description = args.description as string;
          if (args.enabled !== undefined) updates.enabled = args.enabled as boolean;

          // Schedule updates
          const existing = manager.getTask(taskId);
          if (!existing) {
            return { content: `Task not found: ${taskId}`, isError: true };
          }

          if (
            args.schedule_type !== undefined ||
            args.cron !== undefined ||
            args.interval_ms !== undefined ||
            args.run_at !== undefined
          ) {
            updates.schedule = {
              ...existing.schedule,
              ...(args.schedule_type !== undefined && {
                type: args.schedule_type as "cron" | "interval" | "once",
              }),
              ...(args.cron !== undefined && { cron: args.cron as string }),
              ...(args.interval_ms !== undefined && { intervalMs: args.interval_ms as number }),
              ...(args.run_at !== undefined && { runAt: args.run_at as string }),
            };
          }

          // Action updates
          if (
            args.action_type !== undefined ||
            args.command !== undefined ||
            args.prompt !== undefined ||
            args.timeout_ms !== undefined
          ) {
            updates.action = {
              ...existing.action,
              ...(args.action_type !== undefined && {
                type: args.action_type as "shell" | "prompt",
              }),
              ...(args.command !== undefined && { command: args.command as string }),
              ...(args.prompt !== undefined && { prompt: args.prompt as string }),
              ...(args.timeout_ms !== undefined && { timeoutMs: args.timeout_ms as number }),
            };
          }

          const success = manager.updateTask(taskId, updates);
          persistFn(manager.getTasks());

          return {
            content: JSON.stringify({
              success,
              message: success ? "Task updated" : "Task not found",
            }),
          };
        }

        case "delete": {
          const taskId = args.task_id as string | undefined;
          if (!taskId) {
            return { content: "task_id is required for delete", isError: true };
          }

          const success = manager.removeTask(taskId);
          persistFn(manager.getTasks());

          return {
            content: JSON.stringify({
              success,
              message: success ? "Task deleted" : "Task not found",
            }),
          };
        }

        default:
          return {
            content: `Unknown action: ${action}. Use create, list, update, or delete.`,
            isError: true,
          };
      }
    },
  };
}
