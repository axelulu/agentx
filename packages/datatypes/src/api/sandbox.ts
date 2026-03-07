import { type SandboxDetail } from "../ws/server";

/**
 * 沙箱状态类型
 */
export type SandboxStatus = "active" | "inactive" | "destroyed";

/**
 * 沙箱数据库记录类型
 */
export interface Sandbox {
  id?: string;
  sandboxId: string;
  userId: string;
  sessionId?: string | null;
  status?: SandboxStatus;
  template?: string;
  detail?: SandboxDetail | null;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 创建沙箱请求参数
 */
export interface CreateSandboxRequest {
  userId: string;
  sessionId?: string;
  template?: string;
  detail?: Record<string, unknown>;
}

/**
 * 查找沙箱请求参数
 */
export interface FindSandboxRequest {
  userId: string;
  sessionId?: string;
}

/**
 * 更新沙箱请求参数
 */
export interface UpdateSandboxRequest {
  sandboxId: string;
  status?: SandboxStatus;
  detail?: Record<string, unknown>;
}

/**
 * 沙箱查询过滤器
 */
export interface SandboxFilters {
  userId?: string;
  sessionId?: string;
  status?: SandboxStatus;
  template?: string;
}

/**
 * 沙箱统计信息
 */
export interface SandboxStats {
  total: number;
  byStatus: Record<SandboxStatus, number>;
  activeCount: number;
  destroyedCount: number;
}

/**
 * 沙箱操作响应
 */
export interface SandboxOperationResponse {
  success: boolean;
  sandboxId?: string;
  message?: string;
  error?: string;
  data?: Sandbox;
}
