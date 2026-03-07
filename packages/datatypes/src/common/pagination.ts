/**
 * 分页参数接口
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * 分页元数据接口
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
  nextPage: number | null;
  previousPage: number | null;
}

/**
 * 分页响应接口（统一规范）
 */
export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
  pagination?: PaginationMeta;
  detail?: {
    [key: string]: any;
  };
}
