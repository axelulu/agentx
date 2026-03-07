import {
  type ErrorEvent,
  type LiveStatusEvent,
  type MCPToolName,
  type MessageEventDetail,
  type NotificationEvent,
  type NotificationEventDetail,
  type NotificationType,
  ServerEventType,
  type ServerMessageEvent,
  type SessionCreatedEvent,
  type SessionCreatedEventDetail,
  type SessionStoppedEvent,
  type SessionStoppedEventDetail,
  type StreamTokenEvent,
  type ToolResultDetailParams,
  type ToolResultEvent,
  type ToolUsedEvent,
  type ToolUsedEventDetail,
} from "@workspace/datatypes";

/**
 * 服务端事件构建器 - 提供类型安全的服务端事件创建方法
 */
export class ServerEventBuilder {
  /**
   * 创建消息事件
   */
  static message(
    messageId: string,
    sessionId: string,
    content: string,
    role: ServerMessageEvent["event"]["role"],
    detail?: MessageEventDetail
  ): ServerMessageEvent {
    return {
      type: ServerEventType.MESSAGE,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content,
        role,
        detail,
      },
    };
  }

  /**
   * 创建聊天消息事件 (Chat模式专用，支持完整的消息属性)
   */
  static chatMessage(
    messageId: string,
    sessionId: string,
    content: string,
    role: ServerMessageEvent["event"]["role"],
    options?: {
      updateMessageId?: string;
      files?: ServerMessageEvent["event"]["files"];
      status?: ServerMessageEvent["event"]["status"];
      isStream?: boolean;
      detail?: MessageEventDetail;
      optimisticId?: string;
    }
  ): ServerMessageEvent {
    return {
      type: ServerEventType.MESSAGE,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        updateMessageId: options?.updateMessageId,
        content,
        files: options?.files,
        role,
        status: options?.status,
        isStream: options?.isStream,
        detail: options?.detail,
        optimisticId: options?.optimisticId,
      },
    };
  }

  /**
   * 创建实时状态事件
   */
  static liveStatus(
    messageId: string,
    sessionId: string,
    content: string,
    role: ServerMessageEvent["event"]["role"],
    status: LiveStatusEvent["event"]["status"],
    detail?: Record<string, any>
  ): LiveStatusEvent {
    return {
      type: ServerEventType.LIVE_STATUS,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content,
        role,
        status,
        detail,
      },
    };
  }

  /**
   * 创建错误事件
   */
  static error(
    messageId: string,
    sessionId: string,
    message: string,
    code?: string,
    detail?: Record<string, any>
  ): ErrorEvent {
    return {
      type: ServerEventType.ERROR,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content: `错误: ${message}`,
        code,
        detail,
      },
    };
  }

  /**
   * 创建会话创建事件
   */
  static sessionCreated(
    messageId: string,
    sessionId: string,
    title: string,
    createdAt: Date,
    isActive: boolean,
    isStarred: boolean,
    detail: SessionCreatedEventDetail
  ): SessionCreatedEvent {
    return {
      type: ServerEventType.SESSION_CREATED,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content: `会话已创建: ${title}`,
        title,
        isActive,
        isStarred,
        detail,
      },
    };
  }

  /**
   * 创建会话创建事件
   */
  static sessionStopped(
    messageId: string,
    sessionId: string,
    detail: SessionStoppedEventDetail
  ): SessionStoppedEvent {
    return {
      type: ServerEventType.SESSION_STOPPED,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content: `会话已创建`,
        detail,
      },
    };
  }

  /**
   * 创建工具使用事件
   */
  static toolUsed(
    messageId: string,
    sessionId: string,
    tool: MCPToolName,
    toolId: string,
    status: "start" | "success" | "fail",
    role: ServerMessageEvent["event"]["role"],
    detail?: ToolUsedEventDetail
  ): ToolUsedEvent {
    return {
      type: ServerEventType.TOOL_USED,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content: status,
        status,
        role,
        tool,
        toolId,
        detail,
      },
    } as ToolUsedEvent;
  }

  /**
   * 创建状态更新事件
   */
  static toolResult(
    messageId: string,
    sessionId: string,
    tool: MCPToolName,
    toolId: string,
    status: "success" | "fail",
    role: ServerMessageEvent["event"]["role"],
    detail?: ToolResultDetailParams
  ): ToolResultEvent {
    return {
      type: ServerEventType.TOOL_RESULT,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content: status,
        status,
        role,
        tool,
        toolId,
        detail,
      },
    } as ToolResultEvent;
  }

  /**
   * 创建通知事件（支持类型推断）
   */
  static notification<T extends NotificationType>(
    messageId: string,
    sessionId: string,
    type: T,
    detail?: NotificationEventDetail<T>
  ): Extract<NotificationEvent, { event: { type: T } }> {
    return {
      type: ServerEventType.NOTIFICATION,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        content: "",
        type,
        detail,
      },
    } as Extract<NotificationEvent, { event: { type: T } }>;
  }

  /**
   * 创建流式Token事件
   */
  static streamToken(
    messageId: string,
    sessionId: string,
    streamMessageId: string,
    token: string,
    content: string,
    role: StreamTokenEvent["event"]["role"],
    status: StreamTokenEvent["event"]["status"] = "streaming",
    detail?: Record<string, any>
  ): StreamTokenEvent {
    return {
      type: ServerEventType.STREAM_TOKEN,
      sessionId,
      timestamp: Date.now(),
      event: {
        id: messageId,
        messageId: streamMessageId,
        token,
        content,
        role,
        status,
        detail,
      },
    };
  }
}
