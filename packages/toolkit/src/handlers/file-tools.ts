import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { NamedToolHandler } from "../types";
import { sanitizePath } from "../utils/path-sanitizer";

/**
 * Create desktop file tool handlers.
 * All paths are sandboxed to the workspace root.
 */
export function createFileToolHandlers(workspaceRoot: string): NamedToolHandler[] {
  return [fileRead(workspaceRoot), fileCreate(workspaceRoot), fileRewrite(workspaceRoot)];
}

function fileRead(workspaceRoot: string): NamedToolHandler {
  return {
    name: "file_read",
    options: { category: "parallel" },
    async handler(args) {
      const filePath = sanitizePath(args.file_path as string, workspaceRoot);

      try {
        const content = await readFile(filePath, "utf-8");
        const stats = await stat(filePath);
        return {
          content: JSON.stringify({
            filePath,
            content,
            size: stats.size,
            exists: true,
          }),
        };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === "ENOENT") {
          return {
            content: JSON.stringify({ filePath, exists: false }),
            isError: true,
          };
        }
        return { content: `Error reading file: ${error.message}`, isError: true };
      }
    },
  };
}

function fileCreate(workspaceRoot: string): NamedToolHandler {
  return {
    name: "file_create",
    options: { category: "sequential" },
    async handler(args) {
      const filePath = sanitizePath(args.file_path as string, workspaceRoot);
      const content = args.content as string;

      try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content, "utf-8");
        const stats = await stat(filePath);
        return {
          content: JSON.stringify({
            filePath,
            size: stats.size,
            exists: true,
          }),
        };
      } catch (err) {
        const error = err as Error;
        return { content: `Error creating file: ${error.message}`, isError: true };
      }
    },
  };
}

function fileRewrite(workspaceRoot: string): NamedToolHandler {
  return {
    name: "file_rewrite",
    options: { category: "sequential" },
    async handler(args) {
      const filePath = sanitizePath(args.file_path as string, workspaceRoot);
      const content = args.content as string;

      try {
        // Verify file exists before rewriting
        await stat(filePath);
        await writeFile(filePath, content, "utf-8");
        const stats = await stat(filePath);
        return {
          content: JSON.stringify({
            filePath,
            size: stats.size,
            exists: true,
          }),
        };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === "ENOENT") {
          return {
            content: `File does not exist: ${filePath}`,
            isError: true,
          };
        }
        return { content: `Error rewriting file: ${error.message}`, isError: true };
      }
    },
  };
}
