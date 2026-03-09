import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { NamedToolHandler } from "../types";
import { sanitizePath } from "../utils/path-sanitizer";

// ── Search-and-replace helpers ──────────────────────────────────

interface Edit {
  old_text: string;
  new_text: string;
}

/**
 * Apply a list of search-and-replace edits to `source` sequentially.
 * Each `old_text` must appear exactly once in the (current) source.
 * Returns the final text or throws on ambiguity / miss.
 */
function applyEdits(source: string, edits: Edit[]): string {
  let result = source;
  for (let i = 0; i < edits.length; i++) {
    const { old_text, new_text } = edits[i]!;
    if (old_text === new_text) continue; // no-op

    const idx = result.indexOf(old_text);
    if (idx === -1) {
      throw new Error(
        `Edit #${i + 1}: old_text not found in file.\n` +
          `  Searched for: ${old_text.length > 120 ? old_text.slice(0, 120) + "…" : old_text}`,
      );
    }
    // Check uniqueness: search for a second occurrence
    if (result.indexOf(old_text, idx + 1) !== -1) {
      throw new Error(
        `Edit #${i + 1}: old_text appears multiple times. Provide more surrounding context to make it unique.\n` +
          `  Searched for: ${old_text.length > 120 ? old_text.slice(0, 120) + "…" : old_text}`,
      );
    }
    result = result.slice(0, idx) + new_text + result.slice(idx + old_text.length);
  }
  return result;
}

/**
 * Generate a minimal unified-diff between `a` and `b`.
 * Context lines = 3 (standard).
 */
function unifiedDiff(filePath: string, a: string, b: string): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");

  // Simple LCS-based diff producing change hunks
  const hunks = buildHunks(aLines, bLines, 3);
  if (hunks.length === 0) return ""; // no changes

  const name = basename(filePath);
  const header = `--- a/${name}\n+++ b/${name}`;
  const body = hunks.map(formatHunk).join("\n");
  return `${header}\n${body}`;
}

interface Hunk {
  aStart: number; // 1-based
  aCount: number;
  bStart: number; // 1-based
  bCount: number;
  lines: string[];
}

function buildHunks(aLines: string[], bLines: string[], ctx: number): Hunk[] {
  // Find changed ranges using a simple O(ND) diff of line hashes
  const changes = diffLines(aLines, bLines);
  if (changes.length === 0) return [];

  const hunks: Hunk[] = [];
  let i = 0;

  while (i < changes.length) {
    // Expand context around this change group
    let start = changes[i]!;
    let end = changes[i]!;

    // Merge nearby changes into the same hunk
    while (i + 1 < changes.length) {
      const gap =
        changes[i + 1]!.aIdx - (changes[i]!.aIdx + (changes[i]!.type === "delete" ? 1 : 0));
      if (gap <= ctx * 2) {
        i++;
        end = changes[i]!;
      } else {
        break;
      }
    }
    i++;

    // Determine the lines range with context
    const aFrom = Math.max(0, start.aIdx - ctx);
    const aTo = Math.min(aLines.length, (end.type === "delete" ? end.aIdx + 1 : end.aIdx) + ctx);
    const bFrom = Math.max(0, start.bIdx - ctx);
    const bTo = Math.min(bLines.length, (end.type === "insert" ? end.bIdx + 1 : end.bIdx) + ctx);

    const lines: string[] = [];
    let ai = aFrom;
    let bi = bFrom;

    // Replay changes within this range
    for (const c of changes.filter(
      (c) =>
        c.aIdx >= start.aIdx && c.aIdx <= end.aIdx && c.bIdx >= start.bIdx && c.bIdx <= end.bIdx,
    )) {
      // Context lines before this change
      while (ai < c.aIdx && bi < c.bIdx) {
        lines.push(` ${aLines[ai]}`);
        ai++;
        bi++;
      }
      if (c.type === "delete") {
        lines.push(`-${aLines[ai]}`);
        ai++;
      } else if (c.type === "insert") {
        lines.push(`+${bLines[bi]}`);
        bi++;
      } else {
        // replace
        lines.push(`-${aLines[ai]}`);
        lines.push(`+${bLines[bi]}`);
        ai++;
        bi++;
      }
    }
    // Trailing context
    while (ai < aTo && bi < bTo) {
      lines.push(` ${aLines[ai]}`);
      ai++;
      bi++;
    }

    hunks.push({
      aStart: aFrom + 1,
      aCount: aTo - aFrom,
      bStart: bFrom + 1,
      bCount: bTo - bFrom,
      lines,
    });
  }
  return hunks;
}

function formatHunk(h: Hunk): string {
  return `@@ -${h.aStart},${h.aCount} +${h.bStart},${h.bCount} @@\n${h.lines.join("\n")}`;
}

interface Change {
  type: "delete" | "insert" | "replace";
  aIdx: number;
  bIdx: number;
}

/**
 * Very small Myers-like diff that returns a list of Change objects.
 * Good enough for source files up to a few thousand lines.
 */
