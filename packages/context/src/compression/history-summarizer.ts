import type { LLMMessage, StreamFn } from "../types.js";
import { estimateTokens } from "../utils/token-estimator.js";

const SUMMARY_SYSTEM_PROMPT = `You are an AI conversation summarizer specialized in preserving context for AI agent task continuation.

Your goal is to create a summary that allows an AI agent to seamlessly continue the conversation without losing critical context.

OUTPUT FORMAT
Use exactly this structure with plain text section headers.

USER GOAL
Write one concise sentence describing what the user wants to achieve.

CURRENT STATE
Write 2 to 3 sentences covering what has been accomplished, what is in progress, and what is next.

KEY TECHNICAL DETAILS
Files section should list critical file paths only, up to 10 most important files.
Decisions section should list key technical decisions that affect implementation, maximum 5 items.
Errors section should list unresolved errors or blockers only.

PRIORITIZATION RULES in order of importance
First priority is unfinished work and blockers.
Second priority is file paths and function names.
Third priority is recent technical decisions.
Fourth priority is user preferences and requirements.
Fifth priority is completed work which can be heavily compressed.`;

/**
 * Generate an LLM-based summary of conversation history.
 * Returns null if streamFn is not provided.
 */
export async function summarizeHistory(
  messagesToSummarize: LLMMessage[],
  streamFn: StreamFn,
  model: string,
  maxTokens: number,
): Promise<string> {
  const conversationText = messagesToReadableText(messagesToSummarize);

  const prompt = `Create a structured summary of this conversation.\n\nCONVERSATION START\n${conversationText}\nCONVERSATION END\n\nStay within ${maxTokens} tokens.`;

  const summaryMessages: LLMMessage[] = [
    { role: "system", content: SUMMARY_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  let content = "";
  for await (const chunk of streamFn(summaryMessages, {
    model,
    maxTokens,
    temperature: 0.2,
    toolChoice: "none",
  })) {
    if (chunk.type === "content_delta") {
      content += chunk.delta;
    }
  }

  return content;
}

/**
 * Inject a summary as the first messages in a context window.
 */
export function prependSummary(summary: string, recentMessages: LLMMessage[]): LLMMessage[] {
  return [
    {
      role: "user",
      content: `Previous Conversation Summary\n${summary}\nEnd of Summary`,
    },
    {
      role: "assistant",
      content: "Understood. I have the context. Let me continue.",
    },
    ...recentMessages,
  ];
}

/**
 * Estimate the token cost of a summary.
 */
export function estimateSummaryTokens(summary: string): number {
  // Summary injection adds ~20 tokens overhead for the wrapper messages
  return estimateTokens(summary) + 20;
}

function messagesToReadableText(messages: LLMMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const role =
      msg.role === "user"
        ? "User"
        : msg.role === "assistant"
          ? "Assistant"
          : msg.role === "tool"
            ? "Tool Result"
            : "System";

    if (typeof msg.content === "string" && msg.content) {
      lines.push(`[${role}]: ${msg.content}`);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ("text" in part && part.text) {
          lines.push(`[${role}]: ${part.text}`);
        }
      }
    }

    if ("tool_calls" in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.type === "function") {
          lines.push(`[Tool Call - ${tc.function.name}]: ${tc.function.arguments}`);
        }
      }
    }
  }

  return lines.join("\n\n");
}
