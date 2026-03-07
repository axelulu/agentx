/**
 * Toolkit Facade
 * Unified API for loading YAML-based prompts and tool definitions.
 *
 * Toolkit directory structure:
 *
 * {basePath}/
 * ├── prompts/{lang}/                      <- Main prompt templates
 * │   ├── system.yaml, router.yaml, loop.yaml, ...
 * │   ├── identity/*.yaml
 * │   ├── execution/*.yaml
 * │   └── router/*.yaml
 * ├── capabilities/
 * │   ├── {category}/{module}/
 * │   │   ├── tools/prompts/{lang}.yaml    <- Tool definitions
 * │   │   └── prompts/{lang}/*.yaml        <- Rules/guidelines
 * ├── skills/{skill}/
 * │   ├── tools/prompts/{lang}.yaml
 * │   └── prompts/{lang}/*.yaml
 * └── config/{lang}/variables.yaml         <- Global variables
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { CapabilityRegistry } from "./capability-registry";
import { PromptService } from "./prompt-service";
import { ToolService } from "./tool-service";
import type { BuiltTool } from "./tool-service";
import type {
  ToolkitInit,
  ToolkitLogger,
  SectionContent,
  ToolDefinition,
  ToolHandler,
  ToolHandlerOptions,
} from "./types";

export class Toolkit {
  private promptService: PromptService;
  private toolService: ToolService;
  private capabilityRegistry: CapabilityRegistry;
  private initialized = false;
  private logger?: ToolkitLogger;

  private basePath: string;
  private language: string;

  constructor(config: ToolkitInit) {
    this.basePath = config.basePath;
    this.language = config.language;
    this.logger = config.logger;

    const paths = this.resolvePaths(config.basePath, config.language);

    this.promptService = new PromptService({
      basePath: paths.templatesPath,
      language: config.language,
      skillsPath: paths.skillsPath,
      logger: config.logger,
    });

    this.toolService = new ToolService({
      capabilitiesPath: paths.capabilitiesPath,
      skillsPath: paths.skillsPath,
      configPath: paths.configPath,
      language: config.language,
      logger: config.logger,
    });

    this.capabilityRegistry = new CapabilityRegistry({
      capabilitiesPath: paths.capabilitiesPath,
      skillsPath: paths.skillsPath,
      language: config.language,
      logger: config.logger,
    });
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();
    this.logger?.info(`Toolkit initializing (${this.language})...`);

    // Initialize capability registry (scans capabilities and skills directories)
    this.capabilityRegistry.initialize();

    // Initialize prompt service (parses prompt YAML files)
    await this.promptService.initialize();

    // Initialize tool service (parses tool YAML files)
    this.toolService.initialize();

    this.initialized = true;
    this.logger?.info(`Toolkit initialized in ${Date.now() - startTime}ms`);
  }

  // ============================================================
  // Prompt Composition
  // ============================================================

  /**
   * Get a compiled prompt by name, rendering with optional variables.
   */
  getPrompt(name: string, vars?: Record<string, unknown>): string {
    this.ensureInitialized();
    return this.promptService.getPrompt(name, vars);
  }

  /**
   * Compose a full prompt by merging base prompt variables with capability rules.
   */
  composePrompt(capabilities: string[], vars?: Record<string, unknown>): string {
    this.ensureInitialized();

    const parts: string[] = [];
    const mergedVars = { ...vars };

    // 1. Load base system prompt if it exists
    try {
      const systemPrompt = this.promptService.getPrompt("system", mergedVars);
      if (systemPrompt?.trim()) parts.push(systemPrompt);
    } catch {
      // No system prompt template — skip
    }

    // 2. Append capability rules
    const rules = this.capabilityRegistry.resolvePromptRules(capabilities);
    for (const section of Object.values(rules)) {
      const rendered = this.promptService.renderSectionContent(section, mergedVars);
      if (rendered?.trim()) parts.push(rendered);
    }

    return parts.join("\n\n");
  }

  /**
   * Render a single section with variables.
   */
  renderSection(section: SectionContent, vars: Record<string, unknown>): string {
    return this.promptService.renderSectionContent(section, vars);
  }

  /**
   * Get static variables from a prompt template.
   */
  getStaticVariables(name: string): Record<string, unknown> {
    this.ensureInitialized();
    return this.promptService.getStaticVariables(name);
  }

  // ============================================================
  // Tool Composition
  // ============================================================

  /**
   * Get all loaded tool definitions.
   */
  getToolDefinitions(): ToolDefinition[] {
    this.ensureInitialized();
    return this.toolService.getAllDefinitions();
  }

  /**
   * Get a single tool definition by name.
   */
  getToolDefinition(name: string): ToolDefinition | undefined {
    this.ensureInitialized();
    return this.toolService.getDefinition(name);
  }

  /**
   * Resolve capability IDs to the tool definitions they contain.
   */
  resolveTools(capabilities: string[]): ToolDefinition[] {
    this.ensureInitialized();
    const toolNames = this.capabilityRegistry.resolveToolNames(capabilities);
    const result: ToolDefinition[] = [];
    for (const name of toolNames) {
      const def = this.toolService.getDefinition(name);
      if (def) result.push(def);
    }
    return result;
  }

  /**
   * Resolve capability IDs to just tool names.
   */
  resolveToolNames(capabilities: string[]): string[] {
    this.ensureInitialized();
    return this.capabilityRegistry.resolveToolNames(capabilities);
  }

  // ============================================================
  // Tool Handler Registration & Building
  // ============================================================

  /**
   * Register a tool handler by name.
   */
  registerToolHandler(name: string, handler: ToolHandler, options?: ToolHandlerOptions): void {
    this.toolService.registerHandler(name, handler, options);
  }

  /**
   * Build a single AgentTool by merging YAML definition + handler.
   */
  buildTool(name: string, handler: ToolHandler, options?: ToolHandlerOptions): BuiltTool {
    this.ensureInitialized();
    return this.toolService.buildTool(name, handler, options);
  }

  /**
   * Build AgentTool[] for given capabilities.
   * Only tools with both a YAML definition and a registered handler are included.
   */
  buildTools(capabilities: string[]): BuiltTool[] {
    this.ensureInitialized();
    return this.toolService.buildTools(this.capabilityRegistry, capabilities);
  }

  // ============================================================
  // Capability Queries
  // ============================================================

  /**
   * Get all discovered capability IDs.
   */
  getAllCapabilityIds(): string[] {
    this.ensureInitialized();
    return this.capabilityRegistry.getAllIds();
  }

  /**
   * Resolve prompt rules for given capabilities.
   */
  resolvePromptRules(capabilities: string[]): Record<string, SectionContent> {
    this.ensureInitialized();
    return this.capabilityRegistry.resolvePromptRules(capabilities);
  }

  // ============================================================
  // Language Management
  // ============================================================

  /**
   * Switch language and reload all services.
   */
  async setLanguage(lang: string): Promise<void> {
    if (this.language === lang) return;

    this.logger?.info(`Switching language from ${this.language} to ${lang}`);
    this.language = lang;

    const paths = this.resolvePaths(this.basePath, lang);

    this.capabilityRegistry.reload({ language: lang });
    await this.promptService.reload({ basePath: paths.templatesPath, language: lang });
    this.toolService.reload({ language: lang, configPath: paths.configPath });

    this.logger?.info(`Language switched to ${lang}`);
  }

  /**
   * Reload all services (same language).
   */
  async reload(): Promise<void> {
    this.logger?.info("Reloading toolkit...");
    this.capabilityRegistry.reload();
    await this.promptService.reload();
    this.toolService.reload();
    this.logger?.info("Toolkit reloaded");
  }

  /**
   * Get current language.
   */
  getLanguage(): string {
    return this.language;
  }

  /**
   * Check if a language directory exists.
   */
  hasLanguage(lang: string): boolean {
    const langPath = join(this.basePath, "prompts", lang);
    return existsSync(langPath);
  }

  // ============================================================
  // Internal access (for advanced usage)
  // ============================================================

  getPromptService(): PromptService {
    return this.promptService;
  }

  getToolService(): ToolService {
    return this.toolService;
  }

  getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry;
  }

  // ============================================================
  // Private
  // ============================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Toolkit not initialized. Call initialize() first.");
    }
  }

  private resolvePaths(basePath: string, language: string) {
    return {
      templatesPath: join(basePath, "prompts", language),
      capabilitiesPath: join(basePath, "capabilities"),
      skillsPath: join(basePath, "skills"),
      configPath: join(basePath, "config", language),
    };
  }
}
