/**
 * @workspace/toolkit — YAML-based Prompt & Tool Definition Engine
 *
 * Loads prompt templates, tool definitions from YAML files,
 * and provides tool handler registration + building.
 */

// Main facade
export { Toolkit } from "./toolkit";

// Individual services (advanced usage)
export { PromptService, PromptCompiler } from "./prompt-service";
export { ToolService } from "./tool-service";
export type { BuiltTool } from "./tool-service";
export { CapabilityRegistry } from "./capability-registry";

// Desktop tool handlers
export { createDesktopHandlers, createFileToolHandlers, createShellToolHandlers } from "./handlers";

// Utilities
export { replaceVariables, replaceVariablesInObject, mergeVariables } from "./variable-resolver";
export { sanitizePath, isPathWithinWorkspace } from "./utils/path-sanitizer";

// Types
export type {
  ToolkitInit,
  ToolkitLogger,
  ToolInputSchema,
  ToolType,
  ToolDefinition,
  ToolDefinitionsFile,
  ToolHandler,
  ToolHandlerOptions,
  NamedToolHandler,
  ToolExecutionContext,
  AgentToolResult,
  VariableDefinition,
  VariableDefinitions,
  SectionContent,
  ConditionalSection,
  TaggedSection,
  ListSection,
  PromptTemplate,
  CompiledPrompt,
  CapabilityEntry,
} from "./types";

// Type guards
export { isConditionalSection, isTaggedSection, isListSection } from "./types";
