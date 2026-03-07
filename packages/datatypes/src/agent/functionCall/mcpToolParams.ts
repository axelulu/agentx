/**
 * MCP工具参数类型定义
 *
 * 此文件定义了所有MCP工具的类型安全参数接口
 * 支持IntelliSense和编译时类型检查
 */

// ===== 重新导出所有工具类型 =====
export * from "./basic";
export * from "./sandbox";

import type { ExecutionPlan } from "../../agent/plan";
// ===== 导入类型用于映射 =====
import type {
  AudioGenerationParams,
  AudioGenerationResult,
} from "./basic/audioGeneration";
import type {
  AudioScriptGenerationParams,
  AudioScriptGenerationResult,
} from "./basic/audioScriptGeneration";
import type { GenerateSessionInfoParams } from "./basic/chat";
import type {
  ImageGenerationParams,
  ImageGenerationResult,
} from "./basic/imageGeneration";
import type {
  ImageSearchParams,
  ImageSearchQueryResult,
} from "./basic/imageSearch";
import type { AskParams, AskResult, ContinueParams } from "./basic/router";
import type {
  CompleteParams,
  NotifyUserParams,
  NotifyUserResult,
  NotifyVercelDeploymentParams,
  NotifyVercelDeploymentResult,
} from "./basic/message";
import type { ContinuePlanParams, RevisePlanParams } from "./basic/plan";
import type { GenerateSessionDetailParams } from "./basic/sessionDetail";
import type {
  StoryboardGenerationParams,
  StoryboardGenerationResult,
} from "./basic/storyboardGeneration";
import type {
  VideoGenerationParams,
  VideoGenerationResult,
} from "./basic/videoGeneration";
import type {
  VideoScriptGenerationParams,
  VideoScriptGenerationResult,
} from "./basic/videoScriptGeneration";
import type {
  WebGoalExtractParams,
  WebGoalExtractResult,
  WebSearchParams,
  WebSearchResult,
} from "./basic/webSearch";
import type {
  BrowserAutomationApiResult,
  BrowserClickCoordinatesParams,
  BrowserClickElementParams,
  BrowserCloseTabParams,
  BrowserDragDropParams,
  BrowserExtractPageContentParams,
  BrowserGetDropdownOptionsParams,
  BrowserGoBackParams,
  BrowserInputTextParams,
  BrowserNavigateParams,
  BrowserOpenTabParams,
  BrowserSavePdfParams,
  BrowserScrollDownParams,
  BrowserScrollToTextParams,
  BrowserScrollUpParams,
  BrowserSelectDropdownOptionParams,
  BrowserSendKeysParams,
  BrowserSwitchTabParams,
  BrowserWaitParams,
} from "./sandbox/browser";
import type {
  CreateDocumentParams,
  DeleteDocumentParams,
  DocumentApiResult,
  GetFormatGuideParams,
  ListDocumentsParams,
  ReadDocumentParams,
  UpdateDocumentParams,
} from "./sandbox/document";
import type {
  CreateFileParams,
  DeleteFileParams,
  FileApiResult,
  FullFileRewriteParams,
  ReadFileParams,
  ReadFileRangeParams,
  StringReplaceParams,
} from "./sandbox/file";
import type {
  CreatePresentationOutlineParams,
  CreateSlideParams,
  DeletePresentationParams,
  DeleteSlideParams,
  ListAllPresentationsParams,
  ListSlidesParams,
  PresentationApiResult,
} from "./sandbox/presentation";
import type {
  AnalyzeSheetParams,
  CreateSheetParams,
  FormatSheetParams,
  SheetsApiResult,
  UpdateSheetParams,
  ViewSheetParams,
  VisualizeSheetParams,
} from "./sandbox/sheet";
import type {
  CheckCommandOutputParams,
  ListCommandsParams,
  RunCommandParams,
  ShellExecutionResult,
  TerminateCommandParams,
} from "./sandbox/shell";
import type {
  BuildWebsiteParams,
  DeployWebsiteParams,
  GetWebsiteInfoParams,
  InitializeWebsiteParams,
  InstallWebsiteDependenciesParams,
  StartDevServerParams,
  StartDevServerResult,
} from "./sandbox/website";

// ===== 工具参数映射类型 =====

/**
 * 工具名称到参数类型的映射
 * 用于提供类型安全的工具调用
 */
export interface MCPToolParamsMap {
  // 演示文稿工具
  presentation_create_slide: CreateSlideParams;
  presentation_list_slides: ListSlidesParams;
  presentation_delete_slide: DeleteSlideParams;
  presentation_list_all: ListAllPresentationsParams;
  presentation_delete: DeletePresentationParams;
  presentation_create_outline: CreatePresentationOutlineParams;

