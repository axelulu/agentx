import type {
  AgentMessage,
  AgentTool,
  ContentPart,
  LLMAssistantMessage,
  LLMMessage,
  LLMToolDefinition,
  LLMToolMessage,
  LLMUserMessage,
} from "../types.js";

/**
 * Convert internal AgentMessage[] to OpenAI-compatible LLMMessage[].
 */
export function convertToLlmMessages(messages: AgentMessage[]): LLMMessage[] {
  const result: LLMMessage[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "user": {
        const llmMsg: LLMUserMessage = {
          role: "user",
          content: convertUserContent(msg.content),
        };
        result.push(llmMsg);
        break;
      }
      case "assistant": {
        const llmMsg: LLMAssistantMessage = {
          role: "assistant",
          content: msg.content,
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          llmMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        result.push(llmMsg);
        break;
      }
      case "tool": {
        const llmMsg: LLMToolMessage = {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: convertToolResultContent(msg.content, msg.images),
        };
        result.push(llmMsg);
        break;
      }
    }
  }

  return result;
}

function convertUserContent(content: string | ContentPart[]): LLMUserMessage["content"] {
  if (typeof content === "string") return content;

  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text };
    }
    // ImageContent → image_url with data URI
    const mime = part.mimeType ?? "image/png";
    return {
      type: "image_url" as const,
      image_url: { url: `data:${mime};base64,${part.data}` },
    };
  });
}

function convertToolResultContent(
  content: string,
  images?: Array<{ data: string; mimeType: string }>,
): LLMToolMessage["content"] {
  if (!images || images.length === 0) return content;

  const parts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: content }];

  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    });
  }

  return parts;
}

/**
 * Convert AgentTool[] to OpenAI-compatible tool definitions.
 */
export function convertToolsToLlm(tools: AgentTool[]): LLMToolDefinition[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
