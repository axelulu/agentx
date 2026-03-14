import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationSummary, LearnedFact, MemoryConfig } from "./types.js";
import { DEFAULT_MEMORY_CONFIG } from "./types.js";

/**
 * JSON file-based persistence for cross-session memory.
 *
 * Storage layout:
 *   {dataDir}/memory/
 *     config.json       - MemoryConfig
 *     summaries.json    - ConversationSummary[]
 *     facts.json        - LearnedFact[]
 */
export class MemoryStore {
  private dir: string;

  constructor(dataDir: string) {
    this.dir = join(dataDir, "memory");
  }

  async initialize(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  // --- Config ---

  async getConfig(): Promise<MemoryConfig> {
    return this.readJson<MemoryConfig>("config.json", { ...DEFAULT_MEMORY_CONFIG });
  }

  async saveConfig(config: MemoryConfig): Promise<void> {
    await this.writeJson("config.json", config);
  }

  // --- Summaries ---

  async getSummaries(): Promise<ConversationSummary[]> {
    return this.readJson<ConversationSummary[]>("summaries.json", []);
  }

  async saveSummaries(summaries: ConversationSummary[]): Promise<void> {
    await this.writeJson("summaries.json", summaries);
  }

  // --- Facts ---

  async getFacts(): Promise<LearnedFact[]> {
    return this.readJson<LearnedFact[]>("facts.json", []);
  }

  async saveFacts(facts: LearnedFact[]): Promise<void> {
    await this.writeJson("facts.json", facts);
  }

  // --- Helpers ---

  private async readJson<T>(filename: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(join(this.dir, filename), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(filename: string, data: unknown): Promise<void> {
    await writeFile(join(this.dir, filename), JSON.stringify(data, null, 2), "utf-8");
  }
}
