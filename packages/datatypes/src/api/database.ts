/**
 * Database-related types for Neon database operations
 */

/**
 * Table information structure
 */
export interface TableInfo {
  id: string;
  name: string;
  rowCount: number;
  size: string;
  sizeBytes: number;
  schema: string;
  type: "table" | "view" | "materialized_view";
  lastModified?: Date;
  description?: string;
}

/**
 * Column information structure
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  maxLength?: number;
}

/**
 * Row data (generic key-value pairs)
 */
export interface RowData {
  [key: string]: any;
}

/**
 * Table data with pagination
 */
export interface TableData {
  columns: ColumnInfo[];
  rows: RowData[];
  totalRows: number;
  page: number;
  pageSize: number;
}

/**
 * SQL query result structure
 */
export interface QueryResult {
  columns: string[];
  rows: any[][];
  affectedRows?: number;
  executionTime?: number;
}

/**
 * API Response for listing tables
 */
export interface TablesResponse {
  success: boolean;
  data?: TableInfo[];
  error?: string;
  total?: number;
}

/**
 * API Response for table data
 */
export interface TableDataResponse {
  success: boolean;
  data?: TableData;
  error?: string;
}

/**
 * API Response for SQL query execution
 */
export interface QueryResponse {
  success: boolean;
  data?: QueryResult;
  error?: string;
}

/**
 * API Response for record operations
 */
export interface RecordResponse {
  success: boolean;
  data?: RowData;
  error?: string;
}

/**
 * Neon Branch information
 */
export interface NeonBranch {
  id: string;
  project_id: string;
  parent_id?: string;
  name: string;
  current_state: string;
  created_at: string;
  updated_at: string;
}

/**
 * Neon Database information
 */
export interface NeonDatabase {
  id: number;
  branch_id: string;
  name: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Neon Role information
 */
export interface NeonRole {
  branch_id: string;
  name: string;
  password?: string;
  protected: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Neon Connection URI
 */
export interface NeonConnectionUri {
  uri: string;
}
