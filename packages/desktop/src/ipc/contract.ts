import type {
  ConversationData,
  DesktopProviderConfig,
  MessageData,
  SerializableAgentEvent,
} from "../types.js";

/**
 * Type-safe IPC channel definitions.
 * These define the contract between Electron main process and renderer.
 *
 * Usage in apps/agentx:
 *   Main: ipcMain.handle(channel, handler)
 *   Renderer: window.api[channel](...args)
 */

// ---------------------------------------------------------------------------
// Main → Renderer (push events)
// ---------------------------------------------------------------------------

export interface MainToRendererChannels {
  "agent:event": (event: SerializableAgentEvent) => void;
}

// ---------------------------------------------------------------------------
// Renderer → Main (request/response)
// ---------------------------------------------------------------------------

export interface RendererToMainChannels {
  // Conversations
  "conversation:create": (title?: string) => Promise<ConversationData>;
  "conversation:list": () => Promise<ConversationData[]>;
  "conversation:delete": (id: string) => Promise<void>;
  "conversation:messages": (id: string) => Promise<MessageData[]>;
  "conversation:updateTitle": (id: string, title: string) => Promise<ConversationData>;

  // Agent
  "agent:send": (conversationId: string, content: string) => Promise<void>;
  "agent:abort": (conversationId: string) => void;

  // Providers
  "provider:set": (config: DesktopProviderConfig) => void;
  "provider:remove": (id: string) => void;
  "provider:setActive": (id: string) => void;
  "provider:list": () => DesktopProviderConfig[];

  // Knowledge Base
  "kb:list": () => unknown[];
  "kb:set": (item: unknown) => void;
  "kb:remove": (id: string) => void;

  // MCP Servers
  "mcp:list": () => unknown[];
  "mcp:set": (config: unknown) => void;
  "mcp:remove": (id: string) => void;
}

/**
 * All IPC channel names for type-safe registration.
 */
export type IpcChannel = keyof MainToRendererChannels | keyof RendererToMainChannels;
