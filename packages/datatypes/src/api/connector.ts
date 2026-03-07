/**
 * Connector API types
 * Defines types for connector management system
 */

// ============================================================================
// Enums
// ============================================================================

export type ConnectorType = "mcp" | "api";
export type ConnectorSource = "official" | "custom";
export type AuthorizationStatus = "active" | "inactive" | "expired" | "error";
export type AuthenticationType =
  | "none"
  | "bearer"
  | "apiKey"
  | "basic"
  | "oauth2";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * OAuth configuration
 * Supports various OAuth providers with different requirements
 */
export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string; // May be stored server-side only
  scopes?: string[];
  pkce?: boolean; // Whether to use PKCE
  // Additional OAuth parameters (provider-specific)
  additionalAuthParams?: Record<string, string>; // e.g., { owner: "user" } for Notion
  additionalTokenParams?: Record<string, string>; // Extra params for token exchange
}

/**
 * Authorization credentials (for OAuth or other auth methods)
 */
export interface Credentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
  tokenType?: string; // e.g., "Bearer"
  scope?: string;
  // Additional provider-specific fields
  [key: string]: any;
}

/**
 * MCP STDIO configuration
 */
export interface MCPStdioConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  oauth?: OAuthConfig;
}

/**
 * MCP SSE configuration
 */
export interface MCPSSEConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
  oauth?: OAuthConfig;
}

/**
 * MCP HTTP configuration
 */
export interface MCPHttpConfig {
  type: "http" | "streamableHttp";
  url: string;
  headers?: Record<string, string>;
  oauth?: OAuthConfig;
}

/**
 * MCP connector configuration (union of all MCP types)
 */
export type MCPConfig = MCPStdioConfig | MCPSSEConfig | MCPHttpConfig;

/**
 * API connector configuration
 */
export interface APIConfig {
  baseUrl: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  authenticationType?: AuthenticationType;
  authCredentials?: Record<string, string>; // For API key, basic auth, etc.
  requestTemplate?: string; // JSON template for request body
  responseMapping?: Record<string, string>; // Map response fields to expected format
  timeout?: number; // Request timeout in ms
  oauth?: OAuthConfig;
}

/**
 * MCP servers JSON import format
 */
export interface MCPServersImport {
  mcpServers: Record<string, MCPConfig>;
}

/**
 * Unified connector configuration (union of MCP and API configs)
 */
export type ConnectorConfig = MCPConfig | APIConfig;

// ============================================================================
// Database Entity Types
// ============================================================================

/**
 * Connector entity (from database)
 * Stores connector definitions (official templates and user custom connectors)
 * - userId = null: Official templates (visible to all users)
 * - userId = string: User's custom connectors
 */
export interface Connector {
  id: string;
  userId: string | null;
  name: string;
  description?: string;
  type: ConnectorType;
  source: ConnectorSource;
  config?: ConnectorConfig;
  icon?: string;
  category?: string;
  tags: string[];
  documentationUrl?: string;
  exampleUsage?: string;
  version?: string;
  author?: string;
  featured?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Connector Authorization entity
 * Stores user authorization/credentials for connectors
 * One connector can have multiple user authorizations (one-to-many)
 */
export interface ConnectorAuthorization {
  id: string;
  connectorId: string;
  userId: string;
  status: AuthorizationStatus;
  enabled: boolean;
  credentials?: Credentials;
  lastUsedAt?: Date;
  usageCount: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Official connector template entity
 */
export interface OfficialConnector {
  id: string;
  name: string;
  description: string;
  type: ConnectorType;
  config: ConnectorConfig;
  icon: string;
  category: string;
  tags: string[];
  documentationUrl?: string;
  exampleUsage?: string;
  version: string;
  author: string;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Create connector request
 */
export interface CreateConnectorRequest {
  name: string;
  description?: string;
  type: ConnectorType;
  source: ConnectorSource;
  config: ConnectorConfig;
  icon?: string;
  tags?: string[];
}

/**
 * Update connector request
 */
export interface UpdateConnectorRequest {
  name?: string;
  description?: string;
  config?: ConnectorConfig;
  icon?: string;
  tags?: string[];
}

/**
 * Connector list query params
 */
export interface ConnectorListQuery {
  type?: ConnectorType;
  source?: ConnectorSource;
  status?: AuthorizationStatus; // Filter by authorization status
  enabled?: boolean; // Filter by enabled status
  search?: string; // Search by name/description
  tags?: string[]; // Filter by tags
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt" | "usageCount" | "lastUsedAt";
  sortOrder?: "asc" | "desc";
}

/**
 * Official connector list query params
 */
export interface OfficialConnectorListQuery {
  type?: ConnectorType;
  category?: string;
  featured?: boolean;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

/**
 * Connector response (with authorization info)
 * Combines connector definition with user's authorization
 */
export interface ConnectorResponse extends Connector {
  // Authorization info (if user has authorized this connector)
  authorization?: ConnectorAuthorization;
  // Computed field
  isOfficial: boolean;
}

/**
 * Connector list response
 */
export interface ConnectorListResponse {
  connectors: ConnectorResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Official connector list response
 */
export interface OfficialConnectorListResponse {
  connectors: OfficialConnector[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  categories: string[]; // Available categories
}

/**
 * Test connector request
 */
export interface TestConnectorRequest {
  config: ConnectorConfig;
  type: ConnectorType;
}

/**
 * Test connector response
 */
export interface TestConnectorResponse {
  success: boolean;
  message: string;
  details?: {
    responseTime?: number;
    statusCode?: number;
    availableTools?: string[]; // For MCP connectors
    sampleResponse?: any; // For API connectors
  };
  error?: string;
}

/**
 * MCP authorization request
 */
export interface MCPAuthorizationRequest {
  connectorId: string;
  authorizationCode?: string; // For OAuth flow
  credentials?: Credentials; // For direct credential input
  redirectUri?: string; // OAuth redirect URI
  state?: string; // OAuth state parameter
}

/**
 * MCP authorization response
 */
export interface MCPAuthorizationResponse {
  success: boolean;
  message: string;
  connector?: ConnectorResponse;
  authUrl?: string; // OAuth authorization URL if needed
  error?: string;
}

/**
 * OAuth initiate request - starts the OAuth flow
 */
export interface OAuthInitiateRequest {
  connectorId: string;
  redirectUri: string;
}

/**
 * OAuth initiate response - returns the authorization URL
 */
export interface OAuthInitiateResponse {
  success: boolean;
  authUrl?: string;
  state?: string; // State parameter for CSRF protection
  error?: string;
}

/**
 * OAuth callback request - handles the OAuth callback
 */
export interface OAuthCallbackRequest {
  connectorId: string;
  code: string;
  state: string;
  redirectUri: string;
}

/**
 * OAuth callback response
 */
export interface OAuthCallbackResponse {
  success: boolean;
  message: string;
  connector?: ConnectorResponse;
  error?: string;
}
