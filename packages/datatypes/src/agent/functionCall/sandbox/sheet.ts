// ===== 电子表格工具参数 =====

/**
 * 图表类型
 */
export type ChartType = "bar" | "line" | "pie" | "scatter";

/**
 * 电子表格操作类型
 */
export type SheetOperationType =
  | "update_cell"
  | "update_row"
  | "insert_row"
  | "delete_row"
  | "insert_column"
  | "delete_column";

/**
 * 聚合函数类型
 */
export type AggregationType = "count" | "sum" | "avg" | "min" | "max";

/**
 * 电子表格操作
 */
export interface SheetOperation {
  type: SheetOperationType;
  rowIndex?: number;
  column?: string;
  columnIndex?: number;
  values?: any[];
  value?: string | number | null;
}

/**
 * 条件格式设置
 */
export interface ConditionalFormat {
  column: string;
  minColor?: string;
  midColor?: string;
  maxColor?: string;
}

/**
 * 创建电子表格工具输入参数
 */
export interface CreateSheetParams {
  filePath: string;
  headers?: string[];
  rows?: any[][];
  sheetName?: string;
  overwrite?: boolean;
}

/**
 * 查看电子表格工具输入参数
 */
export interface ViewSheetParams {
  filePath: string;
  sheetName?: string;
  maxRows?: number;
  exportCsvPath?: string;
}

/**
 * 更新电子表格工具输入参数
 */
export interface UpdateSheetParams {
  filePath: string;
  operations: SheetOperation[];
  sheetName?: string;
  saveAs?: string;
}

/**
 * 分析电子表格工具输入参数
 */
export interface AnalyzeSheetParams {
  filePath: string;
  sheetName?: string;
  targetColumns?: string[];
  groupBy?: string;
  aggregations?: AggregationType[];
  exportCsvPath?: string;
}

/**
 * 可视化电子表格工具输入参数
 */
export interface VisualizeSheetParams {
  filePath: string;
  xColumn: string;
  yColumns: string[];
  sheetName?: string;
  chartType?: ChartType;
  saveAs?: string;
  exportCsvPath?: string;
}

/**
 * 格式化电子表格工具输入参数
 */
export interface FormatSheetParams {
  filePath: string;
  sheetName?: string;
  boldHeaders?: boolean;
  autoWidth?: boolean;
  applyBanding?: boolean;
  conditionalFormat?: ConditionalFormat;
}

// ===== 电子表格工具返回结果 =====

export interface SheetsApiResult {
  filePath?: string;
  headers?: string[];
  rowCount?: number;
  sampleRows?: (string | number | null)[][];
  exportedCsv?: string;
  updatedPath?: string;
  analyzedFrom?: string;
  resultPreview?: {
    headers: string[];
    rows: (string | number | null)[][];
  };
  source?: string;
  chartSaved?: string;
  chartType?: string;
  chartDataCsv?: string;
  formatted?: string;
  sheet?: string;
  size?: number;
}

export interface SheetsApiResponse {
  success: boolean;
  message: string;
  result?: SheetsApiResult;
}

export interface SheetData {
  headers: string[];
  rows: (string | number | null)[][];
}

export interface SheetsOperationResult {
  success: boolean;
  message: string;
  data?: any;
}
