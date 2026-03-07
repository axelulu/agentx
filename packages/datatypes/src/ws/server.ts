import {
  type MCPToolName,
  type MCPToolParams,
  type MCPToolResult,
} from "../agent/functionCall/mcpToolParams";
import type { AttachedFile } from "../api/file";
import type { ConversationType, ProjectType, RoleType } from "../api/session";
import type { ModeOptions } from "./client";

export const SOCKET_CHANNEL = "socket:messages" as const;

/**
 * 服务端事件类型枚举 - 服务端向客户端发送的所有事件类型
 */
export enum ServerEventType {
  // 基础消息类型
  MESSAGE = "message",
  STREAM_TOKEN = "stream_token", // 流式传输Token事件
  LIVE_STATUS = "liveStatus",
  TOOL_USED = "toolUsed",
  TOOL_RESULT = "toolResult",
  ERROR = "error",

  // 状态更新
  STATUS_UPDATE = "statusUpdate",

  // 会话管理
  SESSION_CREATED = "session_created",
  SESSION_STOPPED = "session_stopped",

  // 用户操作通知
  USER_JOINED = "user_joined",
  USER_LEFT = "user_left",

  // 通知事件
  NOTIFICATION = "notification",
}

/**
 * 服务端事件联合类型
 */
export type ServerEvent =
  | ServerMessageEvent
  | StreamTokenEvent
  | LiveStatusEvent
  | ToolUsedEvent
  | ToolResultEvent
  | ErrorEvent
  | SessionCreatedEvent
  | SessionStoppedEvent
  | UserJoinedEvent
  | UserLeftEvent
  | NotificationEvent;

/**
 * 服务端基础事件接口
 */
export interface BaseServerEvent {
  type: ServerEventType;
  sessionId: string;
  timestamp: number;
}

/**
 * URL引用信息
 */
export interface UrlCitation {
  url: string;
  title: string;
}

/**
 * 消息事件详细参数
 */
export interface MessageEventDetail {
  userId?: string;
  selectedModel?: string;
  isStreaming?: boolean;
  responseType?: "stream" | "normal";
  urlCitation?: UrlCitation[];
}

/**
 * 消息事件 - 服务端发送给客户端的消息
 */
export interface ServerMessageEvent extends BaseServerEvent {
  type: ServerEventType.MESSAGE;
  event: {
    id: string;
    updateMessageId?: string;
    content: string;
    files?: AttachedFile[];
    role: RoleType;
    status?: "processing" | "completed" | "error" | "streaming";
    isStream?: boolean;
    detail?: MessageEventDetail;
    optimisticId?: string; // Client-side optimistic message ID for correlation
    realId?: string; // Server-assigned ID, stored when using optimistic updates (frontend-only)
  };
}

/**
 * 流式Token事件详细参数
 */
export interface StreamTokenEventDetail {
  userId?: string;
  selectedModel?: string;
}

/**
 * 流式Token事件 - 服务端发送给客户端的流式消息Token
 */
export interface StreamTokenEvent extends BaseServerEvent {
  type: ServerEventType.STREAM_TOKEN;
  event: {
    id: string;
    messageId: string;
    token: string; // 当前Token
    content: string; // 累积的内容
    role: RoleType;
    status: "streaming" | "completed" | "error";
    detail?: StreamTokenEventDetail;
  };
}

/**
 * 实时状态事件详细参数
 */
export interface LiveStatusEventDetail {
  userId?: string;
  description?: string;
}

/**
 * 实时状态事件 - Agent执行状态更新
 */
export interface LiveStatusEvent extends BaseServerEvent {
  type: ServerEventType.LIVE_STATUS;
  event: {
    id: string;
    content: string;
    role: RoleType;
    status:
      | "idle"
      | "thinking"
      | "running"
      | "completed"
      | "error"
      | "processing"
      | "starting"
      | "using_tool"
      | "paused"
      | "stopped"
      | "insufficient_credits";
    detail?: LiveStatusEventDetail;
  };
}

/**
 * 工具使用事件详细参数
 */
export interface ToolUsedEventDetail<T extends MCPToolName = MCPToolName> {
  userId?: string;
  description?: string;
  parameters?: MCPToolParams<T>;
  assistantContent?: string;
}

/**
 * 工具使用事件 - Agent工具执行反馈
 */
export type ToolUsedEvent = {
  [K in MCPToolName]: BaseServerEvent & {
    type: ServerEventType.TOOL_USED;
    event: {
      id: string;
      content: string;
      status: "start" | "success" | "fail";
      role: RoleType;
      tool: K;
      toolId: string;
      detail?: ToolUsedEventDetail<K>;
    };
  };
}[MCPToolName];

