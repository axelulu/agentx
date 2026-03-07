import type { AttachedFile } from "../api/file";
import type { ConversationType, ProjectType } from "../api/session";

/**
 * Individual mode option interfaces
 */
export interface ChatModeOptions {
  selectedModel?: string;
  webSearchEnabled?: boolean;
}

export interface SlideModeOptions {
  slideCount?: number;
}

export interface DocumentModeOptions {
  // Future options for document mode
}

export interface ImageModeOptions {
  selectedModel?: string;
  aspectRatio?:
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "9:16"
    | "16:9"
    | "21:9";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
}

export interface WebsiteModeOptions {
  // Future options for website mode
}

export interface AgentModeOptions {
  // No specific options currently
}

export interface AudioModeOptions {
  // Future options for audio mode
}

export interface VideoModeOptions {
  // Future options for video mode
}

export interface DramaModeOptions {
  selectedModel?: string;
  episodeCount?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1" | "4:3";
}

/**
 * Type mapping: maps mode type to its options type
 */
export type ModeOptionsMap = {
  chat: ChatModeOptions;
  slide: SlideModeOptions;
  document: DocumentModeOptions;
  image: ImageModeOptions;
  website: WebsiteModeOptions;
  agent: AgentModeOptions;
  audio: AudioModeOptions;
  video: VideoModeOptions;
  drama: DramaModeOptions;
};

/**
 * Mode-specific options container
 * Can contain options for multiple modes (partial selection)
 */
export type ModeOptions = {
  [K in keyof ModeOptionsMap]?: ModeOptionsMap[K];
};

/**
 * Extract specific mode options type
 * Usage: ExtractModeOptions<'chat'> => ChatModeOptions
 */
export type ExtractModeOptions<T extends keyof ModeOptionsMap> =
  ModeOptionsMap[T];

/**
 * Helper type to get options based on ConversationType or ProjectType
 */
export type OptionsForType<T extends ConversationType | ProjectType> =
  T extends keyof ModeOptionsMap ? ModeOptionsMap[T] : never;

/**
 * 客户端事件类型枚举 - 客户端向服务端发送的所有事件类型
 */
export enum ClientEventType {
  CREATE_SESSION = "create_session",
  SEND_MESSAGE = "send_message",
  JOIN_SESSION = "join_session",
  LEAVE_SESSION = "leave_session",
  STOP_SESSION = "stop_session",
  DEPLOY_WEBSITE = "deploy_website",
}

/**
 * 客户端事件联合类型
 */
export type ClientEvent =
  | CreateSessionEvent
  | SendMessageEvent
  | JoinSessionEvent
  | LeaveSessionEvent
  | StopSessionEvent
  | DeployWebsiteEvent;

/**
 * 客户端基础事件接口
 */
export interface BaseClientEvent {
  type: ClientEventType;
  sessionId: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * 创建会话事件 - 客户端发送
 */
export interface CreateSessionEvent extends BaseClientEvent {
  type: ClientEventType.CREATE_SESSION;
  content?: string;
  files?: AttachedFile[];
  conversationType: ConversationType; // 新增必需字段
  projectType?: ProjectType; // 项目类型，只有agent模式需要
  options?: ModeOptions; // Mode-specific options
  optimisticId?: string; // Client-side optimistic message ID for correlation
}

/**
 * 发送消息事件 - 客户端发送
 */
export interface SendMessageEvent extends BaseClientEvent {
  type: ClientEventType.SEND_MESSAGE;
  content: string;
  files?: AttachedFile[];
  conversationType: ConversationType; // 可选，用于上下文
  options?: ModeOptions; // Mode-specific options
  optimisticId?: string; // Client-side optimistic message ID for correlation
}

/**
 * 加入会话事件 - 客户端发送
 */
export interface JoinSessionEvent extends BaseClientEvent {
  type: ClientEventType.JOIN_SESSION;
}

/**
 * 离开会话事件 - 客户端发送
 */
export interface LeaveSessionEvent extends BaseClientEvent {
  type: ClientEventType.LEAVE_SESSION;
}

/**
 * 离开会话事件 - 客户端发送
 */
export interface StopSessionEvent extends BaseClientEvent {
  type: ClientEventType.STOP_SESSION;
}

/**
 * 部署网站事件 - 客户端发送
 */
export interface DeployWebsiteEvent extends BaseClientEvent {
  type: ClientEventType.DEPLOY_WEBSITE;
}
