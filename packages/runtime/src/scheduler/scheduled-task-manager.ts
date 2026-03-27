/**
 * Core scheduler engine. Manages a 60-second tick loop that checks all
 * enabled tasks for due execution. Supports shell commands and agent prompts.
 */

import { exec } from "node:child_process";
import { matchesCron, nextCronRun } from "./cron-matcher.js";
import type { ScheduledTask, ScheduledTaskStatusUpdate } from "./types.js";

const TICK_INTERVAL_MS = 60_000;
const DEFAULT_SHELL_TIMEOUT_MS = 60_000;

export class ScheduledTaskManager {
  private tasks: ScheduledTask[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private runningTasks = new Set<string>();
  private workspacePath = "";
  private statusHandler: ((update: ScheduledTaskStatusUpdate) => void) | null = null;
  private sendMessageFn: ((conversationId: string, content: string) => Promise<void>) | null = null;
  private createConversationFn: ((title?: string) => Promise<{ id: string }>) | null = null;
  /** Reusable conversation ID for prompt-type tasks (one shared conversation) */
  private schedulerConversationId: string | null = null;

  setWorkspacePath(path: string): void {
    this.workspacePath = path;
  }

  setStatusHandler(handler: (update: ScheduledTaskStatusUpdate) => void): void {
    this.statusHandler = handler;
  }

  setSendMessageFn(fn: (conversationId: string, content: string) => Promise<void>): void {
    this.sendMessageFn = fn;
  }

  setCreateConversationFn(fn: (title?: string) => Promise<{ id: string }>): void {
    this.createConversationFn = fn;
  }

  // ---------------------------------------------------------------------------
  // Task CRUD
  // ---------------------------------------------------------------------------

  setTasks(tasks: ScheduledTask[]): void {
    this.tasks = tasks.map((t) => ({ ...t, nextRunAt: this.computeNextRun(t) }));
    this.emitStatus();
  }

  getTasks(): ScheduledTask[] {
    return this.tasks;
  }

  addTask(task: ScheduledTask): void {
    task.nextRunAt = this.computeNextRun(task);
    this.tasks.push(task);
    this.emitStatus();
  }

  updateTask(id: string, updates: Partial<ScheduledTask>): boolean {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    this.tasks[idx] = { ...this.tasks[idx]!, ...updates, updatedAt: Date.now() };
    this.tasks[idx]!.nextRunAt = this.computeNextRun(this.tasks[idx]!);
    this.emitStatus();
    return true;
  }

  removeTask(id: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== before) {
      this.emitStatus();
      return true;
    }
    return false;
  }

  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    if (this.tickTimer) return;
    console.error("[Scheduler] Starting tick loop");
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    // Run first tick immediately
    this.tick();
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
      console.error("[Scheduler] Stopped");
    }
  }

  // ---------------------------------------------------------------------------
  // Manual trigger
  // ---------------------------------------------------------------------------

  async runNow(taskId: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    await this.executeTask(task);
  }

  // ---------------------------------------------------------------------------
  // Tick loop
  // ---------------------------------------------------------------------------

  private tick(): void {
    const now = Date.now();
    for (const task of this.tasks) {
      if (!task.enabled) continue;
      if (this.runningTasks.has(task.id)) continue;

      if (this.isDue(task, now)) {
        this.executeTask(task).catch((err) => {
          console.error(`[Scheduler] Failed to execute task ${task.id}:`, err);
        });
      }
    }
  }

  private isDue(task: ScheduledTask, now: number): boolean {
    const { schedule } = task;

    switch (schedule.type) {
      case "cron": {
        if (!schedule.cron) return false;
        const date = new Date(now);
        // Zero out seconds for minute-level matching
        date.setSeconds(0, 0);
        return matchesCron(schedule.cron, date);
      }

      case "interval": {
        if (!schedule.intervalMs || schedule.intervalMs <= 0) return false;
        const lastRun = task.lastRunAt ?? task.createdAt;
        return now - lastRun >= schedule.intervalMs;
      }

      case "once": {
        if (!schedule.runAt) return false;
        if (task.lastRunAt) return false; // already ran
        const runTime = new Date(schedule.runAt).getTime();
        return now >= runTime;
      }

      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Task execution
  // ---------------------------------------------------------------------------

  private async executeTask(task: ScheduledTask): Promise<void> {
    if (this.runningTasks.has(task.id)) return;
    this.runningTasks.add(task.id);

    console.error(`[Scheduler] Executing task: ${task.title} (${task.id})`);

    try {
      if (task.action.type === "shell") {
        await this.executeShell(task);
      } else if (task.action.type === "prompt") {
        await this.executePrompt(task);
      }
    } finally {
      this.runningTasks.delete(task.id);
      // Recompute next run
      task.nextRunAt = this.computeNextRun(task);
      this.emitStatus();
    }
  }

  private async executeShell(task: ScheduledTask): Promise<void> {
    const command = task.action.command;
    if (!command) {
      task.lastRunAt = Date.now();
      task.lastRunError = "No command specified";
      task.lastRunResult = undefined;
      return;
    }

    const timeoutMs = task.action.timeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;

    return new Promise<void>((resolve) => {
      exec(
        command,
        {
          cwd: this.workspacePath || undefined,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, FORCE_COLOR: "0" },
        },
        (error, stdout, stderr) => {
          task.lastRunAt = Date.now();
          task.updatedAt = Date.now();

          if (error) {
            task.lastRunError = error.message;
            task.lastRunResult = (stdout || "") + (stderr ? "\n" + stderr : "");
          } else {
            task.lastRunError = undefined;
            let output = stdout || "";
            if (stderr) output += "\n" + stderr;
            // Truncate large output
            if (output.length > 5000) {
              output = output.slice(0, 5000) + "\n...[truncated]";
            }
            task.lastRunResult = output;
          }

          this.emitStatus();
          resolve();
        },
      );
    });
  }

  private async executePrompt(task: ScheduledTask): Promise<void> {
    const prompt = task.action.prompt;
    if (!prompt) {
      task.lastRunAt = Date.now();
      task.lastRunError = "No prompt specified";
      task.lastRunResult = undefined;
      return;
    }

    if (!this.sendMessageFn || !this.createConversationFn) {
      task.lastRunAt = Date.now();
      task.lastRunError = "Runtime not connected";
      task.lastRunResult = undefined;
      return;
    }

    try {
      // Reuse a single shared conversation for all prompt tasks.
      // Only create one if we haven't yet this session.
      if (!this.schedulerConversationId) {
        const conv = await this.createConversationFn("⏰ Scheduled Tasks");
        this.schedulerConversationId = conv.id;
      }

      await this.sendMessageFn(
        this.schedulerConversationId,
        `[Scheduled Task: ${task.title}]\n\n${prompt}`,
      );
      task.lastRunAt = Date.now();
      task.updatedAt = Date.now();
      task.lastRunError = undefined;
      task.lastRunResult = `Prompt sent to conversation ${this.schedulerConversationId}`;
    } catch (err) {
      task.lastRunAt = Date.now();
      task.updatedAt = Date.now();
      task.lastRunError = err instanceof Error ? err.message : String(err);
      task.lastRunResult = undefined;
      // If the conversation was deleted or invalid, reset so next run creates a new one
      this.schedulerConversationId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private computeNextRun(task: ScheduledTask): number | undefined {
    if (!task.enabled) return undefined;

    const { schedule } = task;
    const now = new Date();

    switch (schedule.type) {
      case "cron": {
        if (!schedule.cron) return undefined;
        return nextCronRun(schedule.cron, now);
      }

      case "interval": {
        if (!schedule.intervalMs || schedule.intervalMs <= 0) return undefined;
        const lastRun = task.lastRunAt ?? task.createdAt;
        return lastRun + schedule.intervalMs;
      }

      case "once": {
        if (!schedule.runAt) return undefined;
        if (task.lastRunAt) return undefined; // already ran
        const runTime = new Date(schedule.runAt).getTime();
        return runTime > Date.now() ? runTime : undefined;
      }

      default:
        return undefined;
    }
  }

  private emitStatus(): void {
    this.statusHandler?.({ tasks: this.tasks });
  }
}