  // 文件管理工具
  file_create: CreateFileParams;
  file_replace: StringReplaceParams;
  file_rewrite: FullFileRewriteParams;
  file_delete: DeleteFileParams;
  file_read: ReadFileParams;
  file_read_range: ReadFileRangeParams;

  // 浏览器自动化工具
  browser_navigate: BrowserNavigateParams;
  browser_go_back: BrowserGoBackParams;
  browser_wait: BrowserWaitParams;
  browser_click_element: BrowserClickElementParams;
  browser_click_coordinates: BrowserClickCoordinatesParams;
  browser_input_text: BrowserInputTextParams;
  browser_send_keys: BrowserSendKeysParams;
  browser_switch_tab: BrowserSwitchTabParams;
  browser_open_tab: BrowserOpenTabParams;
  browser_close_tab: BrowserCloseTabParams;
  browser_extract_page_content: BrowserExtractPageContentParams;
  browser_save_pdf: BrowserSavePdfParams;
  browser_scroll_down: BrowserScrollDownParams;
  browser_scroll_up: BrowserScrollUpParams;
  browser_scroll_to_text: BrowserScrollToTextParams;
  browser_get_dropdown_options: BrowserGetDropdownOptionsParams;
  browser_select_dropdown_option: BrowserSelectDropdownOptionParams;
  browser_drag_drop: BrowserDragDropParams;

  // 网站管理工具
  website_initialize: InitializeWebsiteParams;
  website_install_dependencies: InstallWebsiteDependenciesParams;
  website_build: BuildWebsiteParams;
  website_start_dev_server: StartDevServerParams;
  website_deploy: DeployWebsiteParams;
  website_get_info: GetWebsiteInfoParams;
  notify_vercel_deployment: NotifyVercelDeploymentParams;

  // Shell执行工具
  shell_run: RunCommandParams;
  shell_check_output: CheckCommandOutputParams;
  shell_terminate: TerminateCommandParams;
  shell_list: ListCommandsParams;

  // 文档管理工具
  create_document: CreateDocumentParams;
  update_document: UpdateDocumentParams;
  read_document: ReadDocumentParams;
  list_documents: ListDocumentsParams;
  delete_document: DeleteDocumentParams;
  get_format_guide: GetFormatGuideParams;

  // 电子表格工具
  sheet_create: CreateSheetParams;
  sheet_view: ViewSheetParams;
  sheet_update: UpdateSheetParams;
  sheet_analyze: AnalyzeSheetParams;
  sheet_visualize: VisualizeSheetParams;
  sheet_format: FormatSheetParams;

  // 网络搜索工具
  web_search: WebSearchParams;
  web_goal_extract: WebGoalExtractParams;

  // 计划管理工具
  revise_plan: RevisePlanParams;
  continue_plan: ContinuePlanParams;

  // 图片搜索工具
  image_search: ImageSearchParams;

  // 图片生成工具
  image_generation: ImageGenerationParams;

  // 视频生成工具
  video_generation: VideoGenerationParams;

  // 视频脚本生成工具
  video_script_generation: VideoScriptGenerationParams;

  // 音频生成工具
  audio_generation: AudioGenerationParams;

  // 音频脚本生成工具
  audio_script_generation: AudioScriptGenerationParams;

  // 分镜生成工具
  storyboard_generation: StoryboardGenerationParams;

  // 消息通知工具
  notify_user: NotifyUserParams;

  // Router工具
  ask: AskParams;
  continue: ContinueParams;

  // 会话管理工具
  generate_session_info: GenerateSessionInfoParams;
  generate_session_detail: GenerateSessionDetailParams;
  complete: CompleteParams;
}

// ===== 工具返回类型映射 =====

/**
 * 工具名称到返回类型的映射
 * 用于提供类型安全的工具返回值
 */
export interface MCPToolResultMap {
  // 演示文稿工具
  presentation_create_slide: PresentationApiResult;
  presentation_list_slides: PresentationApiResult;
  presentation_delete_slide: PresentationApiResult;
  presentation_list_all: PresentationApiResult;
  presentation_delete: PresentationApiResult;
  presentation_create_outline: PresentationApiResult;

  // 文件管理工具
  file_create: FileApiResult;
  file_replace: FileApiResult;
  file_rewrite: FileApiResult;
  file_delete: FileApiResult;
  file_read: FileApiResult;
  file_read_range: FileApiResult;

