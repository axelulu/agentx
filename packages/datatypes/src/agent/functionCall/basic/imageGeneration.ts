// ===== 图片生成工具参数 =====

/**
 * 图片生成工具输入参数
 */
export interface ImageGenerationParams {
  /** 图片描述提示词 */
  prompt: string;
  /** 图片宽高比 */
  aspect_ratio?:
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "9:16"
    | "16:9"
    | "21:9";
  /** 图片质量 */
  quality?: "standard" | "hd";
  /** 图片风格 */
  style?: "vivid" | "natural";
  /** 图片尺寸大小 */
  image_size?: "1K" | "2K" | "4K";
}

/**
 * 图片宽高比类型
 */
export type ImageGenerationAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "9:16"
  | "16:9"
  | "21:9";

/**
 * 图片质量类型
 */
export type ImageGenerationQuality = "standard" | "hd";

/**
 * 图片风格类型
 */
export type ImageGenerationStyle = "vivid" | "natural";

// ===== 图片生成工具返回结果 =====

/**
 * 图片生成结果
 */
export interface ImageGenerationResult {
  /** 原始提示词 */
  prompt: string;
  /** 使用的模型 */
  model: string;
  /** 生成的图片信息数组 */
  images: Array<{
    /** 图片URL */
    imageUrl: string;
    /** 保存的文件名 */
    filename: string;
  }>;
  /** 图片宽高比 */
  aspect_ratio: string;
  /** 图片质量 */
  quality: string;
  /** 图片风格 */
  style: string;
  /** 生成的图片总数 */
  totalCount: number;
}

/**
 * 图片生成错误响应
 */
export interface ImageGenerationErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
