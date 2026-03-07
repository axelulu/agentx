import type { AgentEvent } from "@workspace/agent";
import type { SerializableAgentEvent } from "../types.js";

/**
 * Convert an AgentEvent (may contain Error objects) into a
 * SerializableAgentEvent (safe for IPC / JSON serialization).
 */
export function toSerializableEvent(event: AgentEvent): SerializableAgentEvent {
  switch (event.type) {
    case "agent_start":
      return { type: "agent_start", timestamp: event.timestamp };

    case "agent_end":
      return {
        type: "agent_end",
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
        timestamp: event.timestamp,
        turn: event.turn,
      };

    case "turn_end":
      return {
        type: "turn_end",
        timestamp: event.timestamp,
        turn: event.turn,
        continueLoop: event.continueLoop,
      };

    case "message_start":
      return {
        type: "message_start",
        timestamp: event.timestamp,
        messageId: event.messageId,
      };

    case "message_delta":
      return {
        type: "message_delta",
        timestamp: event.timestamp,
        messageId: event.messageId,
        delta: event.delta,
      };

    case "message_end":
      return {
        type: "message_end",
        timestamp: event.timestamp,
        messageId: event.messageId,
        content: event.content,
      };

    case "tool_start":
      return {
        type: "tool_start",
        timestamp: event.timestamp,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        arguments: event.arguments,
      };

    case "tool_update":
      return {
        type: "tool_update",
        timestamp: event.timestamp,
        toolCallId: event.toolCallId,
        update: event.update,
      };

    case "tool_end":
      return {
        type: "tool_end",
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
        timestamp: event.timestamp,
        error: event.error?.message ?? "Unknown error",
        fatal: event.fatal,
      };
  }
}
