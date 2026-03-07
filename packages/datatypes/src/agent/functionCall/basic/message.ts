// ===== 消息通知工具参数 =====

/**
 * 附件对象
 */
export interface MessageAttachment {
  type: string;
  path?: string;
  url?: string;
}

/**
 * 通知用户工具输入参数
 */
export interface NotifyUserParams {
  text: string;
  attachments?: MessageAttachment[];
}

// ===== 消息通知工具返回结果 =====

/**
 * 通知用户工具返回结果
 */
export interface NotifyUserResult {
  text: string;
  message: string;
  attachments: Array<MessageAttachment>;
}

// ===== 任务完成工具参数 =====

/**
 * Complete工具输入参数（无参数）
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CompleteParams {
  // 无参数 - 表示任务完成
}

// ===== Vercel部署通知工具参数 =====

/**
 * Vercel部署通知工具输入参数
 */
export interface NotifyVercelDeploymentParams {
  message: string;
}

/**
 * Vercel部署通知工具返回结果
 */
export interface NotifyVercelDeploymentResult {
  message: string;
  projectName?: string;
  previewUrl?: string;
  vercelProjectId?: string;
  status?: "error" | "created" | "dev_running" | "deployed";
}
