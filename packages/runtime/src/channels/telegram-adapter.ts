/**
 * Telegram Channel Adapter — uses gramjs (MTProto) for user account login via QR code.
 *
 * User provides API ID + API Hash from https://my.telegram.org,
 * then scans a QR code with the Telegram mobile app to authenticate.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ChannelAdapter, ChannelConfig, ChannelState, InboundMessage } from "./types.js";

export class TelegramAdapter implements ChannelAdapter {
  readonly type = "telegram" as const;

  private client: import("telegram").TelegramClient | null = null;
  private state: ChannelState = {
    id: "",
    type: "telegram",
    status: "stopped",
  };

  /** Set by ChannelManager to forward QR code to frontend */
  onQRCode?: (qrDataUrl: string) => void;

  /** Set by ChannelManager to persist session/config updates */
  onConfigUpdate?: (settingsUpdate: Record<string, unknown>) => void;

  async start(config: ChannelConfig, onMessage: (msg: InboundMessage) => void): Promise<void> {
    this.state = { id: config.id, type: "telegram", status: "starting" };

    const apiId = Number(config.settings.apiId);
    const apiHash = config.settings.apiHash as string;
    const savedSession = (config.settings.session as string) ?? "";
    const allowedChatIds = (config.settings.allowedChatIds as string[] | undefined) ?? [];
    const allowedSet = new Set(allowedChatIds.filter(Boolean));

    if (!apiId || !apiHash) {
      this.state = { ...this.state, status: "error", error: "API ID and API Hash are required" };
      return;
    }

    try {
      const { TelegramClient } = await import("telegram");
      const { StringSession } = await import("telegram/sessions/index.js");
      const { NewMessage } = await import("telegram/events/index.js");

      const session = new StringSession(savedSession);
      this.client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
      });

      await this.client.connect();

      if (!(await this.client.isUserAuthorized())) {
        const password = config.settings.password as string | undefined;

        await this.client.signInUserWithQrCode(
          { apiId, apiHash },
          {
            qrCode: async (code: any) => {
              try {
                const token = code.token.toString("base64url");
                const loginUrl = `tg://login?token=${token}`;
                const qrcodeModule = await import("qrcode");
                const qrDataUrl = await qrcodeModule.toDataURL(loginUrl);
                this.onQRCode?.(qrDataUrl);
              } catch (err) {
                console.error("[TelegramAdapter] QR code generation failed:", err);
              }
            },
            password: async () => {
              if (password) return password;
              throw new Error("Two-factor authentication password required but not configured");
            },
            onError: (err: any) => {
              console.error("[TelegramAdapter] Login error:", err.message);
              return true; // continue retrying
            },
          },
        );
      }

      // Save session for next start
      const sessionStr = this.client.session.save() as unknown as string;
      this.onConfigUpdate?.({ session: sessionStr });

      // Get display name
      const me = await this.client.getMe();
      const displayName = (me as { username?: string }).username
        ? `@${(me as { username?: string }).username}`
        : ((me as { firstName?: string }).firstName ?? "Telegram User");

      this.state = {
        id: config.id,
        type: "telegram",
        status: "running",
        displayName,
      };
      console.error(`[TelegramAdapter] Logged in as ${displayName}`);

      // Listen for new messages
      this.client.addEventHandler(async (event: any) => {
        const message = event.message;
        if (!message || !message.text) return;

        // Skip outgoing messages
        if (message.out) return;

        const chatId = String(message.chatId ?? message.peerId);

        // Access control
        if (allowedSet.size > 0 && !allowedSet.has(chatId)) return;

        // Get sender info
        let senderName = `User ${chatId}`;
        try {
          const sender = await message.getSender();
          if (sender) {
            const s = sender as { firstName?: string; username?: string; title?: string };
            senderName = s.firstName ?? s.username ?? s.title ?? senderName;
          }
        } catch {
          // ignore
        }

        onMessage({
          platformKey: `telegram:${chatId}`,
          senderName,
          text: message.text,
          reply: async (text: string) => {
            if (this.client) {
              await this.client.sendMessage(chatId, { message: text });
            }
          },
          sendTyping: async () => {
            // gramjs doesn't have a simple typing indicator, skip
          },
        });
      }, new NewMessage({}));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = { id: config.id, type: "telegram", status: "error", error: message };
      console.error("[TelegramAdapter] Failed to start:", message);
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
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
