/**
 * 支持的文件类型
 */
export type SupportedFileType =
  | "image" // 图片文件
  | "document" // 文档文件
  | "video" // 视频文件
  | "audio" // 音频文件
  | "other"; // 其他类型

/**
 * 附件文件接口
 */
export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  uploadStatus?: "pending" | "uploading" | "uploaded" | "error";
  uploadProgress?: number;
  uploadedFileInfo?: {
    id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    createdAt: string;
  };
  error?: string;
}

/**
 * 文件上传数据库记录（对应 fileUploadTable schema）
 */
export interface FileUploadRecord {
  /** 文件ID */
  id: string;
  /** 原始文件名 */
  originalName: string;
  /** 存储的文件名 */
  filename: string;
  /** 文件类型 */
  fileType: SupportedFileType;
  /** MIME类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件路径 */
  path: string;
  /** 访问URL */
  url: string;
  /** 上传者用户ID */
  userId: string;
  /** 关联的聊天会话ID（可选） */
  sessionId: string | null;
  /** 是否为临时文件 */
  temporary: boolean;
  /** 文件哈希值 */
  hash: string | null;
  /** 文件元数据（JSON字符串） */
  metadata: string | null;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 删除时间（软删除） */
  deletedAt: Date | null;
}

/**
 * 上传文件的基础信息（公开API使用）
 */
export interface UploadFile {
  /** 文件ID */
  id: string;
  /** 原始文件名 */
  originalName: string;
  /** 存储的文件名 */
  filename: string;
  /** 文件类型 */
  fileType: SupportedFileType;
  /** MIME类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件路径 */
  path: string;
  /** 访问URL */
  url: string;
  /** 上传者用户ID */
  userId: string;
  /** 上传时间 */
  createdAt: Date;
}

/**
 * 文件删除响应
 */
export interface DeleteFileResponse {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 获取文件列表请求参数
 */
export interface GetFilesRequest {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 文件类型过滤 */
  fileType?: SupportedFileType;
  /** 用户ID过滤 */
  userId?: string;
  /** 是否包含临时文件 */
  includeTemporary?: boolean;
  /** 是否包含已删除文件 */
  includeDeleted?: boolean;
  /** 搜索关键词 */
  search?: string;
}

/**
 * 获取文件列表响应
 */
export interface GetFilesResponse {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 文件列表 */
  data?: UploadFile[];
  /** 总数 */
  total?: number;
  /** 当前页 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * File upload configuration
 */
export interface UploadConfig {
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Storage path for local uploads */
  uploadPath: string;
  /** Enable image compression */
  enableImageCompression: boolean;
  /** Image compression quality (0-100) */
  imageCompressionQuality: number;
}
