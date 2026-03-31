import { readJsonFile, writeJsonFile } from "./json-helpers";
import type { NotifyFn } from "./collection-store";

/**
 * Generic singleton store for persisting a single value (preferences, permissions, etc.).
 * Provides get/set/merge operations with atomic file writes and change notifications.
 */
export class SingletonStore<T extends object> {
  private filePath: string;
  private notify: NotifyFn;
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
    this.notify = notify;
    this.eventPrefix = eventPrefix;
    this.defaults = defaults;
    this.onSync = onSync;
  }

  get(): T {
    return readJsonFile<T>(this.filePath, this.defaults);
  }

  set(value: T): void {
    writeJsonFile(this.filePath, value);
    this.onSync?.(value);
    this.emitChanged(value);
  }

  merge(partial: Partial<T>): T {
    const current = this.get();
    const merged = { ...current, ...partial } as T;
    writeJsonFile(this.filePath, merged);
    this.onSync?.(merged);
    this.emitChanged(merged);
    return merged;
  }

  /** Read current value without emitting events (for initialization). */
  load(): T {
    return this.get();
  }

  private emitChanged(value: T): void {
    this.notify(`${this.eventPrefix}:changed`, value);
  }
}
