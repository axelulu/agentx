import type { CollectionStore } from "../stores/collection-store";
import type { SingletonStore } from "../stores/singleton-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerMap = Record<string, (...args: any[]) => Promise<unknown> | unknown>;

/**
 * Register standard CRUD handlers for a CollectionStore.
 * Registers: `${prefix}:list`, `${prefix}:set`, `${prefix}:remove`
 */
export function registerCollectionHandlers<T extends { id: string }>(
  handlers: HandlerMap,
  prefix: string,
  store: CollectionStore<T>,
): void {
  handlers[`${prefix}:list`] = () => store.list();
  handlers[`${prefix}:set`] = (item: T) => {
    store.set(item);
    return { success: true };
  };
  handlers[`${prefix}:remove`] = (id: string) => {
    store.remove(id);
    return { success: true };
  };
}

/**
 * Register standard get/set handlers for a SingletonStore.
 * Registers: `${prefix}:get`, `${prefix}:set`
 */
export function registerSingletonHandlers<T extends object>(
  handlers: HandlerMap,
  prefix: string,
  store: SingletonStore<T>,
): void {
  handlers[`${prefix}:get`] = () => store.get();
  handlers[`${prefix}:set`] = (value: T) => {
    store.set(value);
    return { success: true };
  };
}
