import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadScheduledTasks,
  upsertScheduledTask,
  deleteScheduledTask,
  replaceScheduledTasks,
} from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { InputBox } from "@/components/ui/InputBox";
import { v4 as uuidv4 } from "uuid";
import { PlayIcon } from "lucide-react";
import { AccordionSection, AccordionCard, FieldRow, ToggleSwitch } from "./SettingsAccordion";

function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);

  if (absDiff < 60_000) return diff > 0 ? l10n.t("in <1 min") : l10n.t("<1 min ago");
  if (absDiff < 3600_000) {
    const m = Math.round(absDiff / 60_000);
    return diff > 0
      ? l10n.t("in ${count} min", { count: m })
      : l10n.t("${count} min ago", { count: m });
  }
  if (absDiff < 86400_000) {
    const h = Math.round(absDiff / 3600_000);
    return diff > 0
      ? l10n.t("in ${count} hr", { count: h })
      : l10n.t("${count} hr ago", { count: h });
  }
  const d = Math.round(absDiff / 86400_000);
  return diff > 0
    ? l10n.t("in ${count} day", { count: d })
    : l10n.t("${count} day ago", { count: d });
}

function scheduleLabel(task: ScheduledTaskConfig): string {
  const { schedule } = task;
  switch (schedule.type) {
    case "cron":
      return schedule.cron || l10n.t("Cron");
    case "interval": {
      if (!schedule.intervalMs) return l10n.t("Interval");
      const s = schedule.intervalMs / 1000;
      if (s < 60) return l10n.t("every ${count}s", { count: s });
      if (s < 3600) return l10n.t("every ${count}m", { count: Math.round(s / 60) });
      return l10n.t("every ${count}h", { count: Math.round(s / 3600) });
    }
    case "once":
      return schedule.runAt ? new Date(schedule.runAt).toLocaleString() : l10n.t("Once");
    default:
      return schedule.type;
  }
}

function actionTypeLabel(type: string): string {
  switch (type) {
    case "shell":
      return l10n.t("Shell");
    case "prompt":
      return l10n.t("Prompt");
    default:
      return type;
  }
}

