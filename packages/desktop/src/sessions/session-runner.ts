import {
  agentLoop,
  type AgentConfig,
  type AgentMessage,
  type StreamFn,
  type AgentTool,
  type AgentMiddleware,
} from "@workspace/agent";
import { toSerializableEvent } from "./event-bridge.js";
import type { SerializableAgentEvent } from "../types.js";

export interface SessionRunnerConfig {
  model: string;
  systemPrompt: string;
  tools: AgentTool[];
  streamFn: StreamFn;
  middleware?: AgentMiddleware[];
  maxTurns?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Manages a single agent execution session.
 * Uses the stateless agentLoop directly since we manage history externally.
 * Bridges AgentEvents to serializable IPC events.
 */
export class SessionRunner {
  private abortController: AbortController | null = null;

  async run(
    messages: AgentMessage[],
    config: SessionRunnerConfig,
    conversationId: string,
    onEvent: (event: SerializableAgentEvent) => void,
  ): Promise<AgentMessage[]> {
    this.abortController = new AbortController();

    const agentConfig: AgentConfig = {
      model: config.model,
      systemPrompt: config.systemPrompt,
      tools: config.tools,
      streamFn: config.streamFn,
      middleware: config.middleware,
      maxTurns: config.maxTurns ?? 25,
      maxTokens: config.maxTokens ?? 8192,
      temperature: config.temperature ?? 0.7,
    };

    const stream = agentLoop(messages, agentConfig, this.abortController.signal);

    // Consume events and bridge to serializable format
    for await (const event of stream) {
      onEvent(toSerializableEvent(event, conversationId));
    }

    // Get the final result
    const result = await stream.result();
    this.abortController = null;

    return result.messages;
  }

  abort(): void {
    this.abortController?.abort();
  }

  get isRunning(): boolean {
    return this.abortController !== null;
  }
}
