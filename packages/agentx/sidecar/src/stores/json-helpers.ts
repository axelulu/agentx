import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // Main file corrupted — try to recover from tmp file
    const tmpPath = filePath + ".tmp";
    try {
      if (existsSync(tmpPath)) {
        const data = JSON.parse(readFileSync(tmpPath, "utf-8")) as T;
        // Recovery succeeded — promote tmp to main file
        try {
          renameSync(tmpPath, filePath);
        } catch {}
        return data;
      }
    } catch {
      // Both files corrupted
    }
  }
  return fallback;
}

/** Atomic write: write to a temp file first, then rename to avoid corruption on crash. */
export function writeJsonFile(filePath: string, data: unknown): void {
  const tmpPath = filePath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}
