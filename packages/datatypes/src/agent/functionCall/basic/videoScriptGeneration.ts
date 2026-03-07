// ===== 视频脚本生成工具参数 =====

/**
 * 视频脚本项
 */
export interface VideoScriptItem {
  /** 镜头编号 */
  shotNumber: number;
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 镜头标题 */
  title: string;
  /** 镜头描述 */
  desc: string;
  /** 详细视觉 prompt */
  prompt: string;
  /** 视频宽高比 */
  aspect_ratio?: "16:9" | "9:16";
  /** 视频风格 */
  style?: "cinematic" | "animation" | "realistic" | "artistic" | "documentary";
}

/**
 * 视频脚本生成工具输入参数
 */
export interface VideoScriptGenerationParams {
  /** 项目标题 */
  title: string;
  /** 视频脚本数组 */
  videoScripts: VideoScriptItem[];
}

/**
 * 视频脚本生成结果
 */
export interface VideoScriptGenerationResult {
  /** 项目标题 */
  title: string;
  /** 生成的视频总数 */
  totalVideoCount: number;
  /** 视频文件列表 */
  videoFiles: Array<{
    shotNumber: number;
    title: string;
    desc: string;
    startTime: number;
    endTime: number;
    duration: number;
    url: string;
    thumbnailUrl?: string;
    aspectRatio: string;
    style: string;
  }>;
}
