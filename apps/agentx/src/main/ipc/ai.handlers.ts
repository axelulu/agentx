import { ipcMain } from "electron";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  provider: string;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export function registerAIHandlers(): void {
  // Non-streaming chat
  ipcMain.handle("ai:chat", async (_event, request: ChatRequest) => {
    const { provider, model, apiKey, messages, temperature, maxTokens } =
      request;

    const url = getProviderURL(provider);
    const headers = getProviderHeaders(provider, apiKey);

    const body = {
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      stream: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data;
  });

  // Streaming chat
  ipcMain.on("ai:stream", async (event, request: ChatRequest) => {
    const { provider, model, apiKey, messages, temperature, maxTokens } =
      request;

    try {
      const url = getProviderURL(provider);
      const headers = getProviderHeaders(provider, apiKey);

      const body = {
        model,
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096,
        stream: true,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        event.sender.send("ai:stream:error", {
          error: `AI API error (${response.status}): ${error}`,
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        event.sender.send("ai:stream:error", {
          error: "No response body",
        });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            event.sender.send("ai:stream:done");
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content =
              parsed.choices?.[0]?.delta?.content ||
              parsed.candidates?.[0]?.content?.parts?.[0]?.text ||
              "";

            if (content) {
              event.sender.send("ai:stream:data", { content });
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      event.sender.send("ai:stream:done");
    } catch (error) {
      event.sender.send("ai:stream:error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // List available models
  ipcMain.handle("ai:list-models", async () => {
    return {
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          models: [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
          ],
        },
        {
          id: "anthropic",
          name: "Anthropic",
          models: [
            "claude-opus-4-20250514",
            "claude-sonnet-4-20250514",
            "claude-haiku-4-20250514",
          ],
        },
        {
          id: "gemini",
          name: "Google Gemini",
          models: [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
          ],
        },
        {
          id: "openrouter",
          name: "OpenRouter",
          models: [],
        },
      ],
    };
  });
}

function getProviderURL(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function getProviderHeaders(
  provider: string,
  apiKey: string
): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  };

  switch (provider) {
    case "openai":
    case "openrouter":
      base["Authorization"] = `Bearer ${apiKey}`;
      break;
    case "anthropic":
      base["x-api-key"] = apiKey;
      base["anthropic-version"] = "2023-06-01";
      break;
    case "gemini":
      base["Authorization"] = `Bearer ${apiKey}`;
      break;
  }

  return base;
}
