import type { AttachedFile } from "../api/file";
import type { ConnectorConfig, Credentials } from "../api/connector";
import type { ProjectType, RoleType } from "../api/session";
import type { UserInfo } from "../api/user";
import type { ModeOptions } from "../ws/client";

/**
 * Available knowledge bases
 * Note: This should match the KNOWLEDGE_BASES configuration in backend
 */
export type KnowledgeBaseType = "none" | "website" | string;

/**
 * Connector info for agent MCP integration
 */
export interface AgentConnectorInfo {
  connectorId: string;
  name: string;
  type: "mcp" | "api";
  config: ConnectorConfig;
  credentials?: Credentials;
}

/**
 * Agent run configuration
 */
export interface AgentRunConfig {
  sessionId: string;
  message: string;
  files?: AttachedFile[];
  userInfo: UserInfo;
  options?: ModeOptions;
  executionMode?:
    | "new_conversation"
    | "resume_plan"
    | "continue_plan"
    | "append_plan";
  projectType?: ProjectType;
  knowledgeBase?: KnowledgeBaseType;
  sandboxInfo?: {
    sandboxId: string;
    fileServerUrl: string | undefined;
    vncUrl: string | undefined;
    computerUseUrl: string | undefined;
    vncPassword: string | undefined;
    websiteUrl: string | undefined;
  };
  connectors?: AgentConnectorInfo[];
  buildId?: string;
  instanceId?: string;
}

/**
 * Chat message type
 */
export interface AgentMessage {
  role: RoleType;
  content: string | any;
}
