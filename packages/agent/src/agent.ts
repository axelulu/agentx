import { agentLoop } from "./agent-loop.js";
import type { AgentConfig, AgentEvent, AgentMessage, AgentState, UserMessage } from "./types.js";

/**
 * Stateful Agent class — user-friendly wrapper around the core loop.
 *
 * Maintains message history across prompts, supports subscriptions,
 * abort, steer, and follow-up capabilities.
 */
export class Agent {
  private config: AgentConfig;
  private messageHistory: AgentMessage[] = [];
  private abortController: AbortController | null = null;
  private subscribers = new Set<(event: AgentEvent) => void>();
  private running = false;
  private currentTurn = 0;
  private pendingSteer: UserMessage[] = [];
  private followUpQueue: UserMessage[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Send a message and run the full agent loop.
   * Returns the complete message history after execution.
   */
  async prompt(
    input: string | UserMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<AgentMessage[]> {
    if (this.running) {
      throw new Error("Agent is already running. Use followUp() to queue messages.");
    }

    this.running = true;
    this.abortController = new AbortController();

    // Link external signal if provided
    if (options?.signal) {
      options.signal.addEventListener("abort", () => this.abortController?.abort(), {
        once: true,
      });
    }

    // Normalize input
    const userMessages: UserMessage[] =
      typeof input === "string" ? [{ role: "user", content: input }] : input;

    // Append to history
    this.messageHistory.push(...userMessages);

    try {
      await this.runWithHistory();

      // Process follow-up queue
      while (this.followUpQueue.length > 0) {
        const nextMessages = this.followUpQueue.splice(0, this.followUpQueue.length);
        this.messageHistory.push(...nextMessages);
        await this.runWithHistory();
      }
    } finally {
      this.running = false;
      this.abortController = null;
      this.currentTurn = 0;
    }

    return [...this.messageHistory];
  }

  /**
   * Inject a steering message into the current execution.
   * Will be added as a user message before the next LLM call.
   */
  steer(message: string | UserMessage): void {
    const msg: UserMessage =
      typeof message === "string" ? { role: "user", content: message } : message;
    this.pendingSteer.push(msg);
  }

  /**
   * Queue a follow-up message to run after current execution completes.
   */
  followUp(message: string | UserMessage): void {
    const msg: UserMessage =
      typeof message === "string" ? { role: "user", content: message } : message;
    this.followUpQueue.push(msg);
  }

  /**
   * Abort the current execution.
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Subscribe to agent events. Returns an unsubscribe function.
   */
  subscribe(fn: (event: AgentEvent) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Read-only state snapshot.
   */
  get state(): AgentState {
    return {
      messages: [...this.messageHistory],
      isRunning: this.running,
      currentTurn: this.currentTurn,
    };
  }

  private async runWithHistory(): Promise<void> {
    // Inject steer support via transformContext
    const originalTransform = this.config.transformContext;
    const { pendingSteer } = this;

    const configWithSteer: AgentConfig = {
      ...this.config,
      transformContext: async (messages) => {
        // Inject pending steer messages
        let result = messages;
        if (pendingSteer.length > 0) {
          const steerLlm = pendingSteer.map((m) => ({
            role: "user" as const,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          }));
          pendingSteer.length = 0;
          result = [...result, ...steerLlm];
        }

        // Chain original transform
        if (originalTransform) {
          result = await originalTransform(result);
        }
        return result;
      },
    };

    const stream = agentLoop(this.messageHistory, configWithSteer, this.abortController?.signal);

    for await (const event of stream) {
      if (event.type === "turn_start") {
        this.currentTurn = event.turn;
      }

      // Notify all subscribers
      for (const fn of this.subscribers) {
        try {
          fn(event);
        } catch {
          // Subscriber errors should not break the loop
        }
      }
    }

    // Update message history from result
    const result = await stream.result();
    this.messageHistory = [...result.messages];
  }
}
