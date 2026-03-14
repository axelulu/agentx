import type {
  ConversationData,
  ProviderConfig,
  MessageData,
  BranchInfo,
  SerializableAgentEvent,
} from "../types.js";

/**
 * Type-safe IPC channel definitions.
 * These define the contract between the Tauri backend and the renderer.
 *
 * Usage in apps/desktop:
 *   Backend: Tauri command handlers
 *   Renderer: window.api[channel](...args)
 */

// ---------------------------------------------------------------------------
// Main → Renderer (push events)
// ---------------------------------------------------------------------------

export interface MainToRendererChannels {
  "agent:event": (event: SerializableAgentEvent) => void;
  "mcp:statusUpdate": (states: unknown[]) => void;
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

  // Branching
  "conversation:branchInfo": (id: string) => Promise<BranchInfo>;
  "conversation:switchBranch": (id: string, targetMessageId: string) => Promise<void>;

  // Agent
  "agent:send": (conversationId: string, content: string) => Promise<void>;
  "agent:abort": (conversationId: string) => void;
  "agent:regenerate": (
    conversationId: string,
    assistantMessageId: string,
  ) => Promise<{ started: boolean }>;

  // Providers
  "provider:set": (config: ProviderConfig) => void;
  "provider:remove": (id: string) => void;
  "provider:setActive": (id: string) => void;
  "provider:list": () => ProviderConfig[];

  // Knowledge Base
  "kb:list": () => unknown[];
  "kb:set": (item: unknown) => void;
  "kb:remove": (id: string) => void;

  // MCP Servers
  "mcp:list": () => unknown[];
  "mcp:set": (config: unknown) => void;
  "mcp:remove": (id: string) => void;
  "mcp:status": () => unknown[];
  "mcp:reconnect": (id?: string) => Promise<void>;
}

/**
 * All IPC channel names for type-safe registration.
 */
export type IpcChannel = keyof MainToRendererChannels | keyof RendererToMainChannels;
