/**
 * Scheduled task types for the scheduler engine.
 */

export interface ScheduledTaskSchedule {
  type: "cron" | "interval" | "once";
  /** 5-field cron expression: "* /5 * * * *" */
  cron?: string;
  /** Interval in milliseconds (for "interval" type) */
  intervalMs?: number;
  /** ISO 8601 date string (for "once" type) */
  runAt?: string;
}

export interface ScheduledTaskAction {
  type: "shell" | "prompt";
  /** Shell command to execute */
  command?: string;
  /** Agent prompt text to send */
  prompt?: string;
  /** Shell command timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
}

export interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  schedule: ScheduledTaskSchedule;
  action: ScheduledTaskAction;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunResult?: string;
  lastRunError?: string;
  nextRunAt?: number;
}

export interface ScheduledTaskStatusUpdate {
  tasks: ScheduledTask[];
}
