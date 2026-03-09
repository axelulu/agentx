import OpenAI from "openai";
import type { LLMMessage, LLMStreamChunk, StreamFn, StreamFnOptions } from "../types.js";
import type { ProviderConfig } from "./types.js";

/**
 * Create a StreamFn backed by the OpenAI SDK.
 * Compatible with OpenRouter, Azure, local vLLM, or any OpenAI-compatible endpoint.
 */
export function createOpenAIProvider(config: ProviderConfig): StreamFn {
  let clientInstance: OpenAI | null = null;

  async function getClient(): Promise<OpenAI> {
    if (clientInstance) return clientInstance;

    const apiKey = config.apiKey ?? (config.getApiKey ? await config.getApiKey() : "");
    clientInstance = new OpenAI({
      apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    return clientInstance;
  }

  return async function* streamFn(
    messages: LLMMessage[],
    options: StreamFnOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const client = await getClient();

    let stream;
    try {
      stream = await client.chat.completions.create(
        {
          model: options.model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          stream: true,
          ...(options.tools && options.tools.length > 0
            ? {
                tools: options.tools as OpenAI.ChatCompletionTool[],
                tool_choice: options.toolChoice ?? "auto",
              }
            : {}),
          ...(options.maxTokens != null ? { max_tokens: options.maxTokens } : {}),
          ...(options.temperature != null ? { temperature: options.temperature } : {}),
          stream_options: { include_usage: true },
        },
        {
          signal: options.signal,
        },
      );
    } catch (err) {
      console.error(
        "[OpenAI] API error:",
        err instanceof Error ? err.message : err,
        "\n[OpenAI] Messages summary:",
        messages
          .map((m, i) => {
            const role = m.role;
            const tc =
              role === "assistant" && "tool_calls" in m && m.tool_calls
                ? ` [${m.tool_calls.length} tool_calls]`
                : "";
            const tcId =
              role === "tool" && "tool_call_id" in m ? ` (tool_call_id=${m.tool_call_id})` : "";
            const content =
              "content" in m
                ? typeof m.content === "string"
                  ? m.content.slice(0, 50)
                  : String(m.content)
                : "";
            return `  ${i}: ${role}${tc}${tcId} content=${content}`;
          })
          .join("\n"),
      );
      throw err;
    }

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];

      if (choice?.delta?.content) {
        yield { type: "content_delta", delta: choice.delta.content };
      }

      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          yield {
            type: "tool_call_delta",
            index: tc.index,
            id: tc.id ?? undefined,
            name: tc.function?.name ?? undefined,
            argumentsDelta: tc.function?.arguments ?? "",
          };
        }
      }

      if (chunk.usage) {
        yield {
          type: "usage",
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        };
      }
    }

    yield { type: "done" };
  };
}
