/**
 * WeChat Channel Adapter — uses wechaty for WeChat integration.
 *
 * User scans QR code to login. The adapter emits QR code events
 * for the frontend to display.
 */

import type { ChannelAdapter, ChannelConfig, ChannelState, InboundMessage } from "./types.js";

export class WeChatAdapter implements ChannelAdapter {
  readonly type = "wechat" as const;

  private bot: unknown = null;
  private state: ChannelState = {
    id: "",
    type: "wechat",
    status: "stopped",
  };

  /** Set by ChannelManager to forward QR code to frontend */
  onQRCode?: (qrDataUrl: string) => void;

  async start(config: ChannelConfig, onMessage: (msg: InboundMessage) => void): Promise<void> {
    this.state = { id: config.id, type: "wechat", status: "starting" };

    try {
      const { WechatyBuilder } = await import("wechaty");

      const bot = WechatyBuilder.build({
        name: "agentx-wechat",
        puppet: "wechaty-puppet-wechat4u",
      });

      this.bot = bot;

      // QR code for login
      bot.on("scan", async (qrcode: string, status: number) => {
        if (status === 2) {
          // Waiting for scan
          try {
            const qrcodeModule = await import("qrcode");
            const qrDataUrl = await qrcodeModule.toDataURL(qrcode);
            this.onQRCode?.(qrDataUrl);
          } catch {
            // qrcode module not available, provide raw link
            this.onQRCode?.(`https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
          }
        }
      });

      // Login success
      bot.on("login", (user: { name: () => string }) => {
        const name = user.name();
        this.state = {
          id: config.id,
          type: "wechat",
          status: "running",
          displayName: name,
        };
        console.error(`[WeChatAdapter] Logged in as ${name}`);
      });

      // Logout
      bot.on("logout", (user: { name: () => string }) => {
        console.error(`[WeChatAdapter] Logged out: ${user.name()}`);
        this.state = { ...this.state, status: "stopped" };
      });

      // Incoming messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bot.on("message", async (message: any) => {
        // Skip self messages and non-text messages
        if (message.self()) return;
        // Message.Type.Text = 7 in wechaty
        if (message.type() !== 7) return;
        // Skip group messages (only handle DMs)
        if (message.room()) return;

        const talker = message.talker();
        const contactId = talker.id;
        const senderName = talker.name();
        const text = message.text();

        if (!text.trim()) return;

        onMessage({
          platformKey: `wechat:${contactId}`,
          senderName,
          text,
          reply: async (replyText: string) => {
            await talker.say(replyText);
          },
        });
      });

      // Error handling
      bot.on("error", (err: Error) => {
        console.error("[WeChatAdapter] Error:", err.message);
        this.state = { ...this.state, status: "error", error: err.message };
      });

      await bot.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = { id: config.id, type: "wechat", status: "error", error: message };
      console.error("[WeChatAdapter] Failed to start:", message);
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      try {
        await (this.bot as { stop: () => Promise<void> }).stop();
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
