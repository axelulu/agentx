import { readJsonFile, writeJsonFile } from "./json-helpers";

export type NotifyFn = (event: string, data: unknown) => void;

export interface MutationOptions {
  /** If true, emit a {prefix}:changed event after the mutation. Default: false. */
  notify?: boolean;
}

/**
 * Generic collection store for persisting arrays of items with an `id` field.
 * Provides CRUD operations with atomic file writes and optional change notifications.
 *
 * Change events are NOT emitted by default to avoid race conditions with
 * the frontend's optimistic Redux updates. Only sidecar-originated mutations
 * (e.g., channel auto-config, scheduler completion) should pass { notify: true }.
 */
export class CollectionStore<T extends { id: string }> {
  private filePath: string;
  private notifyFn: NotifyFn;
  private eventPrefix: string;
  private onSync?: (items: T[]) => void;

  constructor(
    filePath: string,
    notify: NotifyFn,
    eventPrefix: string,
    onSync?: (items: T[]) => void,
  ) {
    this.filePath = filePath;
    this.notifyFn = notify;
    this.eventPrefix = eventPrefix;
    this.onSync = onSync;
  }

  list(): T[] {
    return readJsonFile<T[]>(this.filePath, []);
  }

  get(id: string): T | undefined {
    return this.list().find((item) => item.id === id);
  }

  set(item: T, options?: MutationOptions): void {
    const items = this.list();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    writeJsonFile(this.filePath, items);
    this.onSync?.(items);
    if (options?.notify) this.emitChanged(items);
  }

  remove(id: string, options?: MutationOptions): void {
    const items = this.list().filter((i) => i.id !== id);
    writeJsonFile(this.filePath, items);
    this.onSync?.(items);
    if (options?.notify) this.emitChanged(items);
  }

  replace(items: T[], options?: MutationOptions): void {
    writeJsonFile(this.filePath, items);
    this.onSync?.(items);
    if (options?.notify) this.emitChanged(items);
  }

  /** Read current items without emitting events (for initialization). */
  load(): T[] {
    return this.list();
  }

  /** Emit a changed event explicitly (for sidecar-originated mutations). */
  emitChanged(items?: T[]): void {
    this.notifyFn(`${this.eventPrefix}:changed`, items ?? this.list());
  }
}
