// ===== 图片搜索工具参数 =====

/**
 * 图片搜索工具输入参数
 */
export interface ImageSearchParams {
  query: string;
  numResults?: number;
}

/**
 * 图片搜索引擎类型
 */
export type ImageSearchEngine = "google" | "bing" | "baidu";

/**
 * 图片搜索类型
 */
export type ImageSearchType = "images";

/**
 * 图片搜索参数配置
 */
export interface ImageSearchParameters {
  /** 搜索查询词 */
  q: string;
  /** 搜索类型 */
  type: ImageSearchType;
  /** 搜索引擎 */
  engine: ImageSearchEngine;
  /** 返回结果数量 */
  num: number;
}

// ===== 图片搜索工具返回结果 =====

/**
 * 单个图片搜索结果（详细版本）
 */
export interface ImageSearchResultDetailed {
  /** 图片标题 */
  title: string;
  /** 图片完整URL */
  imageUrl: string;
  /** 图片宽度 */
  imageWidth: number;
  /** 图片高度 */
  imageHeight: number;
  /** 缩略图URL */
  thumbnailUrl: string;
  /** 缩略图宽度 */
  thumbnailWidth: number;
  /** 缩略图高度 */
  thumbnailHeight: number;
  /** 来源网站名称 */
  source: string;
  /** 来源域名 */
  domain: string;
  /** 原始网页链接 */
  link: string;
  /** Google搜索结果URL */
  googleUrl: string;
  /** 搜索结果位置 */
  position: number;
}

/**
 * 单个图片搜索结果（简化版本）
 */
export interface ImageSearchResult {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
  thumbnail?: string;
  alt?: string;
}

/**
 * 图片搜索查询结果（简化版本）
 */
export interface ImageSearchQueryResult {
  query: string;
  total_found: number;
  images: {
    title: string;
    imageUrl: string;
    link: string;
  }[];
}

/**
 * 图片搜索API响应
 */
export interface ImageSearchApiResponse {
  /** 搜索参数 */
  searchParameters: ImageSearchParameters;
  /** 图片结果数组 */
  images: ImageSearchResultDetailed[];
  /** 使用的积分 */
  credits: number;
}

/**
 * 图片搜索错误响应
 */
export interface ImageSearchErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
