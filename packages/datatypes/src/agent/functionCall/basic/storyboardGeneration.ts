// ===== 分镜生成工具参数 =====

/**
 * 角色外貌描述
 */
export interface CharacterAppearance {
  /** 年龄或年龄段 */
  age: string;
  /** 性别 */
  gender: string;
  /** 发型和发色 */
  hair: string;
  /** 面部特征 */
  face?: string;
  /** 体型 */
  body: string;
  /** 肤色 */
  skin?: string;
  /** 服装描述 */
  outfit: string;
  /** 配饰 */
  accessories?: string;
}

/**
 * 角色定义
 */
export interface StoryboardCharacter {
  /** 角色姓名 */
  name: string;
  /** 角色定位 */
  role: string;
  /** 性格特点 */
  personality?: string;
  /** 详细外貌描述 */
  appearance: CharacterAppearance;
}

/**
 * 分镜生成工具输入参数
 */
export interface StoryboardGenerationParams {
  /** 短剧标题 */
  title: string;
  /** 故事梗概（100-500字） */
  synopsis: string;
  /** 角色列表 */
  characters: StoryboardCharacter[];
  /** 目标平台 */
  target_platform?: StoryboardPlatform;
  /** 目标总时长（秒） */
  total_duration: number;
  /** 期望的镜头数量 */
  shot_count?: number;
  /** 视觉风格 */
  visual_style?: StoryboardVisualStyle;
  /** 情感基调 */
  mood?: string;
  /** 开头钩子描述 */
  hook_description?: string;
  /** 背景音乐风格 */
  background_music_style?: string;
  /** 是否需要配音 */
  include_voiceover?: boolean;
  /** 旁白风格 */
  voiceover_style?: string;
  /** 内容语言 */
  language?: StoryboardLanguage;
}

/**
 * 目标平台类型
 */
export type StoryboardPlatform =
  | "douyin"
  | "youtube_shorts"
  | "instagram_reels"
  | "bilibili"
  | "general";

/**
 * 视觉风格类型
 */
export type StoryboardVisualStyle =
  | "cinematic"
  | "animation"
  | "realistic"
  | "artistic"
  | "documentary";

/**
 * 支持的语言
 */
export type StoryboardLanguage = "zh" | "en" | "ja" | "ko";

// ===== 分镜生成工具返回结果 =====

/**
 * 单个镜头信息
 */
export interface StoryboardShot {
  /** 镜头编号 */
  shotNumber: number;
  /** 镜头时长（秒） */
  duration: number;
  /** 场景描述 */
  scene: {
    /** 环境描述 */
    environment: string;
    /** 时间 */
    time?: string;
    /** 天气 */
    weather?: string;
    /** 氛围 */
    atmosphere?: string;
  };
  /** 角色描述（用于 video_generation） */
  characters: Array<{
    /** 角色姓名 */
    name: string;
    /** 完整外貌描述（保持一致性） */
    fullDescription: string;
    /** 动作描述 */
    action: string;
    /** 表情 */
    expression?: string;
  }>;
  /** 机位运镜 */
  camera: {
    /** 景别 */
    shotType: "close-up" | "medium" | "wide" | "extreme-wide" | "detail";
    /** 运镜方式 */
    movement?: string;
    /** 构图描述 */
    composition?: string;
  };
  /** 视觉风格 */
  visualStyle: {
    /** 色调 */
    colorTone?: string;
    /** 光影 */
    lighting?: string;
  };
  /** 台词或旁白 */
  dialogue?: string;
  /** 音效需求 */
  soundEffect?: string;
  /** 用于 video_generation 的完整 prompt */
  videoPrompt: string;
}

/**
 * 分镜生成结果
 */
export interface StoryboardGenerationResult {
  /** 短剧标题 */
  title: string;
  /** 故事梗概 */
  synopsis: string;
  /** 目标平台 */
  platform: StoryboardPlatform;
  /** 总时长（秒） */
  totalDuration: number;
  /** 视频宽高比 */
  aspectRatio: "16:9" | "9:16" | "1:1";
  /** 视觉风格 */
  visualStyle: StoryboardVisualStyle;
  /** 情感基调 */
  mood: string;
  /** 角色列表（包含完整描述） */
  characters: Array<{
    name: string;
    role: string;
    fullDescription: string;
  }>;
  /** 镜头列表 */
  shots: StoryboardShot[];
  /** 背景音乐建议 */
  backgroundMusic?: {
    style: string;
    suggestedDuration: number;
    description: string;
  };
  /** 音效列表 */
  soundEffects?: Array<{
    shotNumber: number;
    description: string;
    duration: number;
  }>;
  /** 配音信息 */
  voiceover?: {
    style: string;
    totalText: string;
  };
  /** 剪辑建议 */
  editingNotes?: string;
}
