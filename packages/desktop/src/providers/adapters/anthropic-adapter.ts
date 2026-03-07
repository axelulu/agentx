import type { StreamFn, LLMMessage, StreamFnOptions, LLMStreamChunk } from "@workspace/agent";

interface AnthropicAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Create a StreamFn that calls Anthropic's Messages API directly.
 * Uses fetch to avoid an additional SDK dependency.
 */
export function createAnthropicStreamFn(config: AnthropicAdapterConfig): StreamFn {
  const baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  const defaultModel = config.defaultModel ?? "claude-sonnet-4-20250514";

  return async function* anthropicStream(
    messages: LLMMessage[],
    options: StreamFnOptions,
  ): AsyncIterable<LLMStreamChunk> {
    // Separate system message
    const systemContent = messages
      .filter((m) => m.role === "system")
      .map((m) => (m as { content: string }).content)
      .join("\n\n");

    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    // Convert messages to Anthropic format
    const anthropicMessages = nonSystemMessages.map((msg) => convertMessage(msg));

    // Convert tools to Anthropic format
    const tools = options.tools?.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    const body: Record<string, unknown> = {
      model: options.model || defaultModel,
      max_tokens: options.maxTokens ?? 8192,
      messages: anthropicMessages,
      stream: true,
    };

    if (systemContent) {
      body.system = systemContent;
    }
    if (tools && tools.length > 0) {
      body.tools = tools;
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.toolChoice) {
      body.tool_choice = convertToolChoice(options.toolChoice);
    }

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let toolCallIndex = -1;
    const toolCallIds = new Map<number, string>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data) as Record<string, unknown>;
          } catch {
            continue;
          }

          const chunks = parseAnthropicEvent(event, toolCallIndex, toolCallIds);
          for (const chunk of chunks) {
            if (chunk.type === "tool_call_delta" && chunk.id) {
              toolCallIndex = chunk.index;
            }
            yield chunk;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  };
}

function convertMessage(msg: LLMMessage): Record<string, unknown> {
  if (msg.role === "assistant") {
    const content: unknown[] = [];
    if (msg.content) {
      content.push({ type: "text", text: msg.content });
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }
    return { role: "assistant", content };
  }

  if (msg.role === "tool") {
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        },
      ],
    };
  }

  // User messages
  return { role: msg.role, content: msg.content };
}

function convertToolChoice(choice: "auto" | "required" | "none"): Record<string, unknown> {
  switch (choice) {
    case "auto":
      return { type: "auto" };
    case "required":
      return { type: "any" };
    case "none":
      return { type: "none" };
  }
}

function parseAnthropicEvent(
  event: Record<string, unknown>,
  currentToolIndex: number,
  toolCallIds: Map<number, string>,
): LLMStreamChunk[] {
  const type = event.type as string;
  const chunks: LLMStreamChunk[] = [];

  switch (type) {
    case "content_block_start": {
      const block = event.content_block as Record<string, unknown>;
      if (block?.type === "tool_use") {
        const idx = (event.index as number) ?? currentToolIndex + 1;
        const id = block.id as string;
        const name = block.name as string;
        toolCallIds.set(idx, id);
        chunks.push({
          type: "tool_call_delta",
          index: idx,
          id,
          name,
          argumentsDelta: "",
        });
      }
      break;
    }
    case "content_block_delta": {
      const delta = event.delta as Record<string, unknown>;
      if (delta?.type === "text_delta") {
        chunks.push({
          type: "content_delta",
          delta: delta.text as string,
        });
      } else if (delta?.type === "input_json_delta") {
        const idx = (event.index as number) ?? currentToolIndex;
        chunks.push({
          type: "tool_call_delta",
          index: idx,
          argumentsDelta: delta.partial_json as string,
        });
      }
      break;
    }
    case "message_delta": {
      const usage = (event as Record<string, Record<string, number>>).usage;
      if (usage) {
        chunks.push({
          type: "usage",
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        });
      }
      break;
    }
  }

  return chunks;
}
