/**
 * Prompt Service
 * Unified service for loading, compiling, and rendering prompt templates.
 *
 * Decoupled from infrastructure — no singletons, no chokidar, no external config.
 * All paths and language are passed via constructor.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type {
  ToolkitLogger,
  CompiledPrompt,
  PromptTemplate,
  SectionContent,
  VariableDefinitions,
} from "./types";
import { isConditionalSection, isListSection, isTaggedSection } from "./types";
import { replaceVariables } from "./variable-resolver";

/**
 * Skills auto-include directive configuration
 */
interface SkillsIncludeDirective {
  $include_skills: {
    /** Prompt type to load (e.g., 'rules', 'execution', 'completion') */
    type: string;
    /** If true, skip skills that don't have this prompt type */
    optional?: boolean;
  };
}

// ============================================================
// Prompt Loader (internal)
// ============================================================

interface PromptServiceConfig {
  basePath: string;
  language: string;
  skillsPath: string;
  logger?: ToolkitLogger;
}

/**
 * Raw template structure before processing
 */
interface RawTemplate {
  meta?: {
    name: string;
    version?: string;
    description?: string;
  };
  variables?: VariableDefinitions;
  includes?: Array<{ $ref: string; with?: Record<string, unknown> }>;
  sections?: Record<string, SectionContent>;
  output?: {
    separator?: string;
    wrapper?: string;
  };
}

class PromptLoader {
  private basePath: string;
  private cache = new Map<string, PromptTemplate>();
  private resolving = new Set<string>();
  private language: string;
  private skillsPath: string;
  private logger?: ToolkitLogger;

  constructor(config: PromptServiceConfig) {
    this.basePath = config.basePath;
    this.language = config.language;
    this.skillsPath = config.skillsPath;
    this.logger = config.logger;
  }

  /**
   * Load and fully resolve a template file
   */
  loadTemplate(filePath: string): PromptTemplate {
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(this.basePath, filePath);

    // Return cached result
    if (this.cache.has(absolutePath)) {
      return this.cache.get(absolutePath)!;
    }

    // Detect circular dependency
    if (this.resolving.has(absolutePath)) {
      throw new Error(`Circular include detected: ${absolutePath}`);
    }

    this.resolving.add(absolutePath);

    try {
      if (!existsSync(absolutePath)) {
        throw new Error(`Template not found: ${absolutePath}`);
      }

      const content = readFileSync(absolutePath, "utf-8");
      const raw: RawTemplate = parseYaml(content);
      const templateDir = dirname(absolutePath);

      // Resolve the template
      const resolved = this.resolveTemplate(raw, templateDir);

      this.cache.set(absolutePath, resolved);
      return resolved;
    } finally {
      this.resolving.delete(absolutePath);
    }
  }

  /**
   * Resolve a raw template by processing all includes recursively
   */
  private resolveTemplate(raw: RawTemplate, baseDir: string): PromptTemplate {
    // Start with empty result
    let variables: VariableDefinitions = { static: {}, dynamic: {} };
    let sections: Record<string, SectionContent> = {};

    // Step 1: Process top-level includes (in order, earlier includes are base)
    if (raw.includes) {
      for (const inc of raw.includes) {
        const incPath = this.resolvePath(inc.$ref, baseDir);
        const included = this.loadTemplate(incPath);

        // Merge variables (included first, then override with current)
        variables = this.mergeVariables(variables, included.variables, inc.with);

        // Merge sections with smart key handling
        sections = this.mergeSections(sections, included.sections, included.meta?.name);
      }
    }

    // Step 2: Merge current template's own variables (override included)
    if (raw.variables) {
      variables = this.mergeVariables(variables, raw.variables);
    }

    // Step 3: Process current template's sections
    if (raw.sections) {
      const resolvedSections = this.resolveSections(raw.sections, baseDir);
      // Current template's sections override included sections
      sections = { ...sections, ...resolvedSections };
    }

    return {
      meta: raw.meta,
      variables,
      sections,
      output: raw.output,
    };
  }

