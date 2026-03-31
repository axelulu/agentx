import { readJsonFile, writeJsonFile } from "./json-helpers";
import type { NotifyFn, MutationOptions } from "./collection-store";

/**
 * Generic singleton store for persisting a single value (preferences, permissions, etc.).
 * Provides get/set/merge operations with atomic file writes and optional change notifications.
 *
 * Change events are NOT emitted by default to avoid race conditions with
 * the frontend's optimistic Redux updates.
 */
export class SingletonStore<T extends object> {
  private filePath: string;
  private notifyFn: NotifyFn;
  private eventPrefix: string;
  private defaults: T;
  private onSync?: (value: T) => void;

  constructor(
    filePath: string,
    notify: NotifyFn,
    eventPrefix: string,
    defaults: T,
    onSync?: (value: T) => void,
  ) {
    this.filePath = filePath;
    this.notifyFn = notify;
    this.eventPrefix = eventPrefix;
    this.defaults = defaults;
    this.onSync = onSync;
  }

  get(): T {
    return readJsonFile<T>(this.filePath, this.defaults);
  }

  set(value: T, options?: MutationOptions): void {
    writeJsonFile(this.filePath, value);
    this.onSync?.(value);
    if (options?.notify) this.emitChanged(value);
  }

  merge(partial: Partial<T>, options?: MutationOptions): T {
    const current = this.get();
    const merged = { ...current, ...partial } as T;
    writeJsonFile(this.filePath, merged);
    this.onSync?.(merged);
    if (options?.notify) this.emitChanged(merged);
    return merged;
  }

  /** Read current value without emitting events (for initialization). */
  load(): T {
    return this.get();
  }

  /** Emit a changed event explicitly (for sidecar-originated mutations). */
  emitChanged(value?: T): void {
    this.notifyFn(`${this.eventPrefix}:changed`, value ?? this.get());
  }
}
