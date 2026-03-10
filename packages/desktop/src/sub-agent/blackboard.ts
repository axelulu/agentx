/**
 * Blackboard — shared in-memory key-value store for inter-agent communication.
 *
 * Created per orchestration batch. Each sub-agent in the batch receives
 * tools to read/write entries. All operations are synchronous (same process)
 * and safe for concurrent access (single-threaded JS event loop).
 *
 * Supports:
 * - key-value put/get with agent attribution
 * - list all entries (or filtered by agent / key prefix)
 * - wait-for-key (async, with timeout) so an agent can block until
 *   a dependency publishes a result
 */

import type { BlackboardEntry } from "./types.js";

export class Blackboard {
  private entries = new Map<string, BlackboardEntry>();
  private waiters = new Map<
    string,
    Array<{ resolve: (entry: BlackboardEntry) => void; timer: ReturnType<typeof setTimeout> }>
  >();

  put(key: string, value: string, agentId: string): void {
    const entry: BlackboardEntry = {
      key,
      value,
      agentId,
      timestamp: Date.now(),
    };
    this.entries.set(key, entry);

    // Notify any waiters for this key
    const waiting = this.waiters.get(key);
    if (waiting) {
      for (const w of waiting) {
        clearTimeout(w.timer);
        w.resolve(entry);
      }
      this.waiters.delete(key);
    }
  }

  get(key: string): BlackboardEntry | undefined {
    return this.entries.get(key);
  }

  /**
   * List entries, optionally filtered by key prefix or agent ID.
   */
  list(filter?: { prefix?: string; agentId?: string }): BlackboardEntry[] {
    const results: BlackboardEntry[] = [];
    for (const entry of this.entries.values()) {
      if (filter?.prefix && !entry.key.startsWith(filter.prefix)) continue;
      if (filter?.agentId && entry.agentId !== filter.agentId) continue;
      results.push(entry);
    }
    return results;
  }

  /**
   * Wait for a key to be set. Returns immediately if already present.
   * Times out after `timeoutMs` (default: 60s).
   */
  waitFor(key: string, timeoutMs = 60_000): Promise<BlackboardEntry> {
    const existing = this.entries.get(key);
    if (existing) return Promise.resolve(existing);

    return new Promise<BlackboardEntry>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove this waiter
        const list = this.waiters.get(key);
        if (list) {
          const idx = list.findIndex((w) => w.timer === timer);
          if (idx >= 0) list.splice(idx, 1);
          if (list.length === 0) this.waiters.delete(key);
        }
        reject(new Error(`Blackboard: timeout waiting for key "${key}" after ${timeoutMs}ms`));
      }, timeoutMs);

      if (!this.waiters.has(key)) this.waiters.set(key, []);
      this.waiters.get(key)!.push({ resolve, timer });
    });
  }

  /** Number of entries */
  get size(): number {
    return this.entries.size;
  }

  /** Clear all entries and reject pending waiters */
  clear(): void {
    this.entries.clear();
    for (const [, waiters] of this.waiters) {
      for (const w of waiters) {
        clearTimeout(w.timer);
      }
    }
    this.waiters.clear();
  }
}
