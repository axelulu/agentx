/**
 * Code search tools — grep, glob, list_directory.
 *
 * Pure Node.js implementation with no external dependencies.
 * All paths are sandboxed to the workspace root.
 */

import { readFile, readdir, stat, lstat } from "node:fs/promises";
import { resolve, relative, join, basename, extname } from "node:path";
import type { NamedToolHandler, AgentToolResult } from "../types";
import { sanitizePath } from "../utils/path-sanitizer";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Directories always skipped during recursive traversal */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "coverage",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "vendor",
  "target", // Rust
]);

/** Binary/large file extensions to skip when reading content */
const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".svg",
  ".webp",
  ".avif",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".webm",
  ".avi",
  ".mov",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".o",
  ".a",
  ".pyc",
  ".class",
  ".jar",
  ".sqlite",
  ".db",
  ".lock",
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB — skip files larger than this for content search

// ---------------------------------------------------------------------------
// Glob matching (minimatch-lite)
// ---------------------------------------------------------------------------

/**
 * Convert a glob pattern to a RegExp. Supports:
 * - `*`  → matches anything except `/`
 * - `**` → matches any depth of directories
 * - `?`  → matches single non-`/` char
 * - `{a,b}` → alternation
 * - Character classes `[abc]`
 */
function globToRegex(pattern: string): RegExp {
  let result = "";
  let i = 0;
  const n = pattern.length;

  while (i < n) {
    const ch = pattern[i]!;

    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // **
        if (pattern[i + 2] === "/") {
          result += "(?:.+/)?";
          i += 3;
        } else {
          result += ".*";
          i += 2;
        }
      } else {
        result += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      result += "[^/]";
      i++;
    } else if (ch === "[") {
      // Pass through character class
      const close = pattern.indexOf("]", i + 1);
      if (close === -1) {
        result += "\\[";
        i++;
      } else {
        result += pattern.slice(i, close + 1);
        i = close + 1;
      }
    } else if (ch === "{") {
      // Alternation: {a,b,c} → (?:a|b|c)
      const close = pattern.indexOf("}", i + 1);
      if (close === -1) {
        result += "\\{";
        i++;
      } else {
        const inner = pattern.slice(i + 1, close);
        const alts = inner
          .split(",")
          .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|");
        result += `(?:${alts})`;
        i = close + 1;
      }
    } else if (".+^${}()|[]\\".includes(ch)) {
      result += "\\" + ch;
      i++;
    } else {
      result += ch;
      i++;
    }
  }

  return new RegExp("^" + result + "$");
}

// ---------------------------------------------------------------------------
// Recursive file walker
// ---------------------------------------------------------------------------

interface WalkOptions {
  /** Only yield files matching this glob (relative to base) */
  include?: RegExp;
  /** Exclude files matching this glob */
  exclude?: RegExp;
  /** Max files to collect */
  maxFiles?: number;
  /** Also skip these directory names */
  extraSkipDirs?: Set<string>;
}

async function* walkFiles(
  base: string,
  dir: string,
  opts: WalkOptions,
  count: { n: number },
): AsyncGenerator<string> {
  if (opts.maxFiles && count.n >= opts.maxFiles) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // permission denied, etc.
  }

  // Sort for deterministic output
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (opts.maxFiles && count.n >= opts.maxFiles) return;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (opts.extraSkipDirs?.has(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".github") continue;
      yield* walkFiles(base, fullPath, opts, count);
    } else if (entry.isFile()) {
      const rel = relative(base, fullPath);
      if (opts.include && !opts.include.test(rel)) continue;
      if (opts.exclude && opts.exclude.test(rel)) continue;
      yield fullPath;
      count.n++;
    }
  }
}

// ---------------------------------------------------------------------------
// grep tool
// ---------------------------------------------------------------------------

