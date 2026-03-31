import type { AgentRuntime, ScheduledTask } from "@agentx/runtime";
import { CollectionStore, type NotifyFn, writeJsonFile } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function createSchedulerStore(
  filePath: string,
  notify: NotifyFn,
): CollectionStore<ScheduledTask> {
  // Note: onSync is handled separately via runtime.setScheduledTasks
  return new CollectionStore<ScheduledTask>(filePath, notify, "scheduler");
}

export function registerSchedulerHandlers(
  handlers: HandlerMap,
  store: CollectionStore<ScheduledTask>,
  runtime: AgentRuntime,
): void {
  handlers["scheduler:list"] = () => store.list();
  handlers["scheduler:set"] = (task: ScheduledTask) => {
    store.set(task);
    runtime.setScheduledTasks(store.list());
  };
  handlers["scheduler:remove"] = (id: string) => {
    store.remove(id);
    runtime.setScheduledTasks(store.list());
  };
  handlers["scheduler:runNow"] = async (id: string) => {
    const manager = runtime?.getScheduledTaskManager();
    if (manager) await manager.runNow(id);
  };
}

export function setupSchedulerCallbacks(
  runtime: AgentRuntime,
  schedulerPath: string,
  notify: NotifyFn,
  savedTasks: ScheduledTask[],
): void {
  const taskLastRunAt = new Map<string, number>();
  for (const t of savedTasks) {
    if (t.lastRunAt) taskLastRunAt.set(t.id, t.lastRunAt);
  }

  runtime.setSchedulerPersistFn((tasks) => {
    writeJsonFile(schedulerPath, tasks);
  });

  runtime.setSchedulerStatusHandler((update) => {
    writeJsonFile(schedulerPath, update.tasks);
    notify("scheduler:statusUpdate", update.tasks);
    notify("scheduler:changed", update.tasks);

    for (const task of update.tasks) {
      if (task.lastRunAt) {
        const prev = taskLastRunAt.get(task.id);
        if (prev !== undefined && prev !== task.lastRunAt) {
          notify("notification:show", {
            title: task.lastRunError ? `❌ ${task.title}` : `✅ ${task.title}`,
            body: (task.lastRunError ?? task.lastRunResult ?? "Completed").slice(0, 120),
          });
        }
        taskLastRunAt.set(task.id, task.lastRunAt);
      }
    }
  });
}