  // 浏览器自动化工具
  browser_navigate: BrowserAutomationApiResult;
  browser_go_back: BrowserAutomationApiResult;
  browser_wait: BrowserAutomationApiResult;
  browser_click_element: BrowserAutomationApiResult;
  browser_click_coordinates: BrowserAutomationApiResult;
  browser_input_text: BrowserAutomationApiResult;
  browser_send_keys: BrowserAutomationApiResult;
  browser_switch_tab: BrowserAutomationApiResult;
  browser_open_tab: BrowserAutomationApiResult;
  browser_close_tab: BrowserAutomationApiResult;
  browser_extract_page_content: BrowserAutomationApiResult;
  browser_save_pdf: BrowserAutomationApiResult;
  browser_scroll_down: BrowserAutomationApiResult;
  browser_scroll_up: BrowserAutomationApiResult;
  browser_scroll_to_text: BrowserAutomationApiResult;
  browser_get_dropdown_options: BrowserAutomationApiResult;
  browser_select_dropdown_option: BrowserAutomationApiResult;
  browser_drag_drop: BrowserAutomationApiResult;

  // 网站管理工具
  website_initialize: ShellExecutionResult;
  website_install_dependencies: ShellExecutionResult;
  website_build: ShellExecutionResult;
  website_start_dev_server: StartDevServerResult;
  website_deploy: ShellExecutionResult;
  website_get_info: ShellExecutionResult;
  notify_vercel_deployment: NotifyVercelDeploymentResult;

  // Shell执行工具
  shell_run: ShellExecutionResult;
  shell_check_output: ShellExecutionResult;
  shell_terminate: ShellExecutionResult;
  shell_list: ShellExecutionResult;

  // 文档管理工具
  create_document: DocumentApiResult;
  update_document: DocumentApiResult;
  read_document: DocumentApiResult;
  list_documents: DocumentApiResult;
  delete_document: DocumentApiResult;
  get_format_guide: DocumentApiResult;

  // 电子表格工具
  sheet_create: SheetsApiResult;
  sheet_view: SheetsApiResult;
  sheet_update: SheetsApiResult;
  sheet_analyze: SheetsApiResult;
  sheet_visualize: SheetsApiResult;
  sheet_format: SheetsApiResult;

  // 网络搜索工具
  web_search: WebSearchResult[];
  web_goal_extract: WebGoalExtractResult;

  // 计划管理工具
  revise_plan: ExecutionPlan;
  continue_plan: ExecutionPlan;

  // 图片搜索工具
  image_search: ImageSearchQueryResult;

  // 图片生成工具
  image_generation: ImageGenerationResult;

  // 视频生成工具
  video_generation: VideoGenerationResult;

  // 视频脚本生成工具
  video_script_generation: VideoScriptGenerationResult;

  // 音频生成工具
  audio_generation: AudioGenerationResult;

  // 音频脚本生成工具
  audio_script_generation: AudioScriptGenerationResult;

  // 分镜生成工具
  storyboard_generation: StoryboardGenerationResult;

  // 消息通知工具
  notify_user: NotifyUserResult;

  // Router工具
  ask: AskResult;
  continue: string;

  // 会话管理工具
  generate_session_info: string;
  generate_session_detail: string;
  complete: string;
}

// ===== 类型安全工具调用 =====

/**
 * 工具名称联合类型
 */
export type MCPToolName = keyof MCPToolParamsMap;

/**
 * 根据工具名称获取对应的参数类型
 */
export type MCPToolParams<T extends MCPToolName> = MCPToolParamsMap[T];

/**
 * 根据工具名称获取对应的返回类型
 */
export type MCPToolResult<T extends MCPToolName> = MCPToolResultMap[T];

/**
 * 所有可能的工具参数类型的联合
 */
export type AllMCPToolParams = MCPToolParamsMap[MCPToolName];

/**
 * 所有可能的工具返回类型的联合
 */
export type AllMCPToolResults = MCPToolResultMap[MCPToolName];

// ===== 类型安全的工具调用类型 =====

/**
 * 类型安全的工具调用类型（使用映射类型自动推断）
 * 通过 name 字段可以自动推断 input 的类型
 *
 * 工作原理：
 * 1. [K in MCPToolName] 遍历所有工具名称
 * 2. 为每个工具名称创建一个对象，包含 id, name, input
 * 3. input 的类型根据 name 自动推断
 * 4. [MCPToolName] 索引访问，将映射类型转换为联合类型（Discriminated Union）
 */
export type ToolCall = {
  [K in MCPToolName]: {
    id: string;
    name: K;
    input: MCPToolParams<K>;
  };
}[MCPToolName];