  /**
   * Resolve section-level $include and $include_skills directives
   */
  private resolveSections(
    sections: Record<string, SectionContent>,
    baseDir: string,
  ): Record<string, SectionContent> {
    const resolved: Record<string, SectionContent> = {};

    for (const [key, section] of Object.entries(sections)) {
      if (this.isSkillsIncludeDirective(section)) {
        // Handle $include_skills directive - auto-load from all skills
        const skillsSections = this.resolveSkillsInclude(section);
        // Merge all skill sections into resolved
        Object.assign(resolved, skillsSections);
      } else if (this.isIncludeDirective(section)) {
        // Handle $include directive
        const incPath = this.resolvePath(section.$include, baseDir);
        const included = this.loadTemplate(incPath);

        // Get the first section from included template
        const firstSection = Object.values(included.sections)[0];

        if ("tag" in section && firstSection) {
          // Preserve the tag wrapper
          const content = this.extractContent(firstSection);
          resolved[key] = {
            tag: section.tag,
            content,
          };
        } else {
          resolved[key] = firstSection ?? section;
        }
      } else {
        // Keep section as-is
        resolved[key] = section;
      }
    }

    return resolved;
  }

  /**
   * Check if a section is a $include_skills directive
   */
  private isSkillsIncludeDirective(
    section: SectionContent,
  ): section is SectionContent & SkillsIncludeDirective {
    return typeof section === "object" && section !== null && "$include_skills" in section;
  }

  /**
   * Resolve $include_skills directive by scanning all skills
   */
  private resolveSkillsInclude(directive: SkillsIncludeDirective): Record<string, SectionContent> {
    const { type, optional = false } = directive.$include_skills;
    const result: Record<string, SectionContent> = {};

    // Get all skill directories
    const skillNames = this.getSkillNames();

    for (const skillName of skillNames) {
      const promptPath = join(this.skillsPath, skillName, "prompts", this.language, `${type}.yaml`);

      if (!existsSync(promptPath)) {
        if (!optional) {
          this.logger?.warn(`Skill "${skillName}" missing required prompt: ${type}.yaml`);
        }
        continue;
      }

      try {
        const included = this.loadTemplate(promptPath);
        const firstSection = Object.values(included.sections)[0];

        if (firstSection) {
          // Use skill name + type as key to avoid collisions
          const sectionKey = `${skillName}_${type}`;
          result[sectionKey] = firstSection;
        }
      } catch (e) {
        this.logger?.error(`Failed to load skill prompt: ${promptPath}`, {
          error: e,
        });
      }
    }

    return result;
  }

  /**
   * Get all skill directory names
   */
  private getSkillNames(): string[] {
    if (!existsSync(this.skillsPath)) {
      return [];
    }

    try {
      return readdirSync(this.skillsPath).filter((name) => {
        // Skip hidden files and index.ts
        if (name.startsWith(".") || name === "index.ts") {
          return false;
        }
        const fullPath = join(this.skillsPath, name);
        return statSync(fullPath).isDirectory();
      });
    } catch {
      return [];
    }
  }

  /**
   * Merge sections with smart key handling to avoid collisions
   */
  private mergeSections(
    base: Record<string, SectionContent>,
    incoming: Record<string, SectionContent> | undefined,
    incomingName?: string,
  ): Record<string, SectionContent> {
    if (!incoming) return base;

    const result = { ...base };

    for (const [key, value] of Object.entries(incoming)) {
      // If key is generic "content" and we have a name, use the name as key
      const finalKey = key === "content" && incomingName ? incomingName : key;

      // Only add if not already present (base takes precedence for same keys)
      if (!(finalKey in result)) {
        result[finalKey] = value;
      }
    }

    return result;
  }