function grepTool(workspaceRoot: string): NamedToolHandler {
  return {
    name: "grep",
    description:
      "Search file contents by regular expression. Returns matching lines with file paths and line numbers. " +
      "Much more reliable than shell_run + grep — handles binary file skipping, output limits, and structured results automatically.\n\n" +
      "Tips:\n" +
      '- Use `include` to narrow search to specific file types (e.g., "**/*.ts")\n' +
      "- Use `context_lines` to see surrounding code\n" +
      "- Searches are case-sensitive by default; set `ignore_case: true` for case-insensitive",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regular expression pattern to search for (JavaScript regex syntax)",
        },
        path: {
          type: "string",
          description:
            "Directory or file to search in (relative to workspace root, default: workspace root)",
        },
        include: {
          type: "string",
          description:
            'Glob pattern to filter files (e.g., "**/*.ts", "src/**/*.{js,jsx}"). Only matching files are searched.',
        },
        exclude: {
          type: "string",
          description: 'Glob pattern to exclude files (e.g., "**/*.test.ts", "**/*.d.ts")',
        },
        ignore_case: {
          type: "boolean",
          description: "Case-insensitive search (default: false)",
        },
        context_lines: {
          type: "number",
          description: "Number of lines to show before and after each match (default: 0, max: 5)",
        },
        max_results: {
          type: "number",
          description: "Maximum number of matching lines to return (default: 100, max: 500)",
        },
      },
      required: ["pattern"],
    },
    options: { category: "parallel", timeoutMs: 30_000 },
    async handler(args, ctx): Promise<AgentToolResult> {
      const patternStr = args.pattern as string;
      const searchPath = args.path as string | undefined;
      const includeGlob = args.include as string | undefined;
      const excludeGlob = args.exclude as string | undefined;
      const ignoreCase = (args.ignore_case as boolean) ?? false;
      const contextLines = Math.min(Math.max(0, (args.context_lines as number) ?? 0), 5);
      const maxResults = Math.min(Math.max(1, (args.max_results as number) ?? 100), 500);

      // Compile regex
      let regex: RegExp;
      try {
        regex = new RegExp(patternStr, ignoreCase ? "gi" : "g");
      } catch (err) {
        return {
          content: `Invalid regex pattern: ${(err as Error).message}`,
          isError: true,
        };
      }

      // Resolve search root
      const resolvedBase = searchPath ? sanitizePath(searchPath, workspaceRoot) : workspaceRoot;

      // Check if searching a single file
      let singleFile = false;
      try {
        const s = await stat(resolvedBase);
        singleFile = s.isFile();
      } catch {
        return { content: `Path not found: ${resolvedBase}`, isError: true };
      }

      const includeRe = includeGlob ? globToRegex(includeGlob) : undefined;
      const excludeRe = excludeGlob ? globToRegex(excludeGlob) : undefined;

      interface Match {
        file: string;
        line: number;
        text: string;
        contextBefore?: string[];
        contextAfter?: string[];
      }

      const matches: Match[] = [];
      let filesSearched = 0;
      let filesMatched = 0;
      let truncated = false;

      const processFile = async (filePath: string) => {
        if (ctx.signal.aborted) return;
        if (matches.length >= maxResults) {
          truncated = true;
          return;
        }

        // Skip binary/large files
        const ext = extname(filePath).toLowerCase();
        if (BINARY_EXTS.has(ext)) return;

        let fileContent: string;
        try {
          const s = await stat(filePath);
          if (s.size > MAX_FILE_SIZE) return;
          fileContent = await readFile(filePath, "utf-8");
        } catch {
          return;
        }

        filesSearched++;
        const lines = fileContent.split("\n");
        const relPath = relative(workspaceRoot, filePath);
        let fileHasMatch = false;

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) {
            truncated = true;
            break;
          }

          // Reset regex lastIndex for global regex
          regex.lastIndex = 0;
          if (regex.test(lines[i]!)) {
            if (!fileHasMatch) {
              fileHasMatch = true;
              filesMatched++;
            }

            const match: Match = {
              file: relPath,
              line: i + 1,
              text: lines[i]!,
            };

            if (contextLines > 0) {
              const start = Math.max(0, i - contextLines);
              const end = Math.min(lines.length - 1, i + contextLines);
              if (start < i) match.contextBefore = lines.slice(start, i);
              if (end > i) match.contextAfter = lines.slice(i + 1, end + 1);
            }

            matches.push(match);
          }
        }
      };

      if (singleFile) {
        await processFile(resolvedBase);
      } else {
        const count = { n: 0 };
        for await (const filePath of walkFiles(
          resolvedBase,
          resolvedBase,
          {
            include: includeRe,
            exclude: excludeRe,
            maxFiles: 10_000,
          },
          count,
        )) {
          if (ctx.signal.aborted) break;
          if (matches.length >= maxResults) {
            truncated = true;
            break;
          }
          await processFile(filePath);
        }
      }

      if (matches.length === 0) {
        return {
          content: `No matches found for /${patternStr}/${ignoreCase ? "i" : ""} (searched ${filesSearched} files)`,
        };
      }

      // Format output
      const parts: string[] = [];

      if (contextLines > 0) {
        // Grouped by file with context
        let currentFile = "";
        for (const m of matches) {
          if (m.file !== currentFile) {
            if (currentFile) parts.push("");
            parts.push(`## ${m.file}`);
            currentFile = m.file;
          }
          if (m.contextBefore) {
            for (let j = 0; j < m.contextBefore.length; j++) {
              parts.push(`  ${m.line - m.contextBefore.length + j}  ${m.contextBefore[j]}`);
            }
          }
          parts.push(`> ${m.line}  ${m.text}`);
          if (m.contextAfter) {
            for (let j = 0; j < m.contextAfter.length; j++) {
              parts.push(`  ${m.line + 1 + j}  ${m.contextAfter[j]}`);
            }
          }
          parts.push("---");
        }
      } else {
        // Compact format: file:line: text
        for (const m of matches) {
          parts.push(`${m.file}:${m.line}: ${m.text}`);
        }
      }

      // Summary
      const summary = `\n[${matches.length} matches in ${filesMatched} files (${filesSearched} searched)${truncated ? " — results truncated" : ""}]`;
      parts.push(summary);

      return { content: parts.join("\n") };
    },
  };
}

