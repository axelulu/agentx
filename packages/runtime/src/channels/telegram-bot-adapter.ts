/**
 * Telegram Bot Adapter — uses grammy (Bot API) for simple bot-based messaging.
 *
 * User creates a bot via @BotFather, pastes the token, and scans a QR code
 * that deep-links to the bot in Telegram. That's it.
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

export class TelegramBotAdapter implements ChannelAdapter {
  readonly type = "telegram" as const;

  private bot: import("grammy").Bot | null = null;
  private state: ChannelState = {
    id: "",
    type: "telegram",
    status: "stopped",
  };

  /** Set by ChannelManager to show QR code with bot deep link */
  onQRCode?: (qrDataUrl: string) => void;

  /** Set by ChannelManager to emit status mid-start */
  onStatusUpdate?: () => void;

  async start(config: ChannelConfig, onMessage: (msg: InboundMessage) => void): Promise<void> {
    this.state = { id: config.id, type: "telegram", status: "starting" };
    this.onStatusUpdate?.();

    const botToken = config.settings.botToken as string;
    if (!botToken) {
      this.state = {
        ...this.state,
        status: "error",
        error: "Bot Token is required — get one from @BotFather",
      };
      return;
    }

    try {
      const { Bot } = await import("grammy");

      const proxyUrl =
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy ||
        process.env.ALL_PROXY ||
        process.env.all_proxy;

      if (proxyUrl) {
        console.error(`[TelegramBotAdapter] Proxy env set: ${proxyUrl}`);
      } else {
        console.error("[TelegramBotAdapter] No proxy configured");
      }

      // Grammy bundles its own node-fetch which doesn't respect proxy env vars
      // and doesn't work under Bun. Override with the runtime's native fetch
      // which respects HTTPS_PROXY (Bun natively, Node via undici dispatcher).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nativeFetch = globalThis.fetch as any;

      this.bot = new Bot(botToken, {
        client: {
          fetch: nativeFetch,
        },
      });

      // Get bot info with timeout (api.telegram.org may be blocked/slow)
      console.error("[TelegramBotAdapter] Calling bot.init() (getMe)...");
      await withTimeout(this.bot.init(), 15_000, "Telegram API (bot.init)");
      const botUsername = this.bot.botInfo.username;
      console.error(`[TelegramBotAdapter] Bot info retrieved: @${botUsername}`);

      // Generate QR code with t.me deep link
      const deepLink = `https://t.me/${botUsername}`;
      try {
        const qrcodeModule = await import("qrcode");
        const qrDataUrl = await qrcodeModule.toDataURL(deepLink);
        this.onQRCode?.(qrDataUrl);
        console.error(`[TelegramBotAdapter] QR code generated for ${deepLink}`);
      } catch (err) {
        console.error("[TelegramBotAdapter] QR code generation failed:", err);
      }

      // Handle incoming messages
      this.bot.on("message:text", (ctx) => {
        const chatId = String(ctx.chat.id);
        const senderName = ctx.from.first_name || ctx.from.username || `User ${ctx.from.id}`;

        onMessage({
          platformKey: `telegram:${chatId}`,
          senderName,
          text: ctx.message.text,
          reply: async (text: string) => {
            await ctx.reply(text);
          },
          sendTyping: async () => {
            await ctx.replyWithChatAction("typing").catch(() => {});
          },
        });
      });

      // Catch polling errors so they don't crash the process
      this.bot.catch((err) => {
        console.error("[TelegramBotAdapter] Bot error:", err.message);
      });

      // Start long polling (not awaited — runs in background)
      this.bot.start({
        onStart: () => {
          console.error(`[TelegramBotAdapter] Bot @${botUsername} polling started`);
        },
      });

      this.state = {
        id: config.id,
        type: "telegram",
        status: "running",
        displayName: `@${botUsername}`,
      };
      console.error(`[TelegramBotAdapter] Running as @${botUsername}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = {
        id: config.id,
        type: "telegram",
        status: "error",
        error: message,
      };
      console.error("[TelegramBotAdapter] Failed to start:", message);
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch {
        // ignore
      }
      this.bot = null;
    }
    this.state = { ...this.state, status: "stopped", error: undefined };
  }

  getState(): ChannelState {
    return { ...this.state };
  }
}