  /**
   * Merge variable definitions
   */
  private mergeVariables(
    base: VariableDefinitions | undefined,
    incoming: VariableDefinitions | undefined,
    overrides?: Record<string, unknown>,
  ): VariableDefinitions {
    const result: VariableDefinitions = {
      static: { ...(base?.static || {}), ...(incoming?.static || {}) },
      dynamic: { ...(base?.dynamic || {}), ...(incoming?.dynamic || {}) },
    };

    // Apply overrides to static variables
    if (overrides && result.static) {
      for (const [k, v] of Object.entries(overrides)) {
        result.static[k] = v;
      }
    }

    return result;
  }

  /**
   * Check if a section is an $include directive
   */
  private isIncludeDirective(
    section: SectionContent,
  ): section is SectionContent & { $include: string; tag?: string } {
    return typeof section === "object" && section !== null && "$include" in section;
  }

  /**
   * Extract content string from a section
   */
  private extractContent(section: SectionContent): string {
    if (typeof section === "string") {
      return section;
    }
    if (
      typeof section === "object" &&
      section !== null &&
      "content" in section &&
      typeof section.content === "string"
    ) {
      return section.content;
    }
    return "";
  }

  /**
   * Resolve a path relative to a base directory
   */
  private resolvePath(refPath: string, baseDir: string): string {
    return isAbsolute(refPath) ? refPath : resolve(baseDir, refPath);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getBasePath(): string {
    return this.basePath;
  }

  setBasePath(p: string): void {
    this.basePath = p;
    this.clearCache();
  }

  setLanguage(lang: string): void {
    this.language = lang;
    this.clearCache();
  }
}

// ============================================================
// Prompt Compiler (exported for advanced usage)
// ============================================================

export class PromptCompiler {
  compile(template: PromptTemplate): CompiledPrompt {
    const name = template.meta?.name || "unnamed";
    const staticVars = template.variables?.static || {};
    const dynamicVarDefs = template.variables?.dynamic || {};
    const dynamicVariables = Object.keys(dynamicVarDefs);

    const staticContent = this.renderSections(
      template.sections,
      staticVars,
      template.output?.separator ?? "\n\n",
      true,
    );

    const render = (vars: Record<string, unknown> = {}): string => {
      const merged = { ...vars };
      for (const [k, def] of Object.entries(dynamicVarDefs)) {
        if (merged[k] === undefined && def.default !== undefined) merged[k] = def.default;
      }
      return replaceVariables(staticContent, merged, false);
    };

    return { name, staticContent, dynamicVariables, render };
  }

  private renderSections(
    sections: Record<string, SectionContent>,
    vars: Record<string, unknown>,
    sep: string,
    preserve: boolean,
  ): string {
    const parts: string[] = [];
    for (const section of Object.values(sections)) {
      const content = this.renderSection(section, vars, preserve);
      if (content?.trim()) parts.push(content);
    }
    return parts.join(sep);
  }

  renderSection(section: SectionContent, vars: Record<string, unknown>, preserve = false): string {
    if (typeof section === "string") return replaceVariables(section, vars, preserve);

    if (isConditionalSection(section)) {
      if (!this.evalCondition(section.$if, vars)) return "";
      return section.content ? replaceVariables(section.content, vars, preserve) : "";
    }

    if (isTaggedSection(section)) {
      if (!section.content) return "";
      return `<${section.tag}>\n${replaceVariables(section.content, vars, preserve)}\n</${section.tag}>`;
    }

    if (isListSection(section)) {
      return section.items
        .filter((i) => i.content)
        .map((i) => replaceVariables(i.content!, vars, preserve))
        .join("\n\n");
    }

    if (
      typeof section === "object" &&
      "content" in section &&
      typeof section.content === "string"
    ) {
      return replaceVariables(section.content, vars, preserve);
    }

    return "";
  }

  private evalCondition(cond: string, vars: Record<string, unknown>): boolean {
    const resolved = replaceVariables(cond, vars, false);
    const ops = ["!==", "===", "!=", "==", ">=", "<=", ">", "<"];

    for (const op of ops) {
      const idx = resolved.indexOf(op);
      if (idx !== -1) {
        const l = this.parseVal(resolved.slice(0, idx).trim());
        const r = this.parseVal(resolved.slice(idx + op.length).trim());
        switch (op) {
          case "===":
          case "==":
            return l === r;
          case "!==":
          case "!=":
            return l !== r;
          case ">":
            return Number(l) > Number(r);
          case "<":
            return Number(l) < Number(r);
          case ">=":
            return Number(l) >= Number(r);
          case "<=":
            return Number(l) <= Number(r);
        }
      }
    }
    return Boolean(this.parseVal(resolved.trim()));
  }

