/**
 * Tool Service
 * Unified service that loads YAML tool definitions, registers tool handlers,
 * and builds ready-to-use AgentTool objects (definition + handler).
 *
 * Merges the responsibilities of:
 * - ToolLoader (YAML loading)
 * - ToolRegistry (handler registration)
 * - binder (definition + handler → AgentTool)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import type { CapabilityRegistry } from "./capability-registry";
import type {
  AgentToolResult,
  ToolkitLogger,
  ToolDefinition,
  ToolDefinitionsFile,
  ToolExecutionContext,
  ToolHandler,
  ToolHandlerOptions,
  ToolInputSchema,
  ToolType,
} from "./types";
import { mergeVariables, replaceVariables, replaceVariablesInObject } from "./variable-resolver";

// ============================================================
// Types
// ============================================================

interface ToolServiceConfig {
  capabilitiesPath: string;
  skillsPath: string;
  configPath: string;
  language: string;
  logger?: ToolkitLogger;
}

/** Shape returned by buildTool / buildTools — matches @workspace/agent AgentTool */
export interface BuiltTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category?: "parallel" | "sequential";
  timeoutMs?: number;
  toolType?: ToolType;
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<AgentToolResult>;
}

// ============================================================
// Tool Service
// ============================================================

export class ToolService {
  // --- YAML definition cache ---
  private definitionCache = new Map<string, ToolDefinition>();
  private globalVars: Record<string, unknown> = {};
  private initialized = false;

  // --- Handler registry ---
  private handlers = new Map<
    string,
    {
      handler: ToolHandler;
      options?: ToolHandlerOptions;
      description?: string;
      parameters?: ToolInputSchema;
      toolType?: ToolType;
    }
  >();

  // --- Config ---
  private capabilitiesPath: string;
  private skillsPath: string;
  private configPath: string;
  private language: string;
  private logger?: ToolkitLogger;

  constructor(config: ToolServiceConfig) {
    this.capabilitiesPath = config.capabilitiesPath;
    this.skillsPath = config.skillsPath;
    this.configPath = config.configPath;
    this.language = config.language;
    this.logger = config.logger;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  initialize(): void {
    if (this.initialized) return;
    this.loadGlobalVars();
    this.loadAllTools();
    this.initialized = true;
    this.logger?.info(`ToolService: loaded ${this.definitionCache.size} tool definitions`);
  }

  clear(): void {
    this.definitionCache.clear();
    this.globalVars = {};
    this.initialized = false;
  }

  reload(newConfig?: { language?: string; configPath?: string }): void {
    if (newConfig?.language) this.language = newConfig.language;
    if (newConfig?.configPath) this.configPath = newConfig.configPath;
    this.clear();
    this.initialize();
  }

  // ============================================================
  // Definition access (YAML)
  // ============================================================

  getDefinition(name: string): ToolDefinition | undefined {
    if (!this.initialized) this.initialize();
    return this.definitionCache.get(name);
  }

  getAllDefinitions(): ToolDefinition[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.definitionCache.values());
  }

  // ============================================================
  // Handler registration
  // ============================================================

  registerHandler(
    name: string,
    handler: ToolHandler,
    options?: ToolHandlerOptions,
    meta?: { description?: string; parameters?: ToolInputSchema; toolType?: ToolType },
  ): void {
    this.handlers.set(name, { handler, options, ...meta });
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
  }

  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  // ============================================================
  // Build tools (definition + handler → BuiltTool / AgentTool)
  // ============================================================

  /**
   * Build a single tool by looking up its YAML definition and merging with the handler.
   * If no YAML definition exists, creates a minimal tool with just name + handler.
   */
  buildTool(name: string, handler: ToolHandler, options?: ToolHandlerOptions): BuiltTool {
    if (!this.initialized) this.initialize();

    // Also register handler for later use
    this.handlers.set(name, { handler, options });

    const def = this.definitionCache.get(name);
    return {
      name,
      description: def?.description ?? name,
      parameters: def?.input_schema ?? { type: "object", properties: {} },
      category: options?.category ?? "sequential",
      timeoutMs: options?.timeoutMs,
      execute: handler,
    };
  }

  /**
   * Build all tools for given capabilities. Only tools that have
   * both a YAML definition and a registered handler are included.
   */
  buildTools(capabilityRegistry: CapabilityRegistry, capabilities: string[]): BuiltTool[] {
    if (!this.initialized) this.initialize();

    const toolNames = capabilityRegistry.resolveToolNames(capabilities);
    const tools: BuiltTool[] = [];

    for (const name of toolNames) {
      const def = this.definitionCache.get(name);
      if (!def) continue;

      const entry = this.handlers.get(name);
      if (!entry) continue;

      tools.push({
        name: def.name,
        description: def.description,
        parameters: def.input_schema,
        category: entry.options?.category ?? "sequential",
        timeoutMs: entry.options?.timeoutMs,
        execute: entry.handler,
      });
    }

    return tools;
  }

