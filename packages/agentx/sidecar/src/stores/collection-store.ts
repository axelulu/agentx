import { readJsonFile, writeJsonFile } from "./json-helpers";

export type NotifyFn = (event: string, data: unknown) => void;

/**
 * Generic collection store for persisting arrays of items with an `id` field.
 * Provides CRUD operations with atomic file writes and change notifications.
 */
export class CollectionStore<T extends { id: string }> {
  private filePath: string;
  private notify: NotifyFn;
  private eventPrefix: string;
  private onSync?: (items: T[]) => void;

  constructor(
    filePath: string,
    notify: NotifyFn,
    eventPrefix: string,
    onSync?: (items: T[]) => void,
  ) {
    this.filePath = filePath;
    this.notify = notify;
    this.eventPrefix = eventPrefix;
    this.onSync = onSync;
  }

  list(): T[] {
    return readJsonFile<T[]>(this.filePath, []);
  }

  get(id: string): T | undefined {
    return this.list().find((item) => item.id === id);
  }

  set(item: T): void {
    const items = this.list();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    writeJsonFile(this.filePath, items);
    this.onSync?.(items);
    this.emitChanged(items);
  }

  remove(id: string): void {
    const items = this.list().filter((i) => i.id !== id);
    writeJsonFile(this.filePath, items);
    this.onSync?.(items);
    this.emitChanged(items);
  }

  replace(items: T[]): void {
    writeJsonFile(this.filePath, items);
    this.onSync?.(items);
    this.emitChanged(items);
  }

  /** Read current items without emitting events (for initialization). */
  load(): T[] {
    return this.list();
  }

  private emitChanged(items: T[]): void {
    this.notify(`${this.eventPrefix}:changed`, items);
  }
}