  private parseVal(s: string): unknown {
    const t = s.trim();
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')))
      return t.slice(1, -1);
    if (t === "true") return true;
    if (t === "false") return false;
    if (t === "null" || t === "undefined" || t === "") return null;
    const n = Number(t);
    return !isNaN(n) && t !== "" ? n : t;
  }
}

// ============================================================
// Prompt Service (public)
// ============================================================

export class PromptService {
  private loader: PromptLoader;
  private compiler = new PromptCompiler();
  private prompts = new Map<string, CompiledPrompt>();
  private initialized = false;
  private language: string;
  private skillsPath: string;
  private logger?: ToolkitLogger;

  constructor(config: PromptServiceConfig) {
    this.language = config.language;
    this.skillsPath = config.skillsPath;
    this.logger = config.logger;
    this.loader = new PromptLoader(config);
  }

  // ============================================================
  // Initialization
  // ============================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger?.info(`PromptService initializing (${this.language})`);

    const basePath = this.loader.getBasePath();
    if (!existsSync(basePath)) {
      throw new Error(`Templates not found: ${basePath}`);
    }

    for (const file of this.scanYaml(basePath)) {
      try {
        const compiled = this.compiler.compile(this.loader.loadTemplate(file));
        this.prompts.set(compiled.name, compiled);
      } catch (e) {
        this.logger?.error(`Failed: ${file}`, { error: e });
      }
    }
    this.initialized = true;
    this.logger?.info(`Loaded ${this.prompts.size} prompts`);
  }

  // ============================================================
  // Prompt Access
  // ============================================================

  getPrompt(name: string, ctx?: Record<string, unknown>): string {
    if (!this.initialized) throw new Error("Not initialized");
    const p = this.prompts.get(name);
    if (!p) throw new Error(`Prompt "${name}" not found`);
    return p.render({
      language: this.language,
      timestamp: new Date().toISOString(),
      ...ctx,
    });
  }

  // ============================================================
  // Atomic Helpers (used by Brain facade for prompt composition)
  // ============================================================

  /**
   * Get the static variables defined in a prompt template.
   */
  getStaticVariables(name: string): Record<string, unknown> {
    if (!this.initialized) throw new Error("Not initialized");
    const template = this.loader.loadTemplate(join(this.loader.getBasePath(), `${name}.yaml`));
    return template.variables?.static ?? {};
  }

  /**
   * Render a single SectionContent to a string.
   * Tagged sections produce <tag>\n...\n</tag>, plain content is returned as-is.
   */
  renderSectionContent(section: SectionContent, vars: Record<string, unknown>): string {
    return this.compiler.renderSection(section, vars, false);
  }

  // ============================================================
  // Language & Utilities
  // ============================================================

  async reload(newConfig?: { basePath?: string; language?: string }): Promise<void> {
    if (newConfig?.language) {
      this.language = newConfig.language;
      this.loader.setLanguage(newConfig.language);
    }
    if (newConfig?.basePath) {
      this.loader.setBasePath(newConfig.basePath);
    }
    this.loader.clearCache();
    this.prompts.clear();
    this.initialized = false;
    await this.initialize();
  }

  getLanguage(): string {
    return this.language;
  }

  // ============================================================
  // Private
  // ============================================================

  private scanYaml(dir: string, base?: string): string[] {
    const files: string[] = [];
    const b = base || dir;
    try {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) files.push(...this.scanYaml(p, b));
        else if (e.endsWith(".yaml") || e.endsWith(".yml")) files.push(p.slice(b.length + 1));
      }
    } catch {
      /* ignore */
    }
    return files;
  }
}
