import { EventStream } from "./event-stream.js";
import { composeMiddleware } from "./middleware.js";
import { convertToLlmMessages, convertToolsToLlm } from "./providers/message-builder.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { executeTools } from "./tool-executor.js";
import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  AgentResult,
  AssistantMessage,
  LLMMessage,
  StreamFn,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "./types.js";

const DEFAULT_MAX_TURNS = 50;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Core agent loop — stateless pure function.
 *
 * Takes user input, runs LLM → tool → LLM cycles, emits events.
 * Returns an EventStream that can be consumed as an async iterable.
 */
export function agentLoop(
  input: string | UserMessage | UserMessage[] | AgentMessage[],
  config: AgentConfig,
  signal?: AbortSignal,
): EventStream<AgentEvent> {
  const stream = new EventStream<AgentEvent>();

  // Run the loop asynchronously
  runLoop(input, config, signal, stream).catch((err) => {
    stream.push({
      type: "error",
      error: err instanceof Error ? err : new Error(String(err)),
      fatal: true,
      timestamp: Date.now(),
    });
    stream.complete({
      messages: [],
      turns: 0,
      aborted: false,
      error: err instanceof Error ? err : new Error(String(err)),
    });
  });

  return stream;
}

async function runLoop(
  input: string | UserMessage | UserMessage[] | AgentMessage[],
  config: AgentConfig,
  signal: AbortSignal | undefined,
  stream: EventStream<AgentEvent>,
): Promise<void> {
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;

  // Resolve streamFn
  const streamFn: StreamFn =
    config.streamFn ??
    createOpenAIProvider({
      getApiKey: config.getApiKey,
      baseUrl: config.baseUrl,
    });

  // Normalize input to AgentMessage[]
  const initialMessages = normalizeInput(input);

  // Message history (internal)
  const messages: AgentMessage[] = [...initialMessages];

  // Build tool map
  const toolMap = new Map(config.tools.map((t) => [t.name, t]));
  const toolDefs = convertToolsToLlm(config.tools);

  // Compose middleware if any
  const middleware =
    config.middleware && config.middleware.length > 0
      ? composeMiddleware(...config.middleware)
      : null;

  const emit = (event: AgentEvent) => stream.push(event);

  emit({ type: "agent_start", timestamp: Date.now() });

  let turn = 0;

  while (turn < maxTurns) {
    if (signal?.aborted) break;

    turn++;
    emit({ type: "turn_start", turn, timestamp: Date.now() });

    // Convert messages to LLM format
    const converter = config.convertToLlm ?? convertToLlmMessages;
    let llmMessages: LLMMessage[] = converter(messages);

    // Prepend system prompt
    llmMessages = [{ role: "system" as const, content: config.systemPrompt }, ...llmMessages];

    // Apply transformContext
    if (config.transformContext) {
      llmMessages = await config.transformContext(llmMessages);
    }

    // Middleware: beforeModelCall
    if (middleware?.beforeModelCall) {
      const result = await middleware.beforeModelCall({
        messages: llmMessages,
        config,
        turn,
      });
      if (result) llmMessages = result;
    }

    // Call LLM stream
    const messageId = `msg_${turn}_${Date.now()}`;
    emit({ type: "message_start", messageId, timestamp: Date.now() });

    let contentAccum = "";
    const toolCallAccum = new Map<number, { id: string; name: string; arguments: string }>();

    try {
      for await (const chunk of streamFn(llmMessages, {
        model: config.model,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        maxTokens,
        temperature,
        toolChoice: config.toolChoice,
        signal,
      })) {
        if (signal?.aborted) break;

        switch (chunk.type) {
          case "content_delta":
            contentAccum += chunk.delta;
            emit({
              type: "message_delta",
              messageId,
              delta: chunk.delta,
              timestamp: Date.now(),
            });
            break;

          case "tool_call_delta": {
            let entry = toolCallAccum.get(chunk.index);
            if (!entry) {
              entry = { id: "", name: "", arguments: "" };
              toolCallAccum.set(chunk.index, entry);
            }
            if (chunk.id) entry.id = chunk.id;
            if (chunk.name) entry.name = chunk.name;
            entry.arguments += chunk.argumentsDelta;
            break;
          }

          case "usage":
            emit({
              type: "usage",
              inputTokens: chunk.inputTokens,
              outputTokens: chunk.outputTokens,
              timestamp: Date.now(),
            });
            break;

          case "done":
            break;
        }
      }
    } catch (err) {
      if (signal?.aborted) break;

      const error = err instanceof Error ? err : new Error(String(err));
      emit({ type: "error", error, fatal: false, timestamp: Date.now() });

      // Add error as assistant message and break
      const errorAssistant: AssistantMessage = {
        role: "assistant",
        content: `Error calling model: ${error.message}`,
      };
      messages.push(errorAssistant);
      break;
    }

    // Build assistant message
    const toolCalls: ToolCall[] = [];
    for (const [, entry] of [...toolCallAccum.entries()].sort(([a], [b]) => a - b)) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(entry.arguments || "{}") as Record<string, unknown>;
      } catch {
        parsedArgs = { _raw: entry.arguments };
      }
      toolCalls.push({
        id: entry.id,
        name: entry.name,
        arguments: parsedArgs,
      });
    }

    const assistantMsg: AssistantMessage = {
      role: "assistant",
      content: contentAccum || null,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    };

    emit({
      type: "message_end",
      messageId,
      content: contentAccum,
      timestamp: Date.now(),
    });

    messages.push(assistantMsg);

    // Middleware: afterModelCall
    if (middleware?.afterModelCall) {
      const shouldStop = await middleware.afterModelCall({
        messages: llmMessages,
        config,
        turn,
        response: assistantMsg,
      });
      if (shouldStop === true) {
        emit({ type: "turn_end", turn, continueLoop: false, timestamp: Date.now() });
        break;
      }
    }

    // No tool calls → conversation complete
    if (!assistantMsg.toolCalls || assistantMsg.toolCalls.length === 0) {
      emit({ type: "turn_end", turn, continueLoop: false, timestamp: Date.now() });
      break;
    }

    // Execute tools
    const toolResults = await executeTools(
      assistantMsg.toolCalls,
      toolMap,
      signal ?? new AbortController().signal,
      emit,
    );

    // Add tool results to message history
    for (const { toolCallId, result } of toolResults) {
      const toolResultMsg: ToolResultMessage = {
        role: "tool",
        toolCallId,
        content: result.content,
        isError: result.isError,
      };
      messages.push(toolResultMsg);
    }

    // Check if any executed tool is a terminal tool (e.g. task_complete)
    const hasTerminal = assistantMsg.toolCalls!.some((tc) => {
      const tool = toolMap.get(tc.name);
      return tool && "toolType" in tool && tool.toolType === "terminal";
    });

    if (hasTerminal) {
      emit({ type: "turn_end", turn, continueLoop: false, timestamp: Date.now() });
      break;
    }

    emit({ type: "turn_end", turn, continueLoop: true, timestamp: Date.now() });
  }

  const aborted = signal?.aborted ?? false;

  const result: AgentResult = {
    messages,
    turns: turn,
    aborted,
  };

  emit({ type: "agent_end", result, timestamp: Date.now() });
  stream.complete(result);
}

function normalizeInput(
  input: string | UserMessage | UserMessage[] | AgentMessage[],
): AgentMessage[] {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }
  if (Array.isArray(input)) {
    return input;
  }
  return [input];
}
