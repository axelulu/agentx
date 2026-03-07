import type { AgentResult } from "./types.js";

/**
 * Push-based async iterable event stream.
 *
 * Producers push events via `push()`, consumers iterate with `for await`.
 * Backpressure is handled with an internal queue + resolvers.
 */
export class EventStream<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private waiting: ((value: IteratorResult<T>) => void) | null = null;
  private done = false;
  private error: Error | null = null;
  private _result: AgentResult | null = null;
  private resultResolve: ((result: AgentResult) => void) | null = null;
  private resultReject: ((error: Error) => void) | null = null;
  private resultPromise: Promise<AgentResult>;

  constructor() {
    this.resultPromise = new Promise<AgentResult>((resolve, reject) => {
      this.resultResolve = resolve;
      this.resultReject = reject;
    });
  }

  /** Push an event to the stream. */
  push(event: T): void {
    if (this.done) return;

    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: event, done: false });
    } else {
      this.queue.push(event);
    }
  }

  /** Mark the stream as complete with a result. */
  complete(result: AgentResult): void {
    if (this.done) return;
    this.done = true;
    this._result = result;
    this.resultResolve?.(result);

    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  /** Abort the stream with an error. */
  abort(err: Error): void {
    if (this.done) return;
    this.done = true;
    this.error = err;

    const abortResult: AgentResult = {
      messages: [],
      turns: 0,
      aborted: true,
      error: err,
    };
    this._result = abortResult;
    this.resultResolve?.(abortResult);

    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  /** Get the final result (resolves when stream completes). */
  result(): Promise<AgentResult> {
    return this.resultPromise;
  }

  /** Whether the stream has ended. */
  get isComplete(): boolean {
    return this.done;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        // Drain queued items first
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }

        // Stream ended
        if (this.done) {
          return Promise.resolve({
            value: undefined as unknown as T,
            done: true,
          });
        }

        // Wait for next push
        return new Promise<IteratorResult<T>>((resolve) => {
          this.waiting = resolve;
        });
      },
    };
  }
}