// ---------------------------------------------------------------------------
// glob tool
// ---------------------------------------------------------------------------

function globTool(workspaceRoot: string): NamedToolHandler {
  return {
    name: "glob",
    description:
      "Find files by glob pattern. Returns matching file paths relative to workspace root.\n\n" +
      "Examples:\n" +
      '- "**/*.ts" — all TypeScript files\n' +
      '- "src/components/**/*.tsx" — React components\n' +
      '- "**/*.{test,spec}.ts" — all test files\n' +
      '- "**/index.ts" — all index files',
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: 'Glob pattern to match files (e.g., "**/*.ts", "src/**/*.{js,jsx}")',
        },
        path: {
          type: "string",
          description:
            "Directory to search in (relative to workspace root, default: workspace root)",
        },
        max_results: {
          type: "number",
          description: "Maximum number of files to return (default: 200, max: 1000)",
        },
      },
      required: ["pattern"],
    },
    options: { category: "parallel", timeoutMs: 15_000 },
    async handler(args, ctx): Promise<AgentToolResult> {
      const pattern = args.pattern as string;
      const searchPath = args.path as string | undefined;
      const maxResults = Math.min(Math.max(1, (args.max_results as number) ?? 200), 1000);

      const resolvedBase = searchPath ? sanitizePath(searchPath, workspaceRoot) : workspaceRoot;

      // Verify it's a directory
      try {
        const s = await stat(resolvedBase);
        if (!s.isDirectory()) {
          return { content: `Not a directory: ${resolvedBase}`, isError: true };
        }
      } catch {
        return { content: `Path not found: ${resolvedBase}`, isError: true };
      }

      const includeRe = globToRegex(pattern);
      const files: string[] = [];
      const count = { n: 0 };

      for await (const filePath of walkFiles(
        resolvedBase,
        resolvedBase,
        {
          include: includeRe,
          maxFiles: maxResults + 1, // +1 to detect truncation
        },
        count,
      )) {
        if (ctx.signal.aborted) break;
        files.push(relative(workspaceRoot, filePath));
        if (files.length >= maxResults + 1) break;
      }

      if (files.length === 0) {
        return { content: `No files matching "${pattern}" found` };
      }

      const truncated = files.length > maxResults;
      if (truncated) files.length = maxResults;

      const summary = `[${files.length} files${truncated ? " — truncated, narrow your pattern" : ""}]`;
      return { content: files.join("\n") + "\n\n" + summary };
    },
  };
}

