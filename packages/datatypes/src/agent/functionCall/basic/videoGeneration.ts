// ===== 视频生成工具参数 =====

/**
 * 视频生成工具输入参数
 */
export interface VideoGenerationParams {
  /** 视频描述提示词 */
  prompt: string;
  /** 视频时长（秒），支持 4、6、8 */
  duration?: number;
  /** 视频宽高比 */
  aspect_ratio?: VideoGenerationAspectRatio;
  /** 视频风格 */
  style?: VideoGenerationStyle;
  /** 生成视频数量，范围 1-4 */
  count?: number;
}

/**
 * 视频宽高比类型
 */
export type VideoGenerationAspectRatio = "16:9" | "9:16";

/**
 * 视频风格类型
 */
export type VideoGenerationStyle =
  | "cinematic"
  | "animation"
  | "realistic"
  | "artistic"
  | "documentary";

// ===== 视频生成工具返回结果 =====

/**
 * 视频生成结果
 */
export interface VideoGenerationResult {
  /** 原始提示词 */
  prompt: string;
  /** 生成的视频信息数组 */
  videos: Array<{
    /** 视频URL */
    videoUrl: string;
    /** 保存的文件名 */
    filename: string;
    /** 视频时长（秒） */
    duration?: number;
    /** 缩略图URL */
    thumbnailUrl?: string;
  }>;
  /** 视频宽高比 */
  aspect_ratio: string;
  /** 视频风格 */
  style: string;
  /** 请求的时长（秒） */
  requestedDuration: number;
  /** 生成的视频总数 */
  totalCount: number;
}

/**
 * 视频生成错误响应
 */
export interface VideoGenerationErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
