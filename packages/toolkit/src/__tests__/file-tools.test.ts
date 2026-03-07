import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileToolHandlers } from "../handlers/file-tools";
import type { NamedToolHandler, ToolExecutionContext } from "../types";

describe("file-tools", () => {
  let workspaceRoot: string;
  let tools: NamedToolHandler[];
  const ctx: ToolExecutionContext = { signal: AbortSignal.timeout(5000) };

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "toolkit-test-"));
    tools = createFileToolHandlers(workspaceRoot);
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  function getTool(name: string) {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool;
  }

  describe("file_read", () => {
    it("reads an existing file", async () => {
      await writeFile(join(workspaceRoot, "test.txt"), "hello world");
      const result = await getTool("file_read").handler({ file_path: "test.txt" }, ctx);

      const parsed = JSON.parse(result.content);
      expect(parsed.exists).toBe(true);
      expect(parsed.content).toBe("hello world");
      expect(parsed.size).toBeGreaterThan(0);
    });

    it("returns error for missing file", async () => {
      const result = await getTool("file_read").handler({ file_path: "nonexistent.txt" }, ctx);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content);
      expect(parsed.exists).toBe(false);
    });

    it("rejects paths outside workspace", async () => {
      await expect(
        getTool("file_read").handler({ file_path: "../../etc/passwd" }, ctx),
      ).rejects.toThrow("resolves outside workspace root");
    });
  });

  describe("file_create", () => {
    it("creates a new file", async () => {
      const result = await getTool("file_create").handler(
        { file_path: "new.txt", content: "new content" },
        ctx,
      );

      const parsed = JSON.parse(result.content);
      expect(parsed.exists).toBe(true);

      const written = await readFile(join(workspaceRoot, "new.txt"), "utf-8");
      expect(written).toBe("new content");
    });

    it("creates nested directories", async () => {
      const result = await getTool("file_create").handler(
        { file_path: "a/b/c/deep.txt", content: "deep" },
        ctx,
      );

      expect(result.isError).toBeUndefined();
      const written = await readFile(join(workspaceRoot, "a/b/c/deep.txt"), "utf-8");
      expect(written).toBe("deep");
    });
  });

  describe("file_rewrite", () => {
    it("rewrites an existing file", async () => {
      await writeFile(join(workspaceRoot, "existing.txt"), "old content");

      const result = await getTool("file_rewrite").handler(
        { file_path: "existing.txt", content: "updated content" },
        ctx,
      );

      expect(result.isError).toBeUndefined();
      const written = await readFile(join(workspaceRoot, "existing.txt"), "utf-8");
      expect(written).toBe("updated content");
    });

    it("returns error when file does not exist", async () => {
      const result = await getTool("file_rewrite").handler(
        { file_path: "missing.txt", content: "content" },
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.content).toContain("does not exist");
    });
  });
});
