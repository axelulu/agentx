/**
 * ChannelManager — manages channel adapter lifecycle and routes messages
 * between external platforms and AgentRuntime conversations.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import type { AgentRuntime } from "../runtime.js";
import type { ChannelConfig, ChannelState, ChannelAdapter, InboundMessage } from "./types.js";

interface ChannelManagerOptions {
  configPath: string;
  conversationMapPath: string;
  onStatusUpdate?: (states: ChannelState[]) => void;
  onQRCode?: (channelId: string, qrDataUrl: string) => void;
  onConfigUpdate?: (channelId: string, settingsUpdate: Record<string, unknown>) => void;
  /** Fired when a channel conversation is created (e.g. after deletion or first connect) */
  onConversationsChanged?: () => void;
}

/** Lazy-load adapters to avoid hard dependency on grammy/discord.js */
async function createAdapter(type: string): Promise<ChannelAdapter> {
  switch (type) {
    case "telegram": {
      const { TelegramBotAdapter } = await import("./telegram-bot-adapter.js");
      return new TelegramBotAdapter();
    }
    case "discord": {
      const { DiscordBotAdapter } = await import("./discord-bot-adapter.js");
      return new DiscordBotAdapter();
    }
    default:
      throw new Error(`Unknown channel type: ${type}`);
  }
}

export class ChannelManager {
  private runtime: AgentRuntime;
  private options: ChannelManagerOptions;
  private adapters = new Map<string, ChannelAdapter>();
  private configs: ChannelConfig[] = [];

  /** platformKey → AgentX conversationId */
  private conversationMap = new Map<string, string>();

  constructor(runtime: AgentRuntime, options: ChannelManagerOptions) {
    this.runtime = runtime;
    this.options = options;
    this.loadConversationMap();
  }

  // ---------------------------------------------------------------------------
  // Conversation mapping persistence
  // ---------------------------------------------------------------------------