  /**
   * Build tools from all registered handlers.
   * For each handler, prefer YAML definition if available; otherwise fall back
   * to inline metadata (description, parameters) provided at registration time.
   * Only handlers that have either a YAML definition or inline metadata are included.
   */
  buildToolsFromHandlers(): BuiltTool[] {
    if (!this.initialized) this.initialize();

    const tools: BuiltTool[] = [];

    for (const [name, entry] of this.handlers) {
      const def = this.definitionCache.get(name);

      const description = def?.description ?? entry.description;
      const parameters = def?.input_schema ??
        entry.parameters ?? { type: "object" as const, properties: {} };
      const toolType = def?.toolType ?? entry.toolType;

      if (!description) {
        this.logger?.warn(
          `ToolService: skipping handler "${name}" — no description (YAML or inline)`,
        );
        continue;
      }

      tools.push({
        name,
        description,
        parameters,
        category: entry.options?.category ?? "sequential",
        timeoutMs: entry.options?.timeoutMs,
        ...(toolType ? { toolType } : {}),
        execute: entry.handler,
      });
    }

    return tools;
  }

  // ============================================================
  // Private — YAML loading (from original ToolLoader)
  // ============================================================

  private loadGlobalVars(): void {
    const path = join(this.configPath, "variables.yaml");
    if (!existsSync(path)) return;
    try {
      const parsed: { variables?: { static?: Record<string, unknown> } } = parseYaml(
        readFileSync(path, "utf-8"),
      );
      this.globalVars = parsed.variables?.static || {};

      // Dynamically load skill-specific attachment types
      this.globalVars.skill_attachment_types = this.loadSkillAttachmentTypes();
    } catch (e) {
      this.logger?.warn(`Failed to load global variables from ${path}`, { error: e });
    }
  }

  private loadSkillAttachmentTypes(): string {
    const lang = this.language;
    const attachmentTypes: string[] = [];

    if (!existsSync(this.skillsPath)) {
      return "";
    }

    try {
      const skillDirs = readdirSync(this.skillsPath).filter((name) => {
        if (name.startsWith(".") || name === "index.ts") return false;
        const fullPath = join(this.skillsPath, name);
        return statSync(fullPath).isDirectory();
      });

      for (const skillDir of skillDirs) {
        const attachmentFile = join(
          this.skillsPath,
          skillDir,
          "prompts",
          lang,
          "special-attachment.yaml",
        );

        if (existsSync(attachmentFile)) {
          try {
            const content = readFileSync(attachmentFile, "utf-8");
            const parsed: {
              attachment?: {
                name?: string;
                type?: string;
                pathSource?: string;
                example?: string;
              };
            } = parseYaml(content);

            if (parsed.attachment) {
              const { name, type, pathSource, example } = parsed.attachment;
              if (name && type && pathSource && example) {
                const typeLabel = lang === "zh" ? "类型" : "Type";
                const pathLabel = lang === "zh" ? "路径来源" : "Path source";
                const exampleLabel = lang === "zh" ? "示例" : "Example";

                attachmentTypes.push(
                  `${name}：\n- ${typeLabel}：${type}\n- ${pathLabel}：${pathSource}\n- ${exampleLabel}：${example}`,
                );
              }
            }
          } catch (e) {
            this.logger?.warn(`Failed to load special-attachment for skill: ${skillDir}`, {
              error: e,
            });
          }
        }
      }
    } catch (e) {
      this.logger?.error("Failed to load skill attachment types", { error: e });
    }

    if (attachmentTypes.length === 0) {
      return "";
    }

    const header = lang === "zh" ? "技能特定附件类型：" : "Skill-specific attachment types:";
    return `${header}\n\n${attachmentTypes.join("\n\n")}`;
  }

  private loadAllTools(): void {
    const lang = this.language;

    const scan = (base: string) => {
      if (!existsSync(base)) return;

      const scanDir = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          if (entry.startsWith("_") || entry.startsWith(".") || entry.endsWith(".ts")) continue;
          const full = join(dir, entry);
          if (!statSync(full).isDirectory()) continue;

          const yaml = join(full, "tools", "prompts", `${lang}.yaml`);
          if (existsSync(yaml)) this.loadFile(yaml);
          scanDir(full);
        }
      };
      scanDir(base);
    };

    scan(this.capabilitiesPath);
    scan(this.skillsPath);
  }

  private loadFile(path: string): void {
    try {
      const parsed: ToolDefinitionsFile = parseYaml(readFileSync(path, "utf-8"));
      const vars = mergeVariables(this.globalVars, parsed.variables?.static);

      for (const tool of parsed.tools) {
        this.definitionCache.set(tool.name, {
          ...tool,
          description: replaceVariables(tool.description, vars, true),
          input_schema: replaceVariablesInObject(tool.input_schema, vars, true),
          ...(tool.toolType ? { toolType: tool.toolType } : {}),
        });
      }
    } catch (e) {
      this.logger?.error(`Failed: ${path}`, { error: e });
    }
  }
}
