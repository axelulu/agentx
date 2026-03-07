// 模型分类枚举
export enum ModelCategory {
  REASONING = "reasoning", // 推理类
  CREATIVE = "creative", // 创意类
  CODING = "coding", // 编程类
  MULTIMODAL = "multimodal", // 多模态
  GENERAL = "general", // 通用类
  SPECIALIZED = "specialized", // 专业类
  CODE = "code", // 专业类
}

// 模型能力枚举
export enum ModelCapability {
  TEXT_GENERATION = "text_generation",
  IMAGE_ANALYSIS = "image_analysis",
  IMAGE_GENERATION = "image_generation",
  CODE_EXECUTION = "code_execution",
  FUNCTION_CALLING = "function_calling",
  WEB_SEARCH = "web_search",
  FILE_ANALYSIS = "file_analysis",
  VISION = "vision",
  AUDIO = "audio",
}

// 模型信息接口
export interface ModelInfo {
  // === 基础信息 ===
  id: string; // 模型唯一标识
  name: string; // 显示名称
  provider: string; // 提供商
  description: string; // 描述
  modelVersion?: string; // 模型版本号

  // === 前端显示相关 ===
  iconType: string; // 图标类型 (zap/bot/brain/etc)
  category: ModelCategory; // 模型分类
  tags?: string[]; // 标签 (如: "vision", "code", "creative")

  // === 定价和权限 ===
  isFree?: boolean; // 是否完全免费
  pricing: {
    billingType?: "token" | "duration"; // 计费类型: token（按 token）或 duration（按秒）
    inputPrice: number; // 输入价格 (per 1M tokens for token billing)
    outputPrice: number; // 输出价格 (per 1M tokens for token billing, or per second for duration billing)
    cacheInputPrice?: number; // 缓存输入价格 (per 1M tokens) - 可选，如果不设置则使用inputPrice
    currency: string; // 货币单位 ("USD", "CNY")
    freeLimit?: {
      // 免费额度
      type: "daily" | "monthly"; // 额度类型
      tokens: number; // 免费token数
    };
  };

  // === 技术规格 ===
  capabilities: ModelCapability[]; // 支持的功能
  contextLength: number; // 上下文长度
  maxOutputTokens: number; // 最大输出token数
  speed: "fast" | "medium" | "slow"; // 响应速度
  quality: "high" | "medium" | "standard"; // 输出质量

  // === 文件支持 ===
  supportedFileTypes?: string[]; // 支持的文件类型 ["image/*", "application/pdf"]
  maxFileSize?: number; // 最大文件大小 (MB)

  // === 后端管理 ===
  enabled: boolean; // 是否启用
  weight: number; // 排序权重 (数字越小越靠前)
}

// 模型组配置
export interface ModelGroup {
  groupName: string;
  provider: string;
  iconType: string; // 图标类型字符串
  models: ModelInfo[];
  enabled: boolean;
  weight: number;
}
