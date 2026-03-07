// ===== 浏览器自动化工具参数 =====

/**
 * 浏览器导航工具输入参数（仅导航，不提取内容）
 */
export interface BrowserNavigateParams {
  url: string;
}

/**
 * 浏览器后退工具输入参数
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BrowserGoBackParams {
  // 无参数
}

/**
 * 浏览器等待工具输入参数
 */
export interface BrowserWaitParams {
  seconds?: number;
}

/**
 * 浏览器点击元素工具输入参数
 */
export interface BrowserClickElementParams {
  index: number;
}

/**
 * 浏览器点击坐标工具输入参数
 */
export interface BrowserClickCoordinatesParams {
  x: number;
  y: number;
}

/**
 * 浏览器输入文本工具输入参数
 */
export interface BrowserInputTextParams {
  index: number;
  text: string;
}

/**
 * 浏览器发送按键工具输入参数
 */
export interface BrowserSendKeysParams {
  keys: string;
}

/**
 * 浏览器切换标签页工具输入参数
 */
export interface BrowserSwitchTabParams {
  pageId: number;
}

/**
 * 浏览器打开新标签页工具输入参数
 */
export interface BrowserOpenTabParams {
  url: string;
}

/**
 * 浏览器关闭标签页工具输入参数
 */
export interface BrowserCloseTabParams {
  pageId: number;
}

/**
 * 浏览器提取页面内容工具输入参数
 */
export interface BrowserExtractPageContentParams {
  goal: string;
}

/**
 * 浏览器保存PDF工具输入参数
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BrowserSavePdfParams {
  // 无参数
}

/**
 * 浏览器向下滚动工具输入参数
 */
export interface BrowserScrollDownParams {
  amount?: number;
}

/**
 * 浏览器向上滚动工具输入参数
 */
export interface BrowserScrollUpParams {
  amount?: number;
}

/**
 * 浏览器滚动到文本工具输入参数
 */
export interface BrowserScrollToTextParams {
  text: string;
}

/**
 * 浏览器获取下拉选项工具输入参数
 */
export interface BrowserGetDropdownOptionsParams {
  index: number;
}

/**
 * 浏览器选择下拉选项工具输入参数
 */
export interface BrowserSelectDropdownOptionParams {
  index: number;
  optionText: string;
}

/**
 * 浏览器拖放工具输入参数
 */
export interface BrowserDragDropParams {
  elementSource?: string;
  elementTarget?: string;
  coordSourceX?: number;
  coordSourceY?: number;
  coordTargetX?: number;
  coordTargetY?: number;
  steps?: number;
  delayMs?: number;
}

// ===== 浏览器自动化工具返回结果 =====

export interface BrowserAutomationApiResult {
  url?: string;
  title?: string;
  elements?: string;
  screenshot_base64?: string;
  screenshotPath?: string;
  pixels_above?: number;
  pixels_below?: number;
  content?: string;
  ocr_text?: string;
  element_count?: number;
  interactive_elements?: Array<Record<string, any>>;
  viewport_width?: number;
  viewport_height?: number;
}

export interface OriginBrowserAutomationApiResponse {
  success: boolean;
  message: string;
  error?: string;
  url?: string;
  title?: string;
  elements?: string;
  screenshot_base64?: string;
  pixels_above?: number;
  pixels_below?: number;
  content?: string;
  ocr_text?: string;
  element_count?: number;
  interactive_elements?: Array<Record<string, any>>;
  viewport_width?: number;
  viewport_height?: number;
}

export interface BrowserAutomationApiResponse {
  success: boolean;
  message: string;
  result?: BrowserAutomationApiResult;
}
