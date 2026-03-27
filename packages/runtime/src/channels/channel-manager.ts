/**
 * ChannelManager — manages channel adapter lifecycle and routes messages
 * between external platforms and AgentRuntime conversations.
 *
 * Each channel config stores its conversationId in config.settings.conversationId.
 * This is the single source of truth — no separate map file needed.
 */

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

  /** Per-config lock to prevent concurrent conversation creation */
  private resolvingLocks = new Map<string, Promise<string>>();

  /** Serialization lock for setConfigs to prevent concurrent starts */
  private configLock: Promise<void> = Promise.resolve();

  constructor(runtime: AgentRuntime, options: ChannelManagerOptions) {
    this.runtime = runtime;
    this.options = options;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async setConfigs(configs: ChannelConfig[]): Promise<void> {
    // Serialize setConfigs calls so concurrent invocations (e.g. startup +
    // frontend reconnect) don't race and create duplicate conversations.
    const prev = this.configLock;
    let release: () => void;
    this.configLock = new Promise<void>((r) => {
      release = r;
    });
    await prev;

    try {
      this.configs = configs;

      // Stop removed adapters
      for (const [id, adapter] of this.adapters) {
        if (!configs.find((c) => c.id === id)) {
          await adapter.stop().catch(() => {});
          this.adapters.delete(id);
        }
      }

      // Start enabled adapters that aren't already running
      for (const config of configs) {
        if (config.enabled && !this.adapters.has(config.id)) {
          await this.startChannel(config.id).catch((err) => {
            console.error(`[ChannelManager] Failed to start ${config.type}:`, err);
          });
        } else if (!config.enabled) {
          const existing = this.adapters.get(config.id);
          if (existing) {
            await existing.stop().catch(() => {});
            this.adapters.delete(config.id);
          }
        }
      }

      this.emitStatus();
    } finally {
      release!();
    }
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
  // Conversation resolution — single source of truth: config.settings.conversationId
  // ---------------------------------------------------------------------------

  /** Consistent conversation title derived from the bot's display name, not the message sender. */
  private channelConversationTitle(config: ChannelConfig, adapter?: ChannelAdapter): string {
    const platformName =
      config.type === "telegram" ? "Telegram" : config.type === "discord" ? "Discord" : config.type;
    const displayName = adapter?.getState().displayName;
    return displayName ? `${platformName} · ${displayName}` : platformName;
  }

  /**
   * Resolve the conversation for a channel config.
   * Uses a per-config lock so concurrent calls don't create duplicates.
   */
  private resolveConversation(config: ChannelConfig, title: string): Promise<string> {
    const inflight = this.resolvingLocks.get(config.id);
    if (inflight) return inflight;

    const promise = this.resolveConversationInner(config, title).finally(() => {
      this.resolvingLocks.delete(config.id);
    });
    this.resolvingLocks.set(config.id, promise);
    return promise;
  }

  private async resolveConversationInner(config: ChannelConfig, title: string): Promise<string> {
    const conversations = await this.runtime.listConversations();

    // 1. Check config.settings.conversationId — the single source of truth
    const storedId = config.settings.conversationId as string | undefined;
    if (storedId) {
      const existing = conversations.find((c) => c.id === storedId);
      if (existing) {
        // Fix title if needed (e.g. old sender name → bot display name)
        if (existing.title !== title) {
          this.runtime.updateConversationTitle(storedId, title).catch(() => {});
        }
        return storedId;
      }
      // Conversation was deleted — fall through
    }

    // 2. Migration: adopt an existing channel conversation created by old code.
    //    Match by channelKey (e.g. "telegram:<configId>") or source (e.g. "telegram").
    //    This runs once — after adoption the ID is persisted in config.settings.
    const platformKey = `${config.type}:${config.id}`;
    const legacy =
      conversations.find((c) => c.channelKey === platformKey) ??
      conversations.find((c) => c.source === config.type);
    if (legacy) {
      config.settings.conversationId = legacy.id;
      this.options.onConfigUpdate?.(config.id, { conversationId: legacy.id });
      if (legacy.title !== title) {
        this.runtime.updateConversationTitle(legacy.id, title).catch(() => {});
      }
      return legacy.id;
    }

    // 3. Create a new conversation and persist its ID in channel config
    const conv = await this.runtime.createConversation(title);
    const conversationId = (conv as { id: string }).id;
    await this.runtime.setConversationSource(conversationId, config.type).catch(() => {});
    await this.runtime.setConversationFavorite(conversationId, true).catch(() => {});

    config.settings.conversationId = conversationId;
    this.options.onConfigUpdate?.(config.id, { conversationId });

    this.options.onConversationsChanged?.();
    return conversationId;
  }

  // ---------------------------------------------------------------------------
  // Inbound message handling
  // ---------------------------------------------------------------------------

  private async handleInboundMessage(config: ChannelConfig, msg: InboundMessage): Promise<void> {
    try {
      const adapter = this.adapters.get(config.id);
      const title = this.channelConversationTitle(config, adapter);
      const conversationId = await this.resolveConversation(config, title);

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
