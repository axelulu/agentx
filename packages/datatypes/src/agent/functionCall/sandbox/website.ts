// ===== 网站管理工具参数 =====

/**
 * 初始化网站工具输入参数
 */
export interface InitializeWebsiteParams {
  projectName: string;
  createDatabase?: boolean;
}

/**
 * 安装网站依赖工具输入参数
 */
export interface InstallWebsiteDependenciesParams {
  projectPath: string;
  packages?: string[];
}

/**
 * 构建网站工具输入参数
 */
export interface BuildWebsiteParams {
  projectPath: string;
  buildCommand?: string;
}

/**
 * 启动开发服务器工具输入参数
 */
export interface StartDevServerParams {
  projectPath: string;
}

/**
 * 启动开发服务器工具返回结果
 */
export interface StartDevServerResult {
  port: number;
  previewUrl: string;
  typeCheckPassed: boolean;
  supervisordManaged: boolean;
  serverStarted: boolean;
  startupLogs?: string;
}

/**
 * 部署网站工具输入参数
 */
export interface DeployWebsiteParams {
  projectPath: string;
  buildOutputDir?: string;
  environmentVars?: Record<string, string>;
}

/**
 * 获取网站信息工具输入参数
 */
export interface GetWebsiteInfoParams {
  projectPath: string;
}

export interface WebsiteProjectInfo {
  projectPath: string;
  template: string;
  framework: string;
  packageManager: string;
  database?: {
    provider: string;
    projectId: string;
    databaseName: string;
    host: string;
    connectionString: string;
  } | null;
  vercel?: {
    projectId: string;
    teamId?: string;
  } | null;
}

export interface DatabaseCredentials {
  host: string;
  database: string;
  username: string;
  password: string;
  connectionString: string;
  port: number;
}

export interface NeonProjectInfo {
  projectId: string;
  branchId: string;
  databaseName: string;
  credentials: DatabaseCredentials;
}

// ===== Vercel 部署工具参数 =====

/**
 * Vercel 部署参数
 */
export interface VercelDeployParams {
  projectSlug: string;
  production?: boolean;
  environmentVars?: Record<string, string>;
  buildCommand?: string;
  outputDirectory?: string;
  framework?: string;
  teamId?: string;
}

/**
 * Vercel 部署参数（简化版，用于 WebSocket 触发的部署）
 * projectSlug 等信息从数据库中的 session 关联的 project 获取
 */
export interface VercelDeployFromSessionParams {
  teamId?: string;
}

/**
 * Vercel 环境变量参数
 */
export interface VercelEnvVarParams {
  projectId: string;
  key: string;
  value: string;
  target?: ("production" | "preview" | "development")[];
  type?: "plain" | "encrypted" | "secret";
  gitBranch?: string;
}

/**
 * Vercel 自定义域名参数
 */
export interface VercelDomainParams {
  projectId: string;
  domain: string;
  gitBranch?: string;
  redirect?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
}

/**
 * Vercel 部署信息
 */
export interface VercelDeploymentInfo {
  id: string;
  url: string;
  inspectorUrl?: string;
  status: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  readyState: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  createdAt: number;
  buildingAt?: number;
  ready?: number;
  target?: "production" | "staging" | null;
  aliasAssigned?: number | boolean | null;
  aliasError?: {
    code: string;
    message: string;
  } | null;
  projectId?: string;
  name?: string;
}

/**
 * Vercel 项目信息
 */
export interface VercelProjectInfo {
  id: string;
  name: string;
  framework?: string;
  createdAt: number;
  updatedAt?: number;
  env?: Array<{
    id: string;
    key: string;
    value?: string;
    target: string[];
    type: string;
    createdAt: number;
    updatedAt: number;
  }>;
  link?: {
    type: string;
    repo: string;
  };
}

/**
 * Vercel 部署列表参数
 */
export interface VercelListDeploymentsParams {
  projectId: string;
  limit?: number;
  since?: number;
  until?: number;
  state?:
    | "BUILDING"
    | "ERROR"
    | "INITIALIZING"
    | "QUEUED"
    | "READY"
    | "CANCELED";
  target?: "production" | "staging";
}

/**
 * Vercel 域名信息
 */
export interface VercelDomainInfo {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  createdAt: number;
  updatedAt?: number;
  gitBranch?: string;
  redirect?: string;
  redirectStatusCode?: number;
}

/**
 * Vercel 重新部署参数
 */
export interface VercelRedeployParams {
  deploymentId: string;
  name?: string;
  target?: "production" | "staging";
}

/**
 * Vercel 取消部署参数
 */
export interface VercelCancelDeploymentParams {
  deploymentId: string;
}

/**
 * Vercel 删除部署参数
 */
export interface VercelDeleteDeploymentParams {
  deploymentId: string;
}
