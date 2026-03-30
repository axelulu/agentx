import { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadScheduledTasks,
  upsertScheduledTask,
  deleteScheduledTask,
  replaceScheduledTasks,
} from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { InputBox } from "@/components/ui/InputBox";
import { Select } from "@/components/ui/Select";
import { v4 as uuidv4 } from "uuid";
import {
  PlusIcon,
  PlayIcon,
  TrashIcon,
  TerminalIcon,
  MessageSquareIcon,
  ClockIcon,
  CalendarIcon,
  RepeatIcon,
  TimerIcon,
  InfoIcon,
  ZapIcon,
  BotIcon,
  SettingsIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function scheduleTypeIcon(type: string) {
  switch (type) {
    case "cron":
      return CalendarIcon;
    case "interval":
      return RepeatIcon;
    case "once":
      return TimerIcon;
    default:
      return ClockIcon;
  }
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function AutomationPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const tasks = useSelector((state: RootState) => state.settings.scheduledTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<"shell" | "prompt">("prompt");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadScheduledTasks());
  }, [dispatch]);

  useEffect(() => {
    const unsub = window.api.scheduler.onStatusUpdate((updatedTasks) => {
      dispatch(replaceScheduledTasks(updatedTasks as ScheduledTaskConfig[]));
    });
    return unsub;
  }, [dispatch]);

  const openCreateDialog = (actionType: "shell" | "prompt") => {
    setCreateDefaultType(actionType);
    setCreateOpen(true);
  };

  const handleCreate = (task: ScheduledTaskConfig) => {
    dispatch(upsertScheduledTask(task));
    setCreateOpen(false);
  };

  const handleSave = useCallback(
    (task: ScheduledTaskConfig) => {
      dispatch(upsertScheduledTask({ ...task, updatedAt: Date.now() }));
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    (id: string) => {
      dispatch(deleteScheduledTask(id));
      if (selectedId === id) setSelectedId(null);
    },
    [dispatch, selectedId],
  );

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) {
      handleDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, handleDelete]);

  const handleRunNow = useCallback((id: string) => {
    window.api.scheduler.runNow(id).catch((err) => {
      console.error("[Scheduler] runNow failed:", err);
    });
  }, []);

  // Keep selected task in sync
  const activeTask = useMemo(() => {
    if (!selectedId) return null;
    return tasks.find((t) => t.id === selectedId) ?? null;
  }, [selectedId, tasks]);

  // ── Grid view ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
      <div className="max-w-3xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{l10n.t("Automation")}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Create automated tasks that run on a schedule")}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setUsageOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border hover:bg-foreground/[0.02] transition-all"
            >
              <InfoIcon className="w-3 h-3" />
              {l10n.t("Guide")}
            </button>
            <button
              onClick={() => openCreateDialog("shell")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border hover:bg-foreground/[0.02] transition-all"
            >
              <TerminalIcon className="w-3 h-3" />
              {l10n.t("Shell")}
            </button>
            <button
              onClick={() => openCreateDialog("prompt")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <PlusIcon className="w-3 h-3" />
              {l10n.t("Prompt")}
            </button>
          </div>
        </div>

        {/* Task cards */}
        {tasks.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center py-16 gap-3">
            <ClockIcon className="w-6 h-6 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">{l10n.t("No scheduled tasks")}</p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setUsageOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border hover:bg-foreground/[0.02] transition-all"
              >
                <InfoIcon className="w-3 h-3" />
                {l10n.t("How to use")}
              </button>
              <button
                onClick={() => openCreateDialog("prompt")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                <PlusIcon className="w-3 h-3" />
                {l10n.t("Create Task")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => setSelectedId(task.id)}
                onToggleEnabled={() => handleSave({ ...task, enabled: !task.enabled })}
                onDelete={() => setPendingDeleteId(task.id)}
              />
            ))}

            {/* Add more card */}
            <button
              onClick={() => openCreateDialog("prompt")}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border hover:border-border hover:bg-foreground/[0.01] transition-all"
            >
              <PlusIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">
                {l10n.t("New task")}
              </span>
            </button>
          </div>
        )}
      </div>

      <AutomationUsageDialog open={usageOpen} onOpenChange={setUsageOpen} />
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultActionType={createDefaultType}
        onCreate={handleCreate}
      />
      {activeTask && (
        <TaskDetailDialog
          task={activeTask}
          open={!!activeTask}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onSave={handleSave}
          onDelete={() => {
            setPendingDeleteId(activeTask.id);
            setSelectedId(null);
          }}
          onRunNow={() => handleRunNow(activeTask.id)}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent maxWidth="sm" showCloseButton={false}>
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">{l10n.t("Delete Task")}</h3>
              <p className="text-[13px] text-muted-foreground mt-1">
                {l10n.t("Are you sure you want to delete this task? This action cannot be undone.")}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {l10n.t("Cancel")}
              </button>
              <button
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
                {l10n.t("Delete")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskCard — grid item
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  onClick,
  onToggleEnabled,
  onDelete,
}: {
  task: ScheduledTaskConfig;
  onClick: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  const ActionIcon = task.action.type === "shell" ? TerminalIcon : MessageSquareIcon;
  const ScheduleIcon = scheduleTypeIcon(task.schedule.type);

  return (
    <div
      onClick={onClick}
      className="group relative flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border hover:border-border hover:bg-foreground/[0.015] transition-all cursor-pointer"
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-foreground/[0.04] flex items-center justify-center shrink-0">
        <ActionIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground group-hover:text-foreground leading-snug truncate transition-colors">
            {task.title || l10n.t("Untitled")}
          </p>
          {/* Status dot */}
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              task.lastRunError
                ? "bg-destructive"
                : task.enabled
                  ? "bg-foreground/40"
                  : "bg-foreground/[0.1]",
            )}
          />
        </div>
        {task.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate leading-relaxed">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <ScheduleIcon className="w-2.5 h-2.5" />
            {scheduleLabel(task)}
          </span>
          <span className="text-[10px] px-1.5 py-px rounded bg-foreground/[0.03] text-muted-foreground">
            {task.action.type === "shell" ? l10n.t("Shell") : l10n.t("Prompt")}
          </span>
        </div>
      </div>

      {/* Delete + Toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnabled();
          }}
          className="shrink-0"
        >
          <span
            className={cn(
              "relative block w-6 h-3.5 rounded-full transition-colors",
              task.enabled ? "bg-foreground" : "bg-foreground/[0.12]",
            )}
          >
            <span
              className={cn(
                "absolute top-[2px] w-2.5 h-2.5 rounded-full transition-all duration-150",
                task.enabled ? "left-[12px] bg-background" : "left-[2px] bg-foreground/25",
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailDialog — edit view in a dialog
// ---------------------------------------------------------------------------

function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onRunNow,
}: {
  task: ScheduledTaskConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (t: ScheduledTaskConfig) => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  const ActionIcon = task.action.type === "shell" ? TerminalIcon : MessageSquareIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="md" showCloseButton>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] flex items-center justify-center shrink-0 mt-0.5">
              <ActionIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground leading-tight pr-6">
                {task.title || l10n.t("Untitled")}
              </h2>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      task.enabled ? "bg-foreground/50" : "bg-foreground/[0.12]",
                    )}
                  />
                  {task.enabled ? l10n.t("Enabled") : l10n.t("Disabled")}
                </span>
                <span className="text-[11px] text-muted-foreground">{scheduleLabel(task)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRunNow}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border hover:bg-foreground/[0.02] transition-all"
          >
            <PlayIcon className="w-3 h-3" />
            {l10n.t("Run Now")}
          </button>
          <button
            onClick={() => {
              onDelete();
              onOpenChange(false);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
          >
            <TrashIcon className="w-3 h-3" />
            {l10n.t("Delete")}
          </button>
        </div>

        {/* Settings sections */}
        <div className="space-y-5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {/* General */}
          <Section title={l10n.t("General")}>
            <Field label={l10n.t("Title")}>
              <InputBox
                value={task.title}
                onChange={(e) => onSave({ ...task, title: e.target.value })}
                placeholder={l10n.t("Task title")}
                className="h-8 text-[12px] rounded-md bg-background"
              />
            </Field>
            <Field label={l10n.t("Description")}>
              <InputBox
                value={task.description}
                onChange={(e) => onSave({ ...task, description: e.target.value })}
                placeholder={l10n.t("Optional description")}
                className="h-8 text-[12px] rounded-md bg-background"
              />
            </Field>
            <Field label={l10n.t("Enabled")}>
              <button
                onClick={() => onSave({ ...task, enabled: !task.enabled })}
                className="shrink-0"
              >
                <span
                  className={cn(
                    "relative block w-7 h-4 rounded-full transition-colors",
                    task.enabled ? "bg-foreground" : "bg-foreground/[0.12]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-[2px] w-3 h-3 rounded-full transition-all duration-150",
                      task.enabled ? "left-[14px] bg-background" : "left-[2px] bg-foreground/25",
                    )}
                  />
                </span>
              </button>
            </Field>
          </Section>

          {/* Schedule */}
          <Section title={l10n.t("Schedule")}>
            <Field label={l10n.t("Type")}>
              <Select
                value={task.schedule.type}
                onChange={(v) =>
                  onSave({
                    ...task,
                    schedule: { ...task.schedule, type: v as "cron" | "interval" | "once" },
                  })
                }
                options={[
                  { value: "interval", label: l10n.t("Interval") },
                  { value: "cron", label: l10n.t("Cron Expression") },
                  { value: "once", label: l10n.t("Run Once") },
                ]}
                className="h-8"
              />
            </Field>

            {task.schedule.type === "cron" && (
              <Field label={l10n.t("Expression")}>
                <InputBox
                  value={task.schedule.cron ?? ""}
                  onChange={(e) =>
                    onSave({ ...task, schedule: { ...task.schedule, cron: e.target.value } })
                  }
                  placeholder="*/5 * * * *"
                  className="h-8 text-[12px] rounded-md bg-background font-mono"
                />
              </Field>
            )}
            {task.schedule.type === "interval" && (
              <Field label={l10n.t("Every")}>
                <div className="flex items-center gap-2">
                  <InputBox
                    type="number"
                    value={Math.round((task.schedule.intervalMs ?? 300000) / 60000)}
                    onChange={(e) =>
                      onSave({
                        ...task,
                        schedule: {
                          ...task.schedule,
                          intervalMs: Math.max(1, parseInt(e.target.value) || 5) * 60000,
                        },
                      })
                    }
                    className="h-8 text-[12px] rounded-md bg-background w-20"
                    min={1}
                  />
                  <span className="text-[12px] text-muted-foreground">{l10n.t("minutes")}</span>
                </div>
              </Field>
            )}
            {task.schedule.type === "once" && (
              <Field label={l10n.t("Run At")}>
                <InputBox
                  type="datetime-local"
                  value={task.schedule.runAt ? task.schedule.runAt.slice(0, 16) : ""}
                  onChange={(e) =>
                    onSave({
                      ...task,
                      schedule: {
                        ...task.schedule,
                        runAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      },
                    })
                  }
                  className="h-8 text-[12px] rounded-md bg-background"
                />
              </Field>
            )}
          </Section>

          {/* Action */}
          <Section title={l10n.t("Action")}>
            <Field label={l10n.t("Type")}>
              <Select
                value={task.action.type}
                onChange={(v) =>
                  onSave({ ...task, action: { ...task.action, type: v as "shell" | "prompt" } })
                }
                options={[
                  { value: "shell", label: l10n.t("Shell Command") },
                  { value: "prompt", label: l10n.t("Agent Prompt") },
                ]}
                className="h-8"
              />
            </Field>

            {task.action.type === "shell" && (
              <Field label={l10n.t("Command")}>
                <InputBox
                  value={task.action.command ?? ""}
                  onChange={(e) =>
                    onSave({ ...task, action: { ...task.action, command: e.target.value } })
                  }
                  placeholder="echo hello"
                  className="h-8 text-[12px] rounded-md bg-background font-mono"
                />
              </Field>
            )}
            {task.action.type === "prompt" && (
              <Field label={l10n.t("Prompt")}>
                <textarea
                  value={task.action.prompt ?? ""}
                  onChange={(e) =>
                    onSave({ ...task, action: { ...task.action, prompt: e.target.value } })
                  }
                  placeholder={l10n.t("Agent prompt text...")}
                  rows={3}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-y min-h-[72px]"
                />
              </Field>
            )}
          </Section>

          {/* Status */}
          {(task.lastRunAt || task.nextRunAt || task.lastRunError || task.lastRunResult) && (
            <Section title={l10n.t("Status")}>
              <div className="space-y-2">
                {task.lastRunAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">{l10n.t("Last run")}</span>
                    <span className="text-[12px] text-foreground/80">
                      {formatRelativeTime(task.lastRunAt)}
                      {task.lastRunError && (
                        <span className="text-destructive ml-1.5">({l10n.t("failed")})</span>
                      )}
                    </span>
                  </div>
                )}
                {task.nextRunAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">{l10n.t("Next run")}</span>
                    <span className="text-[12px] text-foreground/80">
                      {formatRelativeTime(task.nextRunAt)}
                    </span>
                  </div>
                )}

                {/* Error output */}
                {task.lastRunError && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-destructive/[0.06] border border-destructive/10">
                    <p className="text-[10px] font-mono text-destructive break-all">
                      {task.lastRunError}
                    </p>
                  </div>
                )}

                {/* Success output */}
                {task.lastRunResult && !task.lastRunError && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-foreground/[0.02] border border-border">
                    <p className="text-[10px] font-mono text-muted-foreground break-all max-h-24 overflow-y-auto">
                      {task.lastRunResult}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Section — grouped fields with a label
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-5">
      <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field — label + input pair
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-20 shrink-0 text-[12px] text-muted-foreground text-right">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateTaskDialog — creation form in a dialog
// ---------------------------------------------------------------------------

function CreateTaskDialog({
  open,
  onOpenChange,
  defaultActionType,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultActionType: "shell" | "prompt";
  onCreate: (task: ScheduledTaskConfig) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState<"shell" | "prompt">(defaultActionType);
  const [command, setCommand] = useState("");
  const [prompt, setPrompt] = useState("");
  const [scheduleType, setScheduleType] = useState<"interval" | "cron" | "once">("interval");
  const [intervalMin, setIntervalMin] = useState(5);
  const [cron, setCron] = useState("");
  const [runAt, setRunAt] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setActionType(defaultActionType);
      setCommand("");
      setPrompt("");
      setScheduleType("interval");
      setIntervalMin(5);
      setCron("");
      setRunAt("");
    }
  }, [open, defaultActionType]);

  const canSubmit =
    title.trim().length > 0 &&
    (actionType === "shell" ? command.trim().length > 0 : prompt.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const now = Date.now();
    const task: ScheduledTaskConfig = {
      id: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      schedule: {
        type: scheduleType,
        ...(scheduleType === "interval" && { intervalMs: Math.max(1, intervalMin) * 60000 }),
        ...(scheduleType === "cron" && { cron }),
        ...(scheduleType === "once" && runAt && { runAt: new Date(runAt).toISOString() }),
      },
      action: {
        type: actionType,
        ...(actionType === "shell" && { command: command.trim() }),
        ...(actionType === "prompt" && { prompt: prompt.trim() }),
      },
      enabled: false,
      createdAt: now,
      updatedAt: now,
    };
    onCreate(task);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={l10n.t("New Automation Task")}
        description={l10n.t("Configure and create a new scheduled task")}
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Action type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActionType("prompt")}
              className={cn(
                "flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all text-left",
                actionType === "prompt"
                  ? "border-foreground/20 bg-foreground/[0.03]"
                  : "border-border hover:border-border hover:bg-foreground/[0.01]",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  actionType === "prompt" ? "bg-foreground/[0.07]" : "bg-foreground/[0.03]",
                )}
              >
                <MessageSquareIcon
                  className={cn(
                    "w-3.5 h-3.5",
                    actionType === "prompt" ? "text-foreground/60" : "text-muted-foreground",
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">{l10n.t("Agent Prompt")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {l10n.t("Send instructions to AI")}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActionType("shell")}
              className={cn(
                "flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all text-left",
                actionType === "shell"
                  ? "border-foreground/20 bg-foreground/[0.03]"
                  : "border-border hover:border-border hover:bg-foreground/[0.01]",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  actionType === "shell" ? "bg-foreground/[0.07]" : "bg-foreground/[0.03]",
                )}
              >
                <TerminalIcon
                  className={cn(
                    "w-3.5 h-3.5",
                    actionType === "shell" ? "text-foreground/60" : "text-muted-foreground",
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">{l10n.t("Shell Command")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {l10n.t("Run terminal commands")}
                </p>
              </div>
            </button>
          </div>

          {/* Title & description */}
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {l10n.t("Title")}
              </label>
              <InputBox
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={l10n.t("e.g. Daily backup, Monitor logs...")}
                className="h-8 text-[12px] rounded-md bg-background"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {l10n.t("Description")}
                <span className="text-muted-foreground normal-case tracking-normal font-normal ml-1">
                  {l10n.t("(optional)")}
                </span>
              </label>
              <InputBox
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={l10n.t("Brief description of what this task does")}
                className="h-8 text-[12px] rounded-md bg-background"
              />
            </div>
          </div>

          {/* Action content */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              {actionType === "shell" ? l10n.t("Command") : l10n.t("Prompt")}
            </label>
            {actionType === "shell" ? (
              <InputBox
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="echo hello && date"
                className="h-8 text-[12px] rounded-md bg-background font-mono"
              />
            ) : (
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={l10n.t("e.g. Check for new issues and summarize...")}
                rows={3}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-y min-h-[72px]"
              />
            )}
          </div>

          {/* Schedule */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              {l10n.t("Schedule")}
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={scheduleType}
                onChange={(v) => setScheduleType(v as "interval" | "cron" | "once")}
                options={[
                  { value: "interval", label: l10n.t("Interval") },
                  { value: "cron", label: l10n.t("Cron Expression") },
                  { value: "once", label: l10n.t("Run Once") },
                ]}
                className="h-8 flex-1"
              />
              {scheduleType === "interval" && (
                <div className="flex items-center gap-1.5">
                  <InputBox
                    type="number"
                    value={intervalMin}
                    onChange={(e) => setIntervalMin(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 text-[12px] rounded-md bg-background w-16"
                    min={1}
                  />
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {l10n.t("min")}
                  </span>
                </div>
              )}
              {scheduleType === "cron" && (
                <InputBox
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  placeholder="*/5 * * * *"
                  className="h-8 text-[12px] rounded-md bg-background font-mono flex-1"
                />
              )}
              {scheduleType === "once" && (
                <InputBox
                  type="datetime-local"
                  value={runAt}
                  onChange={(e) => setRunAt(e.target.value)}
                  className="h-8 text-[12px] rounded-md bg-background flex-1"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {l10n.t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-medium transition-all",
              canSubmit
                ? "bg-foreground text-background hover:opacity-90"
                : "bg-foreground/10 text-foreground/30 cursor-not-allowed",
            )}
          >
            <PlusIcon className="w-3 h-3" />
            {l10n.t("Create")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AutomationUsageDialog — how-to-use guide
// ---------------------------------------------------------------------------

const USAGE_STEPS = [
  {
    icon: PlusIcon,
    title: "Create a Task",
    desc: 'Click "Shell" or "Prompt" to create a new automation task. Shell tasks run terminal commands; Prompt tasks send instructions to your AI agent.',
  },
  {
    icon: SettingsIcon,
    title: "Configure Schedule",
    desc: "Choose how your task runs: at a fixed interval (e.g. every 5 minutes), on a cron expression, or a one-time run at a specific date & time.",
  },
  {
    icon: BotIcon,
    title: "Define the Action",
    desc: "For Shell tasks, enter the command to execute. For Prompt tasks, write the natural language instruction your agent should carry out.",
  },
  {
    icon: ZapIcon,
    title: "Enable & Monitor",
    desc: 'Toggle a task on to start scheduling. Use "Run Now" to test immediately. Check the Status section for last run results and errors.',
  },
];

function AutomationUsageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={l10n.t("How Automation Works")}
        description={l10n.t("Create tasks that run automatically on your schedule")}
        maxWidth="md"
      >
        <div className="space-y-1 -mx-1">
          {USAGE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3.5 px-3 py-3 rounded-xl hover:bg-foreground/[0.02] transition-colors"
              >
                {/* Step number + icon */}
                <div className="w-8 h-8 rounded-lg bg-foreground/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[13px] font-medium text-foreground leading-snug">
                      {l10n.t(step.title)}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {l10n.t(step.desc)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        <div className="border-t border-border pt-4 mt-2">
          <div className="px-3 py-2.5 rounded-xl bg-foreground/[0.02] border border-border">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-muted-foreground">{l10n.t("Tip:")}</span>{" "}
              {l10n.t(
                "Interval tasks keep running while the app is open. Cron expressions follow standard 5-field syntax (minute, hour, day, month, weekday). Tasks pause automatically when the app is closed.",
              )}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
