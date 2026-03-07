import type { KnowledgeBaseType } from "../../../agent/agent";

/**
 * 单个选项的定义
 */
export interface AskOption {
  /** 选项的唯一标识 */
  id: string;
  /** 选项显示的标签文本 */
  label: string;
  /** 选项的详细描述（可选） */
  description?: string;
}

/**
 * 单个问题的定义
 */
export interface AskQuestion {
  /** 问题的唯一标识符,用于识别答案 */
  key: string;
  /** 问题文本 */
  text: string;
  /** 预设选项列表 */
  options: AskOption[];
  /** 是否允许用户自定义输入（默认 true） */
  allowCustomInput?: boolean;
}

/**
 * Ask工具输入参数（支持多步骤问题）
 */
export interface AskParams {
  /** 问题数组,支持单个或多个问题 */
  questions: AskQuestion[];
}

/**
 * 单个问题的答案
 */
export interface AskQuestionAnswer {
  /** 问题的唯一标识符 */
  key: string;
  /** 用户选择的选项ID（如果选择了预设选项） */
  selectedOptionId?: string;
  /** 用户选择的选项标签 */
  selectedOptionLabel?: string;
  /** 用户自定义输入的内容（如果选择了自定义） */
  customInput?: string;
  /** 是否为自定义输入 */
  isCustomInput: boolean;
}

/**
 * Ask工具返回结果（支持多步骤答案）
 */
export interface AskResult {
  /** 所有问题的答案数组 */
  answers: AskQuestionAnswer[];
}

/**
 * Continue工具输入参数
 */
export interface ContinueParams {
  /** 选择为此会话加载哪个专业知识库 */
  knowledgeBase: KnowledgeBaseType;
}
