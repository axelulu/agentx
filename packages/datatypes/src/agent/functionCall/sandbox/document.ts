// ===== 文档管理工具参数 =====

/**
 * 文档格式类型
 */
export type DocumentFormat = "html" | "markdown" | "json";

/**
 * 文档元数据
 */
export interface DocumentMetadata {
  description?: string;
  tags?: string[];
  author?: string;
}

/**
 * 创建文档工具输入参数
 */
export interface CreateDocumentParams {
  title: string;
  content: string;
  format?: DocumentFormat;
  metadata?: DocumentMetadata;
}

/**
 * 更新文档工具输入参数
 */
export interface UpdateDocumentParams {
  docId: string;
  title?: string;
  content?: string;
  metadata?: DocumentMetadata;
}

/**
 * 读取文档工具输入参数
 */
export interface ReadDocumentParams {
  docId: string;
}

/**
 * 列出文档工具输入参数
 */
export interface ListDocumentsParams {
  tag?: string;
}

/**
 * 删除文档工具输入参数
 */
export interface DeleteDocumentParams {
  docId: string;
}

/**
 * 获取格式指南工具输入参数
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetFormatGuideParams {
  // 无参数
}

// ===== 文档管理工具返回结果 =====

export interface DocumentApiResult {
  document?: {
    id: string;
    title: string;
    filename: string;
    format: "doc" | "markdown" | "json";
    created_at: string;
    updated_at: string;
    metadata: any;
    path: string;
    is_tiptap_doc: boolean;
    doc_type: "tiptap_document" | "plain";
  };
  content?: string;
  sandbox_id?: string;
  preview_url?: string;
  documents?: Array<{
    id: string;
    title: string;
    filename: string;
    format: "doc" | "markdown" | "json";
    created_at: string;
    updated_at: string;
    metadata: any;
    path: string;
    is_tiptap_doc: boolean;
    doc_type: "tiptap_document" | "plain";
  }>;
  count?: number;
  guide?: {
    description: string;
    supported_elements: {
      text_structure: Record<string, string | string[]>;
      text_formatting: Record<string, string>;
      lists: Record<string, string>;
      blocks: Record<string, string>;
      links_and_media: Record<string, string>;
      tables: Record<string, string>;
    };
    important_rules: string[];
    example: string;
  };
  usage_tip?: string;
}

export interface DocumentApiResponse {
  success: boolean;
  message: string;
  result?: DocumentApiResult;
}

export interface DocumentMetadata {
  description?: string;
  tags?: string[];
  author?: string;
}

export interface TipTapDocument {
  type: "tiptap_document";
  version: "1.0";
  title: string;
  content: string;
  metadata: DocumentMetadata;
  created_at: string;
  updated_at: string;
  doc_id: string;
}

export interface DocumentInfo {
  id: string;
  title: string;
  filename: string;
  format: "doc" | "markdown" | "json";
  created_at: string;
  updated_at: string;
  metadata: DocumentMetadata;
  path: string;
  is_tiptap_doc: boolean;
  doc_type: "tiptap_document" | "plain";
}

export interface DocumentsMetadata {
  documents: Record<string, DocumentInfo>;
}

export interface DocumentResult {
  success: boolean;
  document?: DocumentInfo;
  content?: string;
  sandbox_id?: string;
  preview_url?: string;
  message?: string;
  error?: string;
}

export interface DocumentListResult {
  success: boolean;
  documents?: DocumentInfo[];
  count?: number;
  sandbox_id?: string;
  error?: string;
}

export interface FormatGuideResult {
  success: boolean;
  guide?: {
    description: string;
    supported_elements: {
      text_structure: Record<string, string | string[]>;
      text_formatting: Record<string, string>;
      lists: Record<string, string>;
      blocks: Record<string, string>;
      links_and_media: Record<string, string>;
      tables: Record<string, string>;
    };
    important_rules: string[];
    example: string;
  };
  message?: string;
  error?: string;
}
