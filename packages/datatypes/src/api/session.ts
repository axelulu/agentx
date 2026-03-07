import type { PaginationParams } from "../common/pagination";
import type { ModeOptions } from "../ws/client";
import { type NotificationEventDetail, ServerEventType } from "../ws/server";

export type SessionVisibility = "private" | "public";

// 对话类型 - 区分agent和chat模式
export type ConversationType = "agent" | "chat";

export type SessionType =
  | "agent"
  | "chat"
  | "website"
  | "document"
  | "image"
  | "slide"
  | "audio"
  | "video"
  | "drama";

// 项目类型 - 区分不同类型的项目
export type ProjectType =
  | "agent"
  | "website"
  | "document"
  | "image"
  | "slide"
  | "audio"
  | "video"
  | "drama"
  | "other";

export type Session = {
  id: string;
  title: string;
  icon: string | null;
  userId: string;
  isActive: boolean;
  isStarred: boolean;
  visibility: SessionVisibility;
  conversationType: ConversationType; // 对话类型
  projectType: ProjectType; // 项目类型
  options?: ModeOptions | null; // Mode-specific options
  status:
    | "running"
    | "complete"
    | "stopped"
    | "stopping"
    | "initializing"
    | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type RoleType = "user" | "assistant" | "system";

export type SessionMessage = {
  id: string;
  sessionId: string;
  role: RoleType;
  content: string;
  type: ServerEventType;
  detail: any | null;
  createdAt: Date;
};

/**
 * Create session parameters interface
 */
export interface CreateSessionParams {
  userId: string;
  sessionId: string;
  title?: string;
  content?: string;
  conversationType: ConversationType; // 新增必需字段
  projectType?: ProjectType; // 项目类型，只有agent模式需要
  options?: ModeOptions; // Mode-specific options
}

export interface SessionWithDetail extends Session {
  sandbox: NotificationEventDetail<"sandbox"> | null;
}

export type SessionFilterType = "all" | "recent" | "starred";

export interface SessionListParams extends PaginationParams {
  search?: string;
  filterType?: SessionFilterType;
}

// Community share related types
export type CommunityShareStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "removed";

export interface CommunityShare {
  id: string;
  sessionId: string;
  userId: string;
  coverImageUrl: string;
  coverImageThumbnailUrl?: string | null;
  title: string;
  description?: string | null;
  status: CommunityShareStatus;
  rejectionReason?: string | null;
  sharedAt: Date | string;
  approvedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CommunityShareWithUser extends CommunityShare {
  user?: {
    id: string;
    name: string;
    image?: string | null;
  };
  session?: {
    id: string;
    title: string;
    projectType?: ProjectType | null;
  };
}

export interface CreateCommunityShareParams {
  sessionId: string;
  coverImageUrl: string;
  coverImageThumbnailUrl?: string;
  title: string;
  description?: string;
}

export interface UpdateCommunityShareParams {
  coverImageUrl?: string;
  coverImageThumbnailUrl?: string;
  title?: string;
  description?: string;
}

export interface CommunityShareListParams extends PaginationParams {
  status?: CommunityShareStatus;
  userId?: string;
  category?: string;
}