  private loadConversationMap(): void {
    try {
      if (existsSync(this.options.conversationMapPath)) {
        const data = JSON.parse(readFileSync(this.options.conversationMapPath, "utf-8")) as Record<
          string,
          string
        >;
        // Migrate old ":lobby:" keys to new canonical format
        const migrated: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
          const lobbyMatch = key.match(/^(\w+):lobby:(.+)$/);
          if (lobbyMatch) {
            migrated[`${lobbyMatch[1]}:${lobbyMatch[2]}`] = value;
          } else {
            migrated[key] = value;
          }
        }
        this.conversationMap = new Map(Object.entries(migrated));
      }
    } catch {
      // ignore corrupted file
    }
  }

  private saveConversationMap(): void {
    const obj = Object.fromEntries(this.conversationMap);
    writeFileSync(this.options.conversationMapPath, JSON.stringify(obj, null, 2), "utf-8");
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async setConfigs(configs: ChannelConfig[]): Promise<void> {
    this.configs = configs;

    // Stop removed adapters
    for (const [id, adapter] of this.adapters) {
      if (!configs.find((c) => c.id === id)) {
        await adapter.stop().catch(() => {});
        this.adapters.delete(id);
      }
    }

    // Start/restart enabled adapters
    for (const config of configs) {
      if (config.enabled) {
        await this.startChannel(config.id).catch((err) => {
          console.error(`[ChannelManager] Failed to start ${config.type}:`, err);
        });
      } else {
        const existing = this.adapters.get(config.id);
        if (existing) {
          await existing.stop().catch(() => {});
          this.adapters.delete(config.id);
        }
      }
    }

    this.emitStatus();
  }

  async startChannel(id: string): Promise<void> {
    const config = this.configs.find((c) => c.id === id);
    if (!config) throw new Error(`Channel config not found: ${id}`);

    // Stop existing adapter if running
    const existing = this.adapters.get(id);
    if (existing) {
      await existing.stop().catch(() => {});
    }

    const adapter = await createAdapter(config.type);

    // Inject callbacks for adapters that support them
    const adapterAny = adapter as unknown as Record<string, unknown>;
    if (this.options.onQRCode) {
      adapterAny.onQRCode = (qrDataUrl: string) => {
        this.options.onQRCode!(id, qrDataUrl);
      };
    }
    adapterAny.onStatusUpdate = () => {
      this.emitStatus();
    };

    this.adapters.set(id, adapter);

    await adapter.start(config, (msg) => this.handleInboundMessage(config, msg));

    // Create a pinned conversation immediately on successful connection
    if (adapter.getState().status === "running") {
      await this.ensureChannelConversation(config, adapter).catch(() => {});
    }

    this.emitStatus();
  }

  async stopChannel(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (adapter) {
      await adapter.stop();
      this.adapters.delete(id);
      this.emitStatus();
    }
  }

  getStates(): ChannelState[] {
    const states: ChannelState[] = [];
    for (const config of this.configs) {
      const adapter = this.adapters.get(config.id);
      if (adapter) {
        states.push(adapter.getState());
      } else {
        states.push({
          id: config.id,
          type: config.type,
          status: "stopped",
        });
      }
    }
    return states;
  }

  async shutdown(): Promise<void> {
    for (const [, adapter] of this.adapters) {
      await adapter.stop().catch(() => {});
    }
    this.adapters.clear();
  }

  // ---------------------------------------------------------------------------
  // Ensure a pinned conversation exists for a channel on connect
  // ---------------------------------------------------------------------------

  /** Canonical platformKey for a channel — all messages share a single conversation. */
  private channelPlatformKey(config: ChannelConfig): string {
    return `${config.type}:${config.id}`;
  }

  /** Consistent conversation title derived from the bot's display name, not the message sender. */
  private channelConversationTitle(config: ChannelConfig, adapter?: ChannelAdapter): string {
    const platformName =
      config.type === "telegram" ? "Telegram" : config.type === "discord" ? "Discord" : config.type;
    const displayName = adapter?.getState().displayName;
    return displayName ? `${platformName} · ${displayName}` : platformName;
  }

  private async ensureChannelConversation(
    config: ChannelConfig,
    adapter: ChannelAdapter,
  ): Promise<void> {
    const platformKey = this.channelPlatformKey(config);
    const title = this.channelConversationTitle(config, adapter);
    await this.resolveConversation(config, platformKey, title);
  }

  // ---------------------------------------------------------------------------
  // Inbound message handling
  // ---------------------------------------------------------------------------

  /** Resolve an existing conversation or create a new pinned one for a platform key. */
  private async resolveConversation(
    config: ChannelConfig,
    platformKey: string,
    title: string,
  ): Promise<string> {
    // Check if we already have a mapped conversation
    const existingId = this.conversationMap.get(platformKey);
    if (existingId) {
      // Verify the conversation still exists (user may have deleted it)
      const conversations = await this.runtime.listConversations();
      if (conversations.some((c) => c.id === existingId)) {
        return existingId;
      }
      // Conversation was deleted — remove stale mapping and recreate
      this.conversationMap.delete(platformKey);
    }

    const conv = await this.runtime.createConversation(title);
    const conversationId = (conv as { id: string }).id;
    await this.runtime.setConversationSource(conversationId, config.type).catch(() => {});
    await this.runtime.setConversationFavorite(conversationId, true).catch(() => {});
    this.conversationMap.set(platformKey, conversationId);
    this.saveConversationMap();
    this.options.onConversationsChanged?.();
    return conversationId;
  }

  private async handleInboundMessage(config: ChannelConfig, msg: InboundMessage): Promise<void> {
    try {
      // Use the same canonical key as ensureChannelConversation so all messages
      // for a channel go to the single conversation created on connect.
      const platformKey = this.channelPlatformKey(config);
      // Use the bot/adapter display name for the title (not the sender's name)
      // so recreated conversations match the one created on connect.
      const adapter = this.adapters.get(config.id);
      const title = this.channelConversationTitle(config, adapter);
      const conversationId = await this.resolveConversation(config, platformKey, title);

      // Send typing indicator if available
      msg.sendTyping?.().catch(() => {});

      // Prepend sender name so the AI knows who is talking
      const messageText = `[${msg.senderName}] ${msg.text}`;

      // Send message to runtime
      await this.runtime.sendMessage(conversationId, messageText);

      // Subscribe to events and collect the full response
      await this.collectAndReply(conversationId, msg);
    } catch (err) {
      console.error("[ChannelManager] Failed to handle inbound message:", err);
      const errText = err instanceof Error ? err.message : "Internal error";
      msg.reply(`Error: ${errText}`).catch(() => {});
    }
  }

  private collectAndReply(conversationId: string, msg: InboundMessage): Promise<void> {
    return new Promise<void>((resolve) => {
      let fullContent = "";
      let resolved = false;

      // Timeout: if agent doesn't finish in 5 minutes, send what we have
      const timeout = setTimeout(
        () => {
          if (!resolved) {
            resolved = true;
            this.runtime.unsubscribe(conversationId);
            if (fullContent) {
              this.sendChunked(msg, fullContent).then(resolve).catch(resolve);
            } else {
              msg.reply("(No response - timed out)").then(resolve).catch(resolve);
            }
          }
        },
        5 * 60 * 1000,
      );

      this.runtime.subscribe(conversationId, (event) => {
        const evt = event as {
          type: string;
          content?: string;
          delta?: string;
          error?: string;
          result?: { error?: string };
        };

        switch (evt.type) {
          case "message_delta":
            if (evt.delta) fullContent += evt.delta;
            // Periodically send typing indicator
            msg.sendTyping?.().catch(() => {});
            break;

          case "message_end":
            if (evt.content) fullContent = evt.content;
            break;

          case "agent_end":
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.runtime.unsubscribe(conversationId);
              if (fullContent) {
                this.sendChunked(msg, fullContent).then(resolve).catch(resolve);
              } else {
                resolve();
              }
            }
            break;

          case "error":
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.runtime.unsubscribe(conversationId);
              const errMsg = evt.error || "Agent error";
              msg.reply(`Error: ${errMsg}`).then(resolve).catch(resolve);
            }
            break;
        }
      });
    });
  }

  private async sendChunked(msg: InboundMessage, text: string): Promise<void> {
    // Split long messages into chunks (conservative limit for both platforms)
    const MAX_LEN = 4000;
    if (text.length <= MAX_LEN) {
      await msg.reply(text);
      return;
    }
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_LEN) {
        chunks.push(remaining);
        break;
      }
      // Try to split at last newline before limit
      let splitIdx = remaining.lastIndexOf("\n", MAX_LEN);
      if (splitIdx < MAX_LEN / 2) splitIdx = MAX_LEN;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx);
    }
    for (const chunk of chunks) {
      await msg.reply(chunk);
    }
  }

  private emitStatus(): void {
    this.options.onStatusUpdate?.(this.getStates());
  }
}
