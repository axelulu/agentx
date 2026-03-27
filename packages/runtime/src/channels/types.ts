/**
 * Channel Adapter types for multi-platform messaging integration.
 *
 * Follows the Channel Adapter pattern (inspired by OpenClaw):
 * each messaging platform implements a standardized interface.
 */

export type ChannelType = "telegram" | "discord" | "wechat";
export type ChannelStatus = "stopped" | "starting" | "running" | "error";

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  enabled: boolean;
  /** Platform-specific settings */
  settings: Record<string, unknown>;
}

export interface ChannelState {
  id: string;
  type: ChannelType;
  status: ChannelStatus;
  error?: string;
  /** e.g. bot username for Telegram, Discord bot tag */
  displayName?: string;
}

export interface InboundMessage {
  /** Stable platform conversation key, e.g. "telegram:123456" */
  platformKey: string;
  /** Sender display name */
  senderName: string;
  /** Message text */
  text: string;
  /** Platform-specific reply callback for sending response */
  reply: (text: string) => Promise<void>;
  /** Optional: send typing indicator */
  sendTyping?: () => Promise<void>;
}

export interface ChannelAdapter {
  readonly type: ChannelType;
  start(config: ChannelConfig, onMessage: (msg: InboundMessage) => void): Promise<void>;
  stop(): Promise<void>;
  getState(): ChannelState;
}
