import type {
  AgentRunConfig,
  AudioGenerationResult,
  AudioScriptGenerationResult,
  BrowserAutomationApiResult,
  DocumentApiResult,
  FileApiResult,
  ImageGenerationResult,
  ImageSearchQueryResult,
  NotifyUserResult,
  PresentationApiResult,
  SheetsApiResult,
  ShellExecutionResult,
  StartDevServerResult,
  VideoGenerationResult,
  VideoScriptGenerationResult,
  WebSearchResult,
} from "@workspace/datatypes";
import type {
  AllMCPToolParams,
  MCPToolName,
  MCPToolParams,
  NotifyVercelDeploymentResult,
} from "./mcpToolParams";

// ===== Tool Type =====

export type ToolType = "normal" | "terminal" | "interrupt";

// ===== MCP工具执行参数 =====

// 工具调用请求
export interface ToolCallRequest {
  toolName: MCPToolName | string;
  parameters?: AllMCPToolParams | Record<string, unknown>;
}

export type ToolInfo = {
  name: string;
  description: string;
  category: string;
  inputSchema: ToolInputSchema;
  toolType?: ToolType;
};

export type ToolCallResultParams =
  | WebSearchResult[]
  | ImageSearchQueryResult
  | ImageGenerationResult
  | VideoGenerationResult
  | VideoScriptGenerationResult
  | AudioGenerationResult
  | AudioScriptGenerationResult
  | NotifyUserResult
  | BrowserAutomationApiResult
  | DocumentApiResult
  | FileApiResult
  | PresentationApiResult
  | ShellExecutionResult
  | SheetsApiResult
  | StartDevServerResult
  | NotifyVercelDeploymentResult
  | string;

export type ToolCallResult = {
  success: boolean;
  toolName: string;
  category?: string;
  result?: ToolCallResultParams;
  error?: string;
  timestamp: string;
};

/**
 * 工具输入参数的属性定义
 */
export interface ToolProperty {
  type?: "string" | "integer" | "number" | "boolean" | "array" | "object";
  description: string;
  additionalProperties?: Record<string, string>;
  items?: Record<string, unknown>;
  default?: any;
  [key: string]: unknown;
}

/**
 * 工具输入参数的schema定义
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, ToolProperty>;
  required?: string[];
  [key: string]: unknown;
}

// Agent工具执行响应接口
export interface MCPToolResponse {
  success: boolean;
  result?: ToolCallResultParams;
  message: string;
}

/**
 * 类型安全的MCP工具配置接口
 */
export interface TypeSafeMCPToolConfig<T extends MCPToolName> {
  name: T;
  description: string;
  input_schema: ToolInputSchema;
  category: string;
  toolType?: ToolType;
  handler: (
    params: MCPToolParams<T>,
    context: AgentRunConfig,
  ) => Promise<MCPToolResponse | void>;
}

export const createMCPToolResponse = (
  result: MCPToolResponse,
): MCPToolResponse => {
  const { success, message, ...dataOnly } = result;
  return {
    success,
    message,
    result: dataOnly.result,
  };
};

// ===== 类型安全的工具辅助函数 =====

/**
 * 创建类型安全的工具调用函数
 * 提供IntelliSense支持和编译时类型检查
 */
export function createTypeSafeToolCall<T extends MCPToolName>(
  toolName: T,
  params: MCPToolParams<T>,
  handler: (
    params: MCPToolParams<T>,
    context: AgentRunConfig,
  ) => Promise<MCPToolResponse>,
): {
  toolName: T;
  params: MCPToolParams<T>;
  execute: (context: AgentRunConfig) => Promise<MCPToolResponse>;
} {
  return {
    toolName,
    params,
    execute: (context: AgentRunConfig) => handler(params, context),
  };
}

/**
 * 类型安全的工具参数验证
 * 运行时验证工具参数是否符合预期类型
 */
export function validateToolParams<T extends MCPToolName>(
  toolName: T,
  params: unknown,
): params is MCPToolParams<T> {
  // 基本验证逻辑
  if (!params || typeof params !== "object") {
    return false;
  }

  // 这里可以根据需要添加更详细的验证逻辑
  // 例如检查必需参数是否存在
  return true;
}

/**
 * 类型安全的工具配置创建器
 */
export function createTypeSafeMCPToolConfig<T extends MCPToolName>(
  config: TypeSafeMCPToolConfig<T>,
): TypeSafeMCPToolConfig<T> {
  return config;
}