/**
 * 工具结果详细参数（类型安全版本 - 泛型）
 * 根据工具名称 T 自动推断参数和返回类型
 */
export interface ToolResultDetailParams<T extends MCPToolName = MCPToolName> {
  isLlmTool?: boolean;
  userId?: string;
  description?: string;
  parameters?: MCPToolParams<T>;
  result?: MCPToolResult<T>;
}

/**
 * 状态更新事件 - Agent状态更新反馈（使用映射类型实现类型安全）
 * 通过 tool 字段可以自动推断 parameters 的类型
 */
export type ToolResultEvent = {
  [K in MCPToolName]: BaseServerEvent & {
    type: ServerEventType.TOOL_RESULT;
    event: {
      id: string;
      content: string;
      status: "success" | "fail";
      role: RoleType;
      tool: K;
      toolId: string;
      detail?: ToolResultDetailParams<K>;
    };
  };
}[MCPToolName];

/**
 * 错误事件详细参数
 */
export interface ErrorEventDetail {
  userId?: string;
  stack?: string;
}

/**
 * 错误事件 - 系统错误通知
 */
export interface ErrorEvent extends BaseServerEvent {
  type: ServerEventType.ERROR;
  event: {
    id: string;
    content: string;
    code?: string;
    detail?: ErrorEventDetail;
  };
}

/**
 * 会话创建事件
 */
export interface SessionCreatedEvent extends BaseServerEvent {
  type: ServerEventType.SESSION_CREATED;
  event: {
    id: string;
    content: string;
    title: string;
    isActive: boolean;
    isStarred: boolean;
    detail: SessionCreatedEventDetail;
  };
}

/**
 * 会话停止事件详细参数
 */
export interface SessionStoppedEventDetail {
  userId: string;
  userName: string;
  success: boolean;
}

/**
 * 会话停止事件详细参数
 */
export interface SessionCreatedEventDetail {
  userId: string;
  message: string;
  sessionId: string;
  success?: boolean;
  userName?: string;
  files?: AttachedFile[];
  conversationType: ConversationType;
  projectType?: ProjectType;
  options?: ModeOptions; // Mode-specific options
}

/**
 * 会话停止事件
 */
export interface SessionStoppedEvent extends BaseServerEvent {
  type: ServerEventType.SESSION_STOPPED;
  event: {
    id: string;
    content: string;
    detail: SessionStoppedEventDetail;
  };
}

/**
 * 用户加入事件详细参数
 */
export interface UserJoinedEventDetail {
  userId?: string;
  userName?: string;
  selfJoin?: boolean;
}

/**
 * 用户加入事件
 */
export interface UserJoinedEvent extends BaseServerEvent {
  type: ServerEventType.USER_JOINED;
  event: {
    id: string;
    content: string;
    detail?: UserJoinedEventDetail;
  };
}

/**
 * 用户离开事件详细参数
 */
export interface UserLeftEventDetail {
  userId?: string;
  userName: string;
}

/**
 * 用户离开事件
 */
export interface UserLeftEvent extends BaseServerEvent {
  type: ServerEventType.USER_LEFT;
  event: {
    id: string;
    content: string;
    detail?: UserLeftEventDetail;
  };
}

/**
 * Sandbox详情参数
 */
export interface SandboxDetail {
  fileServerUrl?: string;
  vncUrl?: string;
  computerUseUrl?: string;
  websiteUrl?: string;
  vncPassword?: string;
}

/**
 * 通知类型
 */
export type NotificationType =
  | "sandbox"
  | "sessionDetail"
  | "sessionStatus"
  | "credit"
  | "websiteProject"
  | "deployProgress";

/**
 * Website project status type for notifications
 * Must match websiteProjectStatusEnum in backend schema
 */
export type WebsiteProjectStatus =
  | "created" // Project created (directory, database, Vercel project created)
  | "dev_running" // Development server is running
  | "deployed" // Successfully deployed to production
  | "error"; // Error state

/**
 * Website project notification detail
 */
