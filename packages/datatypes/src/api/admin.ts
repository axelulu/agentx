import type { UserInfo } from "./user";

/**
 * 管理员权限检查结果
 */
export interface AdminPermissionResult {
  hasPermission: boolean;
  userRole: string;
  requiredRole: string;
}

/**
 * System statistics
 */
export interface SystemStats {
  totalUsers: number;
  totalSessions: number;
  totalMessages: number;
  activeUsers: number; // Active users in last 30 days
  newUsersThisMonth: number;
  totalPoints: number;
  totalRedemptionCodes: number;
  activeSubscriptions: number;
  totalCheckIns?: number;
  totalRedemptions?: number;
  serverInfo: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
}

/**
 * 用户管理查询参数
 */
export interface AdminUserQuery {
  page?: number;
  limit?: number;
  search?: string; // 搜索用户名或邮箱
  role?: string;
  sortBy?: "createdAt" | "updatedAt" | "name" | "email" | "role";
  sortOrder?: "asc" | "desc";
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * 用户管理列表响应
 */
export interface AdminUserListResponse {
  users: UserInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 更新用户角色参数
 */
export interface UpdateUserRoleParams {
  userId: string;
  role: string;
}

/**
 * 兑换码管理查询参数
 */
export interface AdminRedemptionCodeQuery {
  page?: number;
  limit?: number;
  status?: "active" | "used" | "expired" | "disabled";
  codeType?: string;
  createdBy?: string;
  sortBy?: "createdAt" | "expiresAt" | "pointsValue";
  sortOrder?: "asc" | "desc";
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * 兑换码详细信息（管理员视图）
 */
export interface AdminRedemptionCodeInfo {
  id: string;
  code: string;
  pointsValue: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  expiresAt: Date | null;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  codeType?: string;
}

/**
 * 兑换码管理列表响应
 */
export interface AdminRedemptionCodeListResponse {
  codes: AdminRedemptionCodeInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 批量操作参数
 */
export interface BatchOperationParams {
  ids: string[];
  action: string;
  params?: Record<string, any>;
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

/**
 * Payment management query parameters
 */
export interface AdminPaymentQuery {
  page?: number;
  limit?: number;
  userId?: string;
  status?: "active" | "cancelled" | "expired" | "paused";
  planCode?: string;
  sortBy?: "createdAt" | "amount" | "status";
  sortOrder?: "asc" | "desc";
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Payment information (admin view)
 */
export interface AdminPaymentInfo {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planCode: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  status: "active" | "cancelled" | "expired" | "paused";
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextBillingDate?: Date | null;
  stripeSubscriptionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment management list response
 */
export interface AdminPaymentListResponse {
  payments: AdminPaymentInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Payment statistics
 */
export interface AdminPaymentStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalRevenue: number;
}

/**
 * Check-in management query parameters
 */
export interface AdminCheckInQuery {
  page?: number;
  limit?: number;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "createdAt" | "checkInDate" | "creditsEarned" | "streak";
  sortOrder?: "asc" | "desc";
}

/**
 * Check-in information (admin view)
 */
export interface AdminCheckInInfo {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  checkInDate: string;
  creditsEarned: number;
  streak: number;
  bonusMultiplier: number;
  createdAt: Date;
}

/**
 * Check-in management list response
 */
export interface AdminCheckInListResponse {
  checkIns: AdminCheckInInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Check-in statistics
 */
export interface AdminCheckInStats {
  totalCheckIns: number;
  todayCheckIns: number;
  totalCreditsEarned: number;
  avgStreak: number;
  maxStreak: number;
}

/**
 * Feedback management query parameters
 */
export interface AdminFeedbackQuery {
  page?: number;
  limit?: number;
  type?: "bug" | "feature" | "general" | "praise";
  status?: "pending" | "reviewed" | "resolved" | "closed";
  userId?: string;
  sortBy?: "createdAt" | "updatedAt" | "rating" | "status";
  sortOrder?: "asc" | "desc";
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Feedback information (admin view)
 */
export interface AdminFeedbackInfo {
  id: string;
  type: "bug" | "feature" | "general" | "praise";
  rating: number | null;
  title: string;
  message: string;
  email: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  status: "pending" | "reviewed" | "resolved" | "closed";
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Feedback management list response
 */
export interface AdminFeedbackListResponse {
  feedbacks: AdminFeedbackInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Feedback statistics
 */
export interface AdminFeedbackStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  recentCount: number;
}

/**
 * Update feedback status parameters
 */
export interface UpdateFeedbackStatusParams {
  id: string;
  status: "pending" | "reviewed" | "resolved" | "closed";
  adminNotes?: string;
}

/**
 * Chat management query parameters
 */
export interface AdminChatQuery {
  page?: number;
  limit?: number;
  userId?: string;
  isActive?: boolean;
  isStarred?: boolean;
  visibility?: "private" | "public";
  status?: "running" | "complete" | "stopped" | "stopping" | "initializing" | null;
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Chat session information (admin view)
 */
export interface AdminChatInfo {
  id: string;
  title: string;
  icon: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  isActive: boolean;
  isStarred: boolean;
  visibility: "private" | "public";
  status: "running" | "complete" | "stopped" | "stopping" | "initializing" | null;
  messageCount: number;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat session detail (admin view) - includes messages and attachments
 */
export interface AdminChatDetail extends AdminChatInfo {
  messages: AdminChatMessage[];
  attachments: AdminChatAttachment[];
}

/**
 * Chat message information (admin view)
 */
export interface AdminChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  type: string | null;
  detail: any;
  createdAt: Date;
}

/**
 * Chat attachment information (admin view)
 */
export interface AdminChatAttachment {
  id: string;
  originalName: string;
  filename: string;
  fileType: "image" | "document" | "video" | "audio" | "other";
  mimeType: string;
  size: number;
  path: string;
  url: string;
  userId: string;
  sessionId: string | null;
  temporary: boolean;
  hash: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat management list response
 */
export interface AdminChatListResponse {
  chats: AdminChatInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Chat statistics
 */
export interface AdminChatStats {
  totalChats: number;
  activeChats: number;
  totalMessages: number;
  totalAttachments: number;
  publicChats: number;
  starredChats: number;
  avgMessagesPerChat: number;
}

/**
 * Sandbox information (admin view)
 */
export interface AdminSandboxInfo {
  id: string;
  sandboxId: string;
  userId: string;
  sessionId: string | null;
  status: "active" | "inactive" | "destroyed";
  template: string;
  detail: Record<string, unknown> | null;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}