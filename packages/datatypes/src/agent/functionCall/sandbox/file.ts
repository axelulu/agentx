// ===== 文件管理工具参数 =====

/**
 * 文件权限（Unix八进制格式）
 */
export type FilePermissions = string;

/**
 * 创建文件工具输入参数
 */
export interface CreateFileParams {
  filePath: string;
  fileContents: string;
  permissions?: FilePermissions;
}

/**
 * 字符串替换工具输入参数
 */
export interface StringReplaceParams {
  filePath: string;
  oldStr: string;
  newStr: string;
}

/**
 * 完整文件重写工具输入参数
 */
export interface FullFileRewriteParams {
  filePath: string;
  fileContents: string;
  permissions?: FilePermissions;
}

/**
 * 删除文件工具输入参数
 */
export interface DeleteFileParams {
  filePath: string;
}

/**
 * 读取文件工具输入参数
 */
export interface ReadFileParams {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

/**
 * 读取文件范围工具输入参数
 */
export interface ReadFileRangeParams {
  filePath: string;
  startLine: number;
  endLine: number;
}

// ===== 文件管理工具返回结果 =====

export interface FileApiResult {
  filePath?: string;
  fileUrl?: string;
  content?: string;
  size?: number;
  exists?: boolean;
}

export interface FileApiResponse {
  success: boolean;
  message: string;
  result: FileApiResult;
}