export interface WebsiteProjectNotificationDetail {
  id: string;
  projectName: string;
  projectPath: string;
  status: WebsiteProjectStatus;
  sandboxId?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  databaseProvider?: string;
  databaseProjectId?: string;
  metadata?: {
    // Development server state (sandbox runtime info)
    devServerRunning?: boolean;
    previewUrl?: string;
    // Last deployment cache (for quick access, full history via Vercel API)
    lastDeploymentId?: string;
    lastDeploymentUrl?: string;
    // Error tracking for debugging
    lastError?: string;
    lastErrorTimestamp?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deploy progress stage type
 */
export type DeployProgressStage =
  | "preparing" // Preparing for deployment
  | "reading_env" // Reading environment variables
  | "collecting_files" // Collecting project files
  | "uploading" // Uploading files to Vercel
  | "queued" // Deployment queued on Vercel
  | "building" // Building on Vercel
  | "deploying" // Deploying to production
  | "completed" // Deployment completed
  | "error"; // Deployment failed

/**
 * Single build log entry
 */
export interface BuildLogEntry {
  timestamp: string;
  type: "command" | "stdout" | "stderr" | "info" | "warning" | "error";
  text: string;
}

/**
 * Deploy progress notification detail
 */
export interface DeployProgressNotificationDetail {
  projectId: string;
  projectName: string;
  stage: DeployProgressStage;
  progress: number; // 0-100
  message: string;
  error?: string;
  deploymentId?: string;
  deploymentUrl?: string;
  // Build logs for real-time display
  buildLogs?: BuildLogEntry[];
  // Vercel deployment state (QUEUED, BUILDING, READY, ERROR, CANCELED)
  vercelState?: string;
}

/**
 * 通知事件详细参数映射
 * 根据不同的通知类型提供不同的 detail 结构
 */
export interface NotificationEventDetailMap {
  sandbox: {
    sandboxId: string | null;
    sandboxDetail: SandboxDetail | null;
  };
  sessionDetail: {
    title: string;
    icon: string;
    projectType: ProjectType;
  };
  sessionStatus: {
    status: "running" | "complete" | "stopped" | "initializing" | "stopping";
  };
  credit: {
    credit: number;
  };
  websiteProject: WebsiteProjectNotificationDetail;
  deployProgress: DeployProgressNotificationDetail;
}

/**
 * 根据通知类型获取对应的详细参数类型
 */
export type NotificationEventDetail<
  T extends NotificationType = NotificationType,
> = T extends keyof NotificationEventDetailMap
  ? NotificationEventDetailMap[T]
  : never;

/**
 * 通知事件（联合类型，支持类型推断）
 */
export type NotificationEvent = {
  [K in NotificationType]: BaseServerEvent & {
    type: ServerEventType.NOTIFICATION;
    event: {
      id: string;
      type: K;
      content: string;
      detail?: NotificationEventDetail<K>;
    };
  };
}[NotificationType];

// ===== 类型映射：ServerEventType -> Detail Type =====

/**
 * 事件类型到详细参数类型的映射
 * 用于提供类型安全的事件创建
 */
export interface ServerEventDetailMap {
  [ServerEventType.MESSAGE]: MessageEventDetail;
  [ServerEventType.STREAM_TOKEN]: StreamTokenEventDetail;
  [ServerEventType.LIVE_STATUS]: LiveStatusEventDetail;
  [ServerEventType.TOOL_USED]: ToolUsedEventDetail;
  [ServerEventType.TOOL_RESULT]: ToolResultDetailParams;
  [ServerEventType.ERROR]: ErrorEventDetail;
  [ServerEventType.SESSION_CREATED]: SessionCreatedEventDetail;
  [ServerEventType.SESSION_STOPPED]: SessionStoppedEventDetail;
  [ServerEventType.USER_JOINED]: UserJoinedEventDetail;
  [ServerEventType.USER_LEFT]: UserLeftEventDetail;
  [ServerEventType.NOTIFICATION]: NotificationEventDetail;
  [ServerEventType.STATUS_UPDATE]: Record<string, any>;
}

/**
 * 事件类型到完整事件类型的映射
 * 用于提供类型安全的事件推断
 */
export interface ServerEventTypeMap {
  [ServerEventType.MESSAGE]: ServerMessageEvent;
  [ServerEventType.STREAM_TOKEN]: StreamTokenEvent;
  [ServerEventType.LIVE_STATUS]: LiveStatusEvent;
  [ServerEventType.TOOL_USED]: ToolUsedEvent;
  [ServerEventType.TOOL_RESULT]: ToolResultEvent;
  [ServerEventType.ERROR]: ErrorEvent;
  [ServerEventType.SESSION_CREATED]: SessionCreatedEvent;
  [ServerEventType.SESSION_STOPPED]: SessionStoppedEvent;
  [ServerEventType.USER_JOINED]: UserJoinedEvent;
  [ServerEventType.USER_LEFT]: UserLeftEvent;
  [ServerEventType.NOTIFICATION]: NotificationEvent;
}

/**
 * 根据事件类型获取对应的详细参数类型
 */
export type ServerEventDetail<T extends ServerEventType> =
  T extends keyof ServerEventDetailMap ? ServerEventDetailMap[T] : never;

/**
 * 根据事件类型获取对应的完整事件类型
 */
export type ServerEventByType<T extends ServerEventType> =
  T extends keyof ServerEventTypeMap ? ServerEventTypeMap[T] : never;