export function ScheduledTasksConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const tasks = useSelector((state: RootState) => state.settings.scheduledTasks);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadScheduledTasks());
  }, [dispatch]);

  // Subscribe to live status updates
  useEffect(() => {
    const unsub = window.api.scheduler.onStatusUpdate((updatedTasks) => {
      dispatch(replaceScheduledTasks(updatedTasks as ScheduledTaskConfig[]));
    });
    return unsub;
  }, [dispatch]);

  const handleAdd = (actionType: "shell" | "prompt") => {
    const now = Date.now();
    const task: ScheduledTaskConfig = {
      id: uuidv4(),
      title: actionType === "shell" ? l10n.t("New Shell Task") : l10n.t("New Prompt Task"),
      description: "",
      schedule: {
        type: "interval",
        intervalMs: 300_000, // 5 minutes
      },
      action: {
        type: actionType,
        command: actionType === "shell" ? "" : undefined,
        prompt: actionType === "prompt" ? "" : undefined,
      },
      enabled: false,
      createdAt: now,
      updatedAt: now,
    };
    dispatch(upsertScheduledTask(task));
    setExpandedId(task.id);
  };

  const handleSave = useCallback(
    (task: ScheduledTaskConfig) => {
      dispatch(upsertScheduledTask({ ...task, updatedAt: Date.now() }));
    },
    [dispatch],
  );

  const handleRunNow = useCallback((id: string) => {
    window.api.scheduler.runNow(id).catch((err) => {
      console.error("[Scheduler] runNow failed:", err);
    });
  }, []);

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <AccordionSection
      hasItems={tasks.length > 0}
      emptyMessage={l10n.t("No scheduled tasks")}
      addActions={[
        { label: l10n.t("Shell Task"), onClick: () => handleAdd("shell") },
        { label: l10n.t("Prompt Task"), onClick: () => handleAdd("prompt") },
      ]}
    >
      {tasks.map((task) => (
        <AccordionCard
          key={task.id}
          expanded={expandedId === task.id}
          onToggle={() => toggle(task.id)}
          onRemove={() => {
            dispatch(deleteScheduledTask(task.id));
            if (expandedId === task.id) setExpandedId(null);
          }}
          title={task.title || l10n.t("Untitled")}
          subtitle={
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  task.lastRunError
                    ? "bg-red-500"
                    : task.lastRunAt
                      ? "bg-green-500"
                      : "bg-muted-foreground/30"
                }`}
              />
              {actionTypeLabel(task.action.type)} / {scheduleLabel(task)}
            </span>
          }
          enabled={task.enabled}
        >
          <FieldRow label={l10n.t("Title")}>
            <InputBox
              value={task.title}
              onChange={(e) => handleSave({ ...task, title: e.target.value })}
              placeholder={l10n.t("Task title")}
              className="h-7 text-[12px] rounded-md bg-secondary"
            />
          </FieldRow>

          <FieldRow label={l10n.t("Desc")}>
            <InputBox
              value={task.description}
              onChange={(e) => handleSave({ ...task, description: e.target.value })}
              placeholder={l10n.t("Optional description")}
              className="h-7 text-[12px] rounded-md bg-secondary"
            />
          </FieldRow>

          {/* Schedule config */}
          <FieldRow label={l10n.t("Schedule")}>
            <div className="flex items-center gap-2">
              <select
                value={task.schedule.type}
                onChange={(e) =>
                  handleSave({
                    ...task,
                    schedule: {
                      ...task.schedule,
                      type: e.target.value as "cron" | "interval" | "once",
                    },
                  })
                }
                className="h-7 bg-secondary border border-border rounded-md px-2 text-[12px] text-foreground outline-none"
              >
                <option value="cron">{l10n.t("Cron")}</option>
                <option value="interval">{l10n.t("Interval")}</option>
                <option value="once">{l10n.t("Once")}</option>
              </select>
            </div>
          </FieldRow>

          {task.schedule.type === "cron" && (
            <FieldRow label={l10n.t("Cron")}>
              <InputBox
                value={task.schedule.cron ?? ""}
                onChange={(e) =>
                  handleSave({
                    ...task,
                    schedule: { ...task.schedule, cron: e.target.value },
                  })
                }
                placeholder="*/5 * * * *"
                className="h-7 text-[12px] rounded-md bg-secondary font-mono"
              />
            </FieldRow>
          )}

          {task.schedule.type === "interval" && (
            <FieldRow label={l10n.t("Interval")}>
              <div className="flex items-center gap-2">
                <InputBox
                  type="number"
                  value={Math.round((task.schedule.intervalMs ?? 300000) / 60000)}
                  onChange={(e) =>
                    handleSave({
                      ...task,
                      schedule: {
                        ...task.schedule,
                        intervalMs: Math.max(1, parseInt(e.target.value) || 5) * 60000,
                      },
                    })
                  }
                  className="h-7 text-[12px] rounded-md bg-secondary w-20"
                  min={1}
                />
                <span className="text-[11px] text-muted-foreground">{l10n.t("minutes")}</span>
              </div>
            </FieldRow>
          )}

          {task.schedule.type === "once" && (
            <FieldRow label={l10n.t("Run At")}>
              <InputBox
                type="datetime-local"
                value={task.schedule.runAt ? task.schedule.runAt.slice(0, 16) : ""}
                onChange={(e) =>
                  handleSave({
                    ...task,
                    schedule: {
                      ...task.schedule,
                      runAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    },
                  })
                }
                className="h-7 text-[12px] rounded-md bg-secondary"
              />
            </FieldRow>
          )}

          {/* Action config */}
          <FieldRow label={l10n.t("Action")}>
            <select
              value={task.action.type}
              onChange={(e) =>
                handleSave({
                  ...task,
                  action: { ...task.action, type: e.target.value as "shell" | "prompt" },
                })
              }
              className="h-7 bg-secondary border border-border rounded-md px-2 text-[12px] text-foreground outline-none"
            >
              <option value="shell">{l10n.t("Shell")}</option>
              <option value="prompt">{l10n.t("Prompt")}</option>
            </select>
          </FieldRow>

          {task.action.type === "shell" && (
            <FieldRow label={l10n.t("Command")}>
              <InputBox
                value={task.action.command ?? ""}
                onChange={(e) =>
                  handleSave({
                    ...task,
                    action: { ...task.action, command: e.target.value },
                  })
                }
                placeholder="echo hello"
                className="h-7 text-[12px] rounded-md bg-secondary font-mono"
              />
            </FieldRow>
          )}

          {task.action.type === "prompt" && (
            <FieldRow label={l10n.t("Prompt")}>
              <InputBox
                value={task.action.prompt ?? ""}
                onChange={(e) =>
                  handleSave({
                    ...task,
                    action: { ...task.action, prompt: e.target.value },
                  })
                }
                placeholder={l10n.t("Agent prompt text...")}
                className="h-7 text-[12px] rounded-md bg-secondary"
              />
            </FieldRow>
          )}

          <FieldRow label={l10n.t("Enabled")}>
            <ToggleSwitch
              checked={task.enabled}
              onChange={(v) => handleSave({ ...task, enabled: v })}
            />
          </FieldRow>

          {/* Status info */}
          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground/60 space-y-0.5">
                {task.lastRunAt && (
                  <p>
                    {l10n.t("Last run")}: {formatRelativeTime(task.lastRunAt)}
                    {task.lastRunError && (
                      <span className="text-red-400 ml-1">({l10n.t("error")})</span>
                    )}
                  </p>
                )}
                {task.nextRunAt && (
                  <p>
                    {l10n.t("Next run")}: {formatRelativeTime(task.nextRunAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRunNow(task.id)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-foreground/5 transition-colors"
              >
                <PlayIcon className="w-3 h-3" />
                {l10n.t("Run Now")}
              </button>
            </div>

            {task.lastRunError && (
              <div className="px-2 py-1 rounded bg-destructive/10 text-destructive text-[10px] font-mono break-all">
                {task.lastRunError}
              </div>
            )}
            {task.lastRunResult && !task.lastRunError && (
              <div className="px-2 py-1 rounded bg-foreground/5 text-[10px] font-mono text-muted-foreground break-all max-h-20 overflow-y-auto">
                {task.lastRunResult}
              </div>
            )}
          </div>
        </AccordionCard>
      ))}
    </AccordionSection>
  );
}
