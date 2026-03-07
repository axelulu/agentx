// ===== 演示文稿工具参数 =====

/**
 * 配色方案
 */
export interface ColorScheme {
  primary: string; // 主色 (60% of design)
  secondary: string; // 辅助色 (30% of design)
  accent: string; // 强调色 (10% of design - highlights, CTAs)
  text: string; // 主文本颜色
  textLight: string; // 次要文本颜色 (captions, secondary text)
  background?: string; // 背景色 (可选，如果使用纯色背景)
  backgroundGradient?: string; // 背景渐变 (可选，如果使用渐变背景)
}

/**
 * 幻灯片图片资源
 */
export interface SlideImage {
  url: string;
  description?: string;
  alt?: string;
}

/**
 * 幻灯片对象
 */
export interface SlideObject {
  title: string;
  description: string;
  notes?: string;
}

/**
 * 创建幻灯片工具输入参数
 */
export interface CreateSlideParams {
  presentationName: string;
  slideNumber: number;
  slideTitle: string;
  slideContentHint?: string;
  targetAudience?: string;
  presentationTitle?: string;
  slideImages?: SlideImage[];
  colorTips: string; // 配色方案 (必填)
}

/**
 * 列出幻灯片工具输入参数
 */
export interface ListSlidesParams {
  presentationName: string;
}

/**
 * 删除幻灯片工具输入参数
 */
export interface DeleteSlideParams {
  presentationName: string;
  slideNumber: number;
}

/**
 * 列出所有演示文稿工具输入参数
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ListAllPresentationsParams {
  // 无参数
}

/**
 * 删除演示文稿工具输入参数
 */
export interface DeletePresentationParams {
  presentationName: string;
}

/**
 * 创建演示文稿大纲工具输入参数
 */
export interface CreatePresentationOutlineParams {
  title: string;
  slides: SlideObject[];
  subtitle?: string;
}

export interface SlideOutline {
  title: string;
  description: string;
  notes?: string;
}

// ===== 演示文稿工具返回结果 =====

export interface SlideData {
  title: string;
  filename: string;
  file_path: string;
  preview_url: string;
  created_at: string;
}

export interface PresentationMetadata {
  presentation_name: string;
  title?: string;
  description?: string;
  slides: Record<string, SlideData>;
  created_at?: string;
  updated_at?: string;
}

export interface PresentationApiResult {
  presentation_name?: string;
  presentation_path?: string;
  slide_number?: number;
  slide_title?: string;
  slide_file?: string;
  preview_url?: string;
  style?: string;
  total_slides?: number;
  note?: string;
  presentation_title?: string;
  presentations?: Array<{
    folder: string;
    title: string;
    description: string;
    total_slides: number;
    created_at: string;
    updated_at: string;
  }>;
  presentations_directory?: string;
  deleted_slide?: number;
  deleted_title?: string;
  remaining_slides?: number;
  deleted_path?: string;
  styles?: Record<string, any>;
  usage_tip?: string;
  title?: string;
  subtitle?: string;
  slide_count?: number;
  outline_text?: string;
  slides?: SlideOutline[];
  metadata?: string;
}

export interface PresentationApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: PresentationMetadata | PresentationApiResult;
}
