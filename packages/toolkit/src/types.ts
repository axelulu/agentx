/**
 * Toolkit Package Types
 * Self-contained type definitions — no external dependencies.
 */

// ============================================================
// Logger
// ============================================================

export interface ToolkitLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================
// Config
// ============================================================

export interface ToolkitInit {
  /** Root directory containing prompts/, capabilities/, skills/, config/ */
  basePath: string;
  /** Language code, e.g. "en" or "zh" */
  language: string;
  /** Optional logger (defaults to silent) */
  logger?: ToolkitLogger;
}

// ============================================================
// Tool Schema (inlined from @workspace/datatypes)
// ============================================================

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export type ToolType = "normal" | "terminal" | "interrupt";

// ============================================================
// Variable Types
// ============================================================

export interface VariableDefinition {
  type: "string" | "number" | "boolean" | "array" | "object";
  default?: unknown;
  description?: string;
}

export interface VariableDefinitions {
  static?: Record<string, unknown>;
  dynamic?: Record<string, VariableDefinition>;
}

// ============================================================
// Section Types
// ============================================================

export interface ConditionalSection {
  $if: string;
  content?: string;
}

export interface TaggedSection {
  tag: string;
  content?: string;
  $include?: string;
}

export interface ListSection {
  items: Array<{ name: string; content?: string }>;
}

export type SectionContent =
  | string
  | ConditionalSection
  | TaggedSection
  | ListSection
  | { content: string };

// ============================================================
// Template Types
// ============================================================

export interface PromptTemplate {
  meta?: {
    name: string;
    version?: string;
    description?: string;
  };
  variables?: VariableDefinitions;
  includes?: Array<{ $ref: string; with?: Record<string, unknown> }>;
  sections: Record<string, SectionContent>;
  output?: {
    separator?: string;
    wrapper?: string;
  };
}

export interface CompiledPrompt {
  name: string;
  staticContent: string;
  dynamicVariables: string[];
  render: (variables?: Record<string, unknown>) => string;
}

// ============================================================
// Tool Types
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  input_schema: ToolInputSchema;
  toolType?: ToolType;
}

export interface ToolDefinitionsFile {
  meta: {
    name: string;
    version?: string;
    description?: string;
  };
  variables?: {
    static?: Record<string, unknown>;
  };
  tools: ToolDefinition[];
}

// ============================================================
// Capability Types
// ============================================================

export interface CapabilityEntry {
  /** Dot-separated capability ID, e.g. "sandbox.file" */
  id: string;
  /** Absolute path to capability directory */
  dirPath: string;
  /** Tool names defined in this capability's tools/prompts/{lang}.yaml */
  toolNames: string[];
  /** Prompt rule sections keyed by file stem (e.g. "rules", "coding-rules") */
  promptRules: Map<string, SectionContent>;
}

// ============================================================
// Tool Handler Types (merged from @workspace/tools)
// ============================================================

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => Promise<AgentToolResult>;

export interface ToolHandlerOptions {
  /** Parallel tools can run concurrently; sequential (default) run one at a time */
  category?: "parallel" | "sequential";
  /** Optional timeout override in milliseconds */
  timeoutMs?: number;
}

export interface NamedToolHandler {
  name: string;
  handler: ToolHandler;
  options?: ToolHandlerOptions;
}

/**
 * Minimal re-declarations of agent types so brain stays self-contained
 * when only used for type signatures. The actual runtime values come
 * from @workspace/agent at the call site.
 */
export interface ToolExecutionContext {
  signal: AbortSignal;
  emitProgress?: (update: string) => void;
}

export interface AgentToolResult {
  content: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Type Guards
// ============================================================

export function isConditionalSection(section: SectionContent): section is ConditionalSection {
  return typeof section === "object" && section !== null && "$if" in section;
}

export function isTaggedSection(section: SectionContent): section is TaggedSection {
  return typeof section === "object" && section !== null && "tag" in section;
}

export function isListSection(section: SectionContent): section is ListSection {
  return (
    typeof section === "object" &&
    section !== null &&
    "items" in section &&
    Array.isArray(section.items)
  );
}
