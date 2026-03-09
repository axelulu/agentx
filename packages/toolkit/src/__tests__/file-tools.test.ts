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
    it("rewrites an existing file (full content mode)", async () => {
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

    it("returns error when neither content nor edits provided", async () => {
      await writeFile(join(workspaceRoot, "existing.txt"), "hello");
      const result = await getTool("file_rewrite").handler({ file_path: "existing.txt" }, ctx);
      expect(result.isError).toBe(true);
      expect(result.content).toContain("content");
    });

    it("returns error when both content and edits provided", async () => {
      await writeFile(join(workspaceRoot, "existing.txt"), "hello");
      const result = await getTool("file_rewrite").handler(
        {
          file_path: "existing.txt",
          content: "full",
          edits: [{ old_text: "hello", new_text: "world" }],
        },
        ctx,
      );
      expect(result.isError).toBe(true);
      expect(result.content).toContain("not both");
    });

    describe("edits mode", () => {
      it("applies a single search-and-replace edit", async () => {
        await writeFile(join(workspaceRoot, "code.ts"), 'const x = "hello";\nconst y = 42;\n');

        const result = await getTool("file_rewrite").handler(
          {
            file_path: "code.ts",
            edits: [{ old_text: 'const x = "hello";', new_text: 'const x = "world";' }],
          },
          ctx,
        );

        expect(result.isError).toBeUndefined();
        const written = await readFile(join(workspaceRoot, "code.ts"), "utf-8");
        expect(written).toBe('const x = "world";\nconst y = 42;\n');
        // Should return a diff
        expect(result.content).toContain("@@");
      });

      it("applies multiple edits sequentially", async () => {
        await writeFile(join(workspaceRoot, "multi.txt"), "line one\nline two\nline three\n");

        const result = await getTool("file_rewrite").handler(
          {
            file_path: "multi.txt",
            edits: [
              { old_text: "line one", new_text: "LINE ONE" },
              { old_text: "line three", new_text: "LINE THREE" },
            ],
          },
          ctx,
        );

        expect(result.isError).toBeUndefined();
        const written = await readFile(join(workspaceRoot, "multi.txt"), "utf-8");
        expect(written).toBe("LINE ONE\nline two\nLINE THREE\n");
      });

      it("returns error when old_text not found", async () => {
        await writeFile(join(workspaceRoot, "miss.txt"), "hello world");

        const result = await getTool("file_rewrite").handler(
          {
            file_path: "miss.txt",
            edits: [{ old_text: "not here", new_text: "replaced" }],
          },
          ctx,
        );

        expect(result.isError).toBe(true);
        expect(result.content).toContain("not found");
        // File should be unchanged
        const content = await readFile(join(workspaceRoot, "miss.txt"), "utf-8");
        expect(content).toBe("hello world");
      });

      it("returns error when old_text matches multiple times", async () => {
        await writeFile(join(workspaceRoot, "dup.txt"), "aaa bbb aaa");

        const result = await getTool("file_rewrite").handler(
          {
            file_path: "dup.txt",
            edits: [{ old_text: "aaa", new_text: "ccc" }],
          },
          ctx,
        );

        expect(result.isError).toBe(true);
        expect(result.content).toContain("multiple times");
        // File should be unchanged
        const content = await readFile(join(workspaceRoot, "dup.txt"), "utf-8");
        expect(content).toBe("aaa bbb aaa");
      });

      it("handles no-op edits gracefully", async () => {
        await writeFile(join(workspaceRoot, "noop.txt"), "same content");

        const result = await getTool("file_rewrite").handler(
          {
            file_path: "noop.txt",
            edits: [{ old_text: "same content", new_text: "same content" }],
          },
          ctx,
        );

        expect(result.isError).toBeUndefined();
        const parsed = JSON.parse(result.content);
        expect(parsed.editsApplied).toBe(0);
      });
    });
  });
});
