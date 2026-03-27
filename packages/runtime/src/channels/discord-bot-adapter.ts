/**
 * Discord Bot Adapter — uses discord.js for bot-based messaging.
 *
 * User creates a bot via Discord Developer Portal, pastes the token,
 * and scans a QR code (or clicks the link) to add the bot to their server.
 *
 * The bot responds to:
 * - Direct Messages (DMs)
 * - @mentions in server channels
 */

import type { ChannelAdapter, ChannelConfig, ChannelState, InboundMessage } from "./types.js";

/** Run a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s — check your network/proxy`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export class DiscordBotAdapter implements ChannelAdapter {
  readonly type = "discord" as const;

  private client: import("discord.js").Client | null = null;
  private state: ChannelState = {
    id: "",
    type: "discord",
    status: "stopped",
  };

  /** Set by ChannelManager to show QR code with invite link */
  onQRCode?: (qrDataUrl: string) => void;

  /** Set by ChannelManager to emit status mid-start */
  onStatusUpdate?: () => void;

  async start(config: ChannelConfig, onMessage: (msg: InboundMessage) => void): Promise<void> {
    this.state = { id: config.id, type: "discord", status: "starting" };
    this.onStatusUpdate?.();

    const botToken = config.settings.botToken as string;
    if (!botToken) {
      this.state = {
        ...this.state,
        status: "error",
        error: "Bot Token is required — get one from Discord Developer Portal",
      };
      return;
    }

    try {
      const { Client, GatewayIntentBits, Partials } = await import("discord.js");

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent,
        ],
        partials: [
          Partials.Channel, // Required for DM support
        ],
      });

      // Login with timeout
      console.error("[DiscordBotAdapter] Logging in...");
      await withTimeout(this.client.login(botToken), 15_000, "Discord login");

      // Wait for ready event
      await withTimeout(
        new Promise<void>((resolve) => {
          if (this.client!.isReady()) {
            resolve();
          } else {
            this.client!.once("clientReady", () => resolve());
          }
        }),
        15_000,
        "Discord ready",
      );

      const botUser = this.client.user!;
      const botTag = botUser.tag;
      console.error(`[DiscordBotAdapter] Logged in as ${botTag}`);

      // Generate invite URL with minimal permissions:
      // SendMessages (2048) + ReadMessageHistory (65536) + ViewChannel (1024)
      const permissions = 2048 + 65536 + 1024;
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${botUser.id}&permissions=${permissions}&scope=bot`;

      // Generate QR code for the invite link
      try {
        const qrcodeModule = await import("qrcode");
        const qrDataUrl = await qrcodeModule.toDataURL(inviteUrl);
        this.onQRCode?.(qrDataUrl);
        console.error(`[DiscordBotAdapter] QR code generated for invite link`);
      } catch (err) {
        console.error("[DiscordBotAdapter] QR code generation failed:", err);
      }

      // Handle incoming messages
      this.client.on("messageCreate", (message) => {
        // Ignore own messages
        if (message.author.id === botUser.id) return;
        // Ignore other bots
        if (message.author.bot) return;

        const isDM = !message.guild;
        const isMentioned = message.mentions.has(botUser.id);

        // Only respond to DMs or @mentions
        if (!isDM && !isMentioned) return;

        // Strip the mention from the text
        let text = message.content;
        if (isMentioned) {
          text = text.replace(new RegExp(`<@!?${botUser.id}>`, "g"), "").trim();
        }
        if (!text) return;

        const channelId = message.channel.id;
        const senderName = message.author.displayName || message.author.username;

        onMessage({
          platformKey: isDM ? `discord:dm:${message.author.id}` : `discord:ch:${channelId}`,
          senderName,
          text,
          reply: async (replyText: string) => {
            await message.reply(replyText);
          },
          sendTyping: async () => {
            await message.channel.sendTyping().catch(() => {});
          },
        });
      });

      // Handle errors
      this.client.on("error", (err) => {
        console.error("[DiscordBotAdapter] Client error:", err.message);
      });

      this.state = {
        id: config.id,
        type: "discord",
        status: "running",
        displayName: botTag,
      };
      console.error(`[DiscordBotAdapter] Running as ${botTag}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = {
        id: config.id,
        type: "discord",
        status: "error",
        error: message,
      };
      console.error("[DiscordBotAdapter] Failed to start:", message);
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // ignore
      }
      this.client = null;
    }
    this.state = { ...this.state, status: "stopped", error: undefined };
  }

  getState(): ChannelState {
    return { ...this.state };
  }
}
