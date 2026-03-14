import type { AgentEvent } from "@agentx/agent";
import type { SerializableAgentEvent } from "../types.js";

/**
 * Convert an AgentEvent (may contain Error objects) into a
 * SerializableAgentEvent (safe for IPC / JSON serialization).
 * Stamps each event with the given conversationId.
 */
export function toSerializableEvent(
  event: AgentEvent,
  conversationId: string,
): SerializableAgentEvent {
  switch (event.type) {
    case "agent_start":
      return { type: "agent_start", conversationId, timestamp: event.timestamp };

    case "agent_end":
      return {
        type: "agent_end",
        conversationId,
        timestamp: event.timestamp,
        result: {
          turns: event.result.turns,
          aborted: event.result.aborted,
          error: event.result.error?.message,
        },
      };

    case "turn_start":
      return {
        type: "turn_start",
        conversationId,
        timestamp: event.timestamp,
        turn: event.turn,
      };

    case "turn_end":
      return {
        type: "turn_end",
        conversationId,
        timestamp: event.timestamp,
        turn: event.turn,
        continueLoop: event.continueLoop,
      };

    case "message_start":
      return {
        type: "message_start",
        conversationId,
        timestamp: event.timestamp,
        messageId: event.messageId,
      };

    case "message_delta":
      return {
        type: "message_delta",
        conversationId,
        timestamp: event.timestamp,
        messageId: event.messageId,
        delta: event.delta,
      };

    case "message_end":
      return {
        type: "message_end",
        conversationId,
        timestamp: event.timestamp,
        messageId: event.messageId,
        content: event.content,
      };

    case "tool_start":
      return {
        type: "tool_start",
        conversationId,
        timestamp: event.timestamp,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        arguments: event.arguments,
      };

    case "tool_update":
      return {
        type: "tool_update",
        conversationId,
        timestamp: event.timestamp,
        toolCallId: event.toolCallId,
        update: event.update,
      };

    case "tool_end":
      return {
        type: "tool_end",
        conversationId,
        timestamp: event.timestamp,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: {
          content: event.result.content,
          isError: event.result.isError,
        },
      };

    case "error":
      return {
        type: "error",
        conversationId,
        timestamp: event.timestamp,
        error: event.error?.message ?? "Unknown error",
        fatal: event.fatal,
      };

    case "usage":
      return {
        type: "usage",
        conversationId,
        timestamp: event.timestamp,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
      };
  }
}