// ---------------------------------------------------------------------------
// list_directory tool
// ---------------------------------------------------------------------------

function listDirectoryTool(workspaceRoot: string): NamedToolHandler {
  return {
    name: "list_directory",
    description:
      "List the contents of a directory. Shows files and subdirectories with type indicators and sizes. " +
      "Use this to explore the project structure before diving into specific files.\n\n" +
      "Output format: each line shows [type] name (size). Types: [D] = directory, [F] = file, [L] = symlink.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory to list (relative to workspace root, default: workspace root)",
        },
        recursive: {
          type: "boolean",
          description:
            "If true, list contents recursively as a tree. Default: false. Use with caution on large directories.",
        },
        max_depth: {
          type: "number",
          description:
            "Maximum recursion depth (default: 3, max: 5). Only used with recursive: true.",
        },
      },
    },
    options: { category: "parallel", timeoutMs: 10_000 },
    async handler(args, ctx): Promise<AgentToolResult> {
      const dirPath = args.path as string | undefined;
      const recursive = (args.recursive as boolean) ?? false;
      const maxDepth = Math.min(Math.max(1, (args.max_depth as number) ?? 3), 5);

      const resolvedPath = dirPath ? sanitizePath(dirPath, workspaceRoot) : workspaceRoot;

      try {
        const s = await stat(resolvedPath);
        if (!s.isDirectory()) {
          return { content: `Not a directory: ${resolvedPath}`, isError: true };
        }
      } catch {
        return { content: `Path not found: ${resolvedPath}`, isError: true };
      }

      const lines: string[] = [];
      const relRoot = relative(workspaceRoot, resolvedPath) || ".";
      lines.push(`${relRoot}/`);

      const maxEntries = recursive ? 500 : 200;
      let entryCount = 0;
      let truncated = false;

      async function listDir(dir: string, prefix: string, depth: number): Promise<void> {
        if (ctx.signal.aborted) return;

        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          lines.push(`${prefix}  (permission denied)`);
          return;
        }

        // Sort: directories first, then files, alphabetical within each group
        entries.sort((a, b) => {
          const aDir = a.isDirectory() ? 0 : 1;
          const bDir = b.isDirectory() ? 0 : 1;
          if (aDir !== bDir) return aDir - bDir;
          return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < entries.length; i++) {
          if (ctx.signal.aborted) return;
          if (entryCount >= maxEntries) {
            truncated = true;
            return;
          }

          const entry = entries[i]!;
          const isLast = i === entries.length - 1;
          const connector = isLast ? "\u2514\u2500 " : "\u251c\u2500 ";
          const childPrefix = prefix + (isLast ? "   " : "\u2502  ");
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            const skip =
              SKIP_DIRS.has(entry.name) || (entry.name.startsWith(".") && entry.name !== ".github");
            if (skip) {
              lines.push(`${prefix}${connector}[D] ${entry.name}/  (skipped)`);
            } else {
              // Count immediate children for size hint
              let childCount = 0;
              try {
                const children = await readdir(fullPath);
                childCount = children.length;
              } catch {
                /* ignore */
              }
              lines.push(`${prefix}${connector}[D] ${entry.name}/  (${childCount} items)`);
              entryCount++;

              if (recursive && depth < maxDepth && !skip) {
                await listDir(fullPath, childPrefix, depth + 1);
              }
            }
          } else if (entry.isSymbolicLink()) {
            lines.push(`${prefix}${connector}[L] ${entry.name}`);
            entryCount++;
          } else {
            let sizeStr = "";
            try {
              const s = await lstat(fullPath);
              sizeStr = formatSize(s.size);
            } catch {
              /* ignore */
            }
            lines.push(`${prefix}${connector}[F] ${entry.name}  ${sizeStr}`);
            entryCount++;
          }
        }
      }

      await listDir(resolvedPath, "", 0);

      if (truncated) {
        lines.push(`\n... (truncated at ${maxEntries} entries)`);
      }

      return { content: lines.join("\n") };
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function createSearchToolHandlers(workspaceRoot: string): NamedToolHandler[] {
  return [grepTool(workspaceRoot), globTool(workspaceRoot), listDirectoryTool(workspaceRoot)];
}
