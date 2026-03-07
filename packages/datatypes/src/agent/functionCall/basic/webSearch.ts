// ===== Web搜索工具参数 =====

/**
 * Web搜索工具输入参数
 */
export interface WebSearchParams {
  query: string;
  numResults?: number;
}

/**
 * Web目标提取工具输入参数
 */
export interface WebGoalExtractParams {
  url: string;
  goal: string;
}

/**
 * Web目标提取工具返回结果
 */
export interface WebGoalExtractResult {
  url?: string;
  title?: string;
  content?: string;
}

// ===== Web搜索工具返回结果 =====

/**
 * 单个搜索结果
 */
export interface WebSearchResult {
  url: string;
  title: string;
  content?: string;
  score?: number;
  raw_content?: string | null;
}

/**
 * Web搜索工具返回结果
 */
export interface WebSearchToolResult {
  query: string;
  follow_up_questions: string[] | null;
  answer: string | null;
  images: string[];
  results: WebSearchResult[];
  response_time: number;
  request_id: string;
}

export interface SearchApiResult {
  query: string;
  answer: string;
  images: any[];
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content: string | null;
    favicon?: string;
  }>;
  organic: Array<{
    title: string;
    link: string;
    snippet: string;
    date?: string;
    position: number;
  }>;
  auto_parameters: {
    topic: string;
    search_depth: string;
  };
  response_time: string;
  request_id: string;
}