function diffLines(aLines: string[], bLines: string[]): Change[] {
  const n = aLines.length;
  const m = bLines.length;

  // Build LCS via DP (O(nm) space, fine for files < ~5k lines)
  // For larger files we fall back to a line-hash approach
  if (n * m > 25_000_000) {
    // Fallback: hash-based comparison for very large files
    return diffLinesHashed(aLines, bLines);
  }

  // Standard LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const changes: Change[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && aLines[i] === bLines[j]) {
      i++;
      j++;
    } else if (i < n && j < m && (i + 1 >= n || dp[i + 1]![j]! <= dp[i]![j + 1]!)) {
      // replace
      if (i < n && j < m) {
        changes.push({ type: "replace", aIdx: i, bIdx: j });
        i++;
        j++;
      }
    } else if (j < m && (i >= n || dp[i]![j + 1]! > dp[i + 1]![j]!)) {
      changes.push({ type: "insert", aIdx: i, bIdx: j });
      j++;
    } else {
      changes.push({ type: "delete", aIdx: i, bIdx: j });
      i++;
    }
  }
  return changes;
}

/** Hash-based fallback for very large files. */
function diffLinesHashed(aLines: string[], bLines: string[]): Change[] {
  const bSet = new Map<string, number[]>();
  for (let j = 0; j < bLines.length; j++) {
    const arr = bSet.get(bLines[j]!);
    if (arr) arr.push(j);
    else bSet.set(bLines[j]!, [j]);
  }

  const changes: Change[] = [];
  let bi = 0;
  for (let ai = 0; ai < aLines.length; ai++) {
    if (bi < bLines.length && aLines[ai] === bLines[bi]) {
      bi++;
      continue;
    }
    const positions = bSet.get(aLines[ai]!);
    if (positions) {
      const next = positions.find((p) => p >= bi);
      if (next !== undefined) {
        // Insert lines from b that appear before this match
        while (bi < next) {
          changes.push({ type: "insert", aIdx: ai, bIdx: bi });
          bi++;
        }
        bi++; // skip matched line
        continue;
      }
    }
    changes.push({ type: "delete", aIdx: ai, bIdx: bi });
  }
  while (bi < bLines.length) {
    changes.push({ type: "insert", aIdx: aLines.length, bIdx: bi });
    bi++;
  }
  return changes;
}

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
    description:
      "Read the contents of a file at the given path. Returns file content and metadata.",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Relative or absolute path to the file to read" },
      },
      required: ["file_path"],
    },
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
    description:
      "Create a new file with the given content. Parent directories are created automatically.",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path for the new file" },
        content: { type: "string", description: "Content to write to the file" },
      },
      required: ["file_path", "content"],
    },
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
    description:
      "Edit an existing file. Supports two modes:\n" +
      "1. Full rewrite: provide `content` to replace the entire file.\n" +
      "2. Surgical edits: provide `edits` (array of {old_text, new_text}) to apply " +
      "search-and-replace changes without rewriting the whole file. Each old_text must " +
      "match exactly once. Prefer `edits` for small changes to avoid wasting tokens.",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to the existing file to edit" },
        content: {
          type: "string",
          description: "Full content to replace the file with. Use this OR edits, not both.",
        },
        edits: {
          type: "array",
          description:
            "List of search-and-replace edits. Each old_text must appear exactly once in the file. " +
            "Edits are applied sequentially. Prefer this over content for small, targeted changes.",
          items: {
            type: "object",
            properties: {
              old_text: {
                type: "string",
                description: "Exact text to find (must be unique in the file)",
              },
              new_text: {
                type: "string",
                description: "Replacement text",
              },
            },
            required: ["old_text", "new_text"],
          },
        },
      },
      required: ["file_path"],
    },
    options: { category: "sequential" },
    async handler(args) {
      const filePath = sanitizePath(args.file_path as string, workspaceRoot);
      const content = args.content as string | undefined;
      const edits = args.edits as Edit[] | undefined;

      // Validate: exactly one of content or edits must be provided
      if (content != null && edits != null) {
        return {
          content:
            "Provide either `content` (full rewrite) or `edits` (search-and-replace), not both.",
          isError: true,
        };
      }
      if (content == null && edits == null) {
        return {
          content: "Provide either `content` (full rewrite) or `edits` (search-and-replace).",
          isError: true,
        };
      }

      try {
        // Verify file exists & read current content
        const original = await readFile(filePath, "utf-8");

        if (content != null) {
          // ── Full rewrite mode (original behaviour) ──
          await writeFile(filePath, content, "utf-8");
          const stats = await stat(filePath);
          return {
            content: JSON.stringify({ filePath, size: stats.size, exists: true }),
          };
        }

        // ── Edits mode ──
        if (!edits || edits.length === 0) {
          return { content: "edits array is empty — nothing to do.", isError: true };
        }
        const updated = applyEdits(original, edits);
        if (updated === original) {
          return {
            content: JSON.stringify({
              filePath,
              size: Buffer.byteLength(original, "utf-8"),
              exists: true,
              editsApplied: 0,
              note: "No changes — file unchanged.",
            }),
          };
        }
        await writeFile(filePath, updated, "utf-8");
        const stats = await stat(filePath);
        const diff = unifiedDiff(filePath, original, updated);
        return {
          content:
            diff ||
            JSON.stringify({
              filePath,
              size: stats.size,
              exists: true,
              editsApplied: edits.length,
            }),
        };
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === "ENOENT") {
          return { content: `File does not exist: ${filePath}`, isError: true };
        }
        return { content: `Error rewriting file: ${error.message}`, isError: true };
      }
    },
  };
}
