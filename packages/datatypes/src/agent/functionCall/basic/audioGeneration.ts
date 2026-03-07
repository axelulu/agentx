// ===== 音频生成工具参数 =====

/**
 * 音频生成工具输入参数
 */
export interface AudioGenerationParams {
  /** 音频描述提示词（可以是音乐描述、文字转语音内容、音效描述等） */
  prompt: string;
  /** 音频类型 */
  type: AudioGenerationType;
  /** 音频时长（秒），范围 5-300 */
  duration?: number;
  /** 音频格式 */
  format?: AudioGenerationFormat;
  /** 语音配置（仅当 type 为 speech 时有效） */
  voice_config?: VoiceConfig;
  /** 音乐配置（仅当 type 为 music 时有效） */
  music_config?: MusicConfig;
}

/**
 * 音频类型
 */
export type AudioGenerationType =
  | "music" // 音乐生成
  | "speech" // 文字转语音
  | "sound_effect"; // 音效生成

/**
 * 音频格式
 */
export type AudioGenerationFormat = "mp3" | "wav" | "flac";

/**
 * 语音配置
 */
export interface VoiceConfig {
  /** 语言代码，如 'en-US', 'zh-CN' */
  language?: string;
  /** 语音性别 */
  gender?: "male" | "female" | "neutral";
  /** 语速，0.5-2.0 */
  speed?: number;
  /** 音调，0.5-2.0 */
  pitch?: number;
}

/**
 * 音乐配置
 */
export interface MusicConfig {
  /** 音乐流派 */
  genre?: MusicGenre;
  /** 节奏（BPM） */
  tempo?: number;
  /** 乐器列表 */
  instruments?: string[];
  /** 情绪/氛围 */
  mood?: string;
}

/**
 * 音乐流派
 */
export type MusicGenre =
  | "pop"
  | "rock"
  | "classical"
  | "jazz"
  | "electronic"
  | "hiphop"
  | "ambient"
  | "folk"
  | "country"
  | "cinematic";

// ===== 音频生成工具返回结果 =====

/**
 * 音频生成结果
 */
export interface AudioGenerationResult {
  /** 原始提示词 */
  prompt: string;
  /** 音频类型 */
  type: AudioGenerationType;
  /** 生成的音频信息数组 */
  audios: Array<{
    /** 音频URL */
    audioUrl: string;
    /** 保存的文件名 */
    filename: string;
    /** 音频时长（秒） */
    duration?: number;
    /** 音频格式 */
    format: string;
  }>;
  /** 请求的时长（秒） */
  requestedDuration: number;
  /** 音频格式 */
  format: string;
  /** 生成的音频总数 */
  totalCount: number;
}

/**
 * 音频生成错误响应
 */
export interface AudioGenerationErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
