/**
 * 反馈类型
 */
export type FeedbackType = "bug" | "feature" | "general" | "praise";

/**
 * 反馈状态
 */
export type FeedbackStatus = "pending" | "reviewed" | "resolved" | "closed";

/**
 * 反馈数据库记录类型
 */
export interface Feedback {
  id?: string;
  type: FeedbackType;
  rating?: number | null;
  title: string;
  message: string;
  email?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  userId?: string | null;
  status?: FeedbackStatus;
  adminNotes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 创建反馈请求参数
 */
export interface CreateFeedbackRequest {
  type: FeedbackType;
  rating?: number;
  title: string;
  message: string;
  email?: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
}

/**
 * 反馈过滤器
 */
export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  search?: string;
}

/**
 * 分页选项
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * 分页反馈结果
 */
export interface PaginatedFeedback<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 反馈统计信息
 */
export interface FeedbackStats {
  total: number;
  byType: Record<FeedbackType, number>;
  byStatus: Record<FeedbackStatus, number>;
  recentCount: number;
  averageRating: number;
}

/**
 * 更新反馈状态请求
 */
export interface UpdateFeedbackStatusRequest {
  status: FeedbackStatus;
  adminNotes?: string;
}

/**
 * 反馈详情响应
 */
export interface FeedbackResponse {
  feedback: Feedback;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}
