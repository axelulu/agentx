// ===== 音频脚本生成工具参数 =====

/**
 * 音频脚本项
 */
export interface AudioScriptItem {
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 音频片段标题 */
  title: string;
  /** 音频片段描述 */
  desc: string;
  /** 详细 prompt */
  prompt: string;
  /** 音频类型 */
  type: "speech" | "music" | "sound_effect";
  /** 语音配置（仅 speech 类型） */
  voice_config?: {
    language?: string;
    gender?: "male" | "female" | "neutral";
    speed?: number;
    pitch?: number;
  };
  /** 音乐配置（仅 music 类型） */
  music_config?: {
    genre?: string;
    tempo?: number;
    instruments?: string[];
    mood?: string;
  };
  /** 音频格式 */
  format?: "mp3" | "wav" | "flac";
}

/**
 * 音频脚本生成工具输入参数
 */
export interface AudioScriptGenerationParams {
  /** 项目标题 */
  title: string;
  /** 音频脚本数组 */
  audioScripts: AudioScriptItem[];
}

/**
 * 音频脚本生成结果
 */
export interface AudioScriptGenerationResult {
  /** 项目标题 */
  title: string;
  /** 生成的音频总数 */
  totalAudioCount: number;
  /** 音频文件列表 */
  audioFiles: Array<{
    title: string;
    desc: string;
    startTime: number;
    endTime: number;
    duration: number;
    type: string;
    url: string;
    format: string;
    /** 字幕文件 URL（仅 speech 类型） */
    subtitleUrl?: string;
    /** 字幕内容（仅 speech 类型） */
    subtitleContent?: string;
  }>;
  /** 合并字幕文件（包含所有 speech 片段） */
  subtitleFile?: {
    url: string;
    format: "srt" | "vtt";
    content: string;
  };
}
