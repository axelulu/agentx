/**
 * Capability Registry
 * Auto-discovers capabilities from directory structure and provides composition APIs.
 * Capabilities are identified by dot-separated path segments:
 *   capabilities/sandbox/file → "sandbox.file"
 *   skills/presentation      → "skill.presentation"
 *
 * Decoupled from infrastructure — no singletons, no external config.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";

import type { ToolkitLogger, CapabilityEntry, SectionContent, ToolDefinitionsFile } from "./types";

// ============================================================
// Types
// ============================================================

interface CapabilityRegistryConfig {
  capabilitiesPath: string;
  skillsPath: string;
  language: string;
  logger?: ToolkitLogger;
}

// ============================================================
// Registry Implementation
// ============================================================

export class CapabilityRegistry {
  private capabilities = new Map<string, CapabilityEntry>();
  private initialized = false;

  private capabilitiesPath: string;
  private skillsPath: string;
  private language: string;
  private logger?: ToolkitLogger;

  constructor(config: CapabilityRegistryConfig) {
    this.capabilitiesPath = config.capabilitiesPath;
    this.skillsPath = config.skillsPath;
    this.language = config.language;
    this.logger = config.logger;
  }

  /**
   * Scan directories and build capability indexes.
   * Safe to call multiple times (no-ops after first call).
   */
  initialize(): void {
    if (this.initialized) return;

    const startTime = Date.now();

    this.scanCapabilities(this.capabilitiesPath, "");
    this.scanCapabilities(this.skillsPath, "skill");

    this.initialized = true;
    this.logger?.info(
      `CapabilityRegistry: ${this.capabilities.size} capabilities (${Date.now() - startTime}ms)`,
    );
  }

  /**
   * Clear cache and re-scan all capabilities.
   * Use after language change or when capability files are modified.
   */
  reload(newConfig?: { language?: string }): void {
    if (newConfig?.language) this.language = newConfig.language;
    this.clearCache();
    this.initialize();
  }

  /**
   * Clear all cached data and reset state.
   */
  clearCache(): void {
    this.capabilities.clear();
    this.initialized = false;
  }

  // ============================================================
  // Query APIs
  // ============================================================

  getAllIds(): string[] {
    return Array.from(this.capabilities.keys());
  }

  /**
   * Resolve a list of capability IDs to a flat array of tool names.
   */
  resolveToolNames(capabilityIds: string[]): string[] {
    const names: string[] = [];
    for (const id of capabilityIds) {
      const entry = this.capabilities.get(id);
      if (entry) {
        names.push(...entry.toolNames);
      }
    }
    return names;
  }

  /**
   * Resolve a list of capability IDs to a merged record of prompt rule sections.
   * Keys are prefixed with capability ID to avoid collisions.
   */
  resolvePromptRules(capabilityIds: string[]): Record<string, SectionContent> {
    const result: Record<string, SectionContent> = {};
    for (const id of capabilityIds) {
      const entry = this.capabilities.get(id);
      if (!entry) continue;
      for (const [stem, section] of entry.promptRules) {
        const key = `${id.replace(/\./g, "_")}_${stem}`;
        result[key] = section;
      }
    }
    return result;
  }

  // ============================================================
  // Discovery (private)
  // ============================================================

  /**
   * Recursively scan a base directory for capability leaves.
   * A directory is a capability leaf if it has a `tools/` or `prompts/` subdir
   * (excluding `tools/prompts` which is a tools definition path).
   */
  private scanCapabilities(basePath: string, prefix: string): void {
    if (!existsSync(basePath)) return;

    const scanDir = (dir: string, segments: string[]) => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      // Check if this directory is a capability leaf
      const hasTools = entries.includes("tools");
      const hasPrompts =
        entries.includes("prompts") &&
        existsSync(join(dir, "prompts")) &&
        this.isDirectory(join(dir, "prompts"));

      if (hasTools || hasPrompts) {
        // This is a capability leaf — register it
        const id = segments.join(".");
        if (!id) return; // skip bare root

        const entry = this.buildEntry(id, dir);
        this.capabilities.set(id, entry);
      }

      // Continue scanning subdirectories for nested capabilities
      for (const name of entries) {
        if (
          name.startsWith(".") ||
          name.startsWith("_") ||
          name === "node_modules" ||
          name === "tools" ||
          name === "prompts" ||
          name === "executor" ||
          name === "providers" ||
          name.endsWith(".ts")
        ) {
          continue;
        }

        const childPath = join(dir, name);
        if (this.isDirectory(childPath)) {
          scanDir(childPath, [...segments, name]);
        }
      }
    };

    // Start scanning: if prefix is non-empty (e.g. "skill"), it becomes the first segment
    try {
      const topDirs = readdirSync(basePath).filter((name) => {
        if (name.startsWith(".") || name === "index.ts") return false;
        return this.isDirectory(join(basePath, name));
      });

      for (const topDir of topDirs) {
        const segments = prefix ? [prefix, topDir] : [topDir];
        scanDir(join(basePath, topDir), segments);
      }
    } catch {
      /* base path unreadable */
    }
  }

  /**
   * Build a CapabilityEntry from a directory path.
   */
  private buildEntry(id: string, dirPath: string): CapabilityEntry {
    const toolNames = this.extractToolNames(dirPath);
    const promptRules = this.extractPromptRules(dirPath);

    return { id, dirPath, toolNames, promptRules };
  }

  /**
   * Extract tool names from tools/prompts/{lang}.yaml
   */
  private extractToolNames(dirPath: string): string[] {
    const yamlPath = join(dirPath, "tools", "prompts", `${this.language}.yaml`);

    if (!existsSync(yamlPath)) return [];

    try {
      const content = readFileSync(yamlPath, "utf-8");
      const parsed: ToolDefinitionsFile = parseYaml(content);
      if (!parsed.tools || !Array.isArray(parsed.tools)) return [];
      return parsed.tools.map((t) => t.name).filter(Boolean);
    } catch (e) {
      this.logger?.warn(`Failed to extract tool names from ${yamlPath}`, {
        error: e,
      });
      return [];
    }
  }

  /**
   * Extract prompt rule sections from prompts/{lang}/*.yaml
   * Returns a Map of fileStem → first SectionContent from each file.
   */
  private extractPromptRules(dirPath: string): Map<string, SectionContent> {
    const promptDir = join(dirPath, "prompts", this.language);
    const rules = new Map<string, SectionContent>();

    if (!existsSync(promptDir)) return rules;

    let files: string[];
    try {
      files = readdirSync(promptDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    } catch {
      return rules;
    }

    for (const file of files) {
      const filePath = join(promptDir, file);
      const stem = basename(file, file.endsWith(".yml") ? ".yml" : ".yaml");

      try {
        const content = readFileSync(filePath, "utf-8");
        const parsed: {
          sections?: Record<string, SectionContent>;
        } = parseYaml(content);

        if (!parsed.sections) continue;

        // Take the first section from the file
        const firstSection = Object.values(parsed.sections)[0];
        if (firstSection) {
          rules.set(stem, firstSection);
        }
      } catch (e) {
        this.logger?.warn(`Failed to parse prompt rules: ${filePath}`, {
          error: e,
        });
      }
    }

    return rules;
  }

  private isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }
}
