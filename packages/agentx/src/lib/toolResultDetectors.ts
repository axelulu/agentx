/**
 * Detects the content type of a tool result for rich rendering.
 */

const IMAGE_EXTS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$/i;
const PATH_PATTERN = /^[\w.\-/~][\w.\-/]*\.\w+$/;
const TREE_CHARS = /[│├└──]/;

// Standard unified diff headers
const DIFF_HEADER = /^(diff --git |diff --cc |--- a\/|--- |\+\+\+ b\/|\+\+\+ )/m;
// Hunk header
const HUNK_HEADER = /^@@\s/m;
// Lines that are part of a diff
const DIFF_LINE = /^[+\-@]/;

export type ToolResultContentType = "diff" | "filetree" | "json" | "image-paths" | "code" | "plain";

function looksLikeDiff(content: string): boolean {
  const lines = content.split("\n");

  // Standard unified diff: has diff header or hunk header
  if (DIFF_HEADER.test(content) || HUNK_HEADER.test(content)) {
    const diffLines = lines.filter((l) => DIFF_LINE.test(l)).length;
    if (diffLines > 2) return true;
  }

  // Fallback: content with many +/- prefixed lines and at least one @@ hunk
  // (handles diffs without the `diff --git` header, e.g. from patch output)
  const hasHunk = lines.some((l) => l.startsWith("@@"));
  const addRemoveCount = lines.filter(
    (l) =>
      (l.startsWith("+") && !l.startsWith("+++")) || (l.startsWith("-") && !l.startsWith("---")),
  ).length;
  if (hasHunk && addRemoveCount > 1) return true;

  return false;
}

export function detectContentType(content: string, toolName?: string): ToolResultContentType {
  const trimmed = content.trim();
  if (!trimmed) return "plain";

  // Hint: file_rewrite results are typically diffs
  if (toolName === "file_rewrite" && looksLikeDiff(trimmed)) {
    return "diff";
  }

  // 1. Diff detection — unified diff format
  if (looksLikeDiff(trimmed)) {
    return "diff";
  }

  // 2. JSON detection
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // not valid JSON, continue
    }
  }

  // 3. Image path detection
  const lines = trimmed.split("\n").filter((l) => l.trim());
  const imageLines = lines.filter((l) => IMAGE_EXTS.test(l.trim()));
  if (imageLines.length > 0 && imageLines.length >= lines.length * 0.3) {
    return "image-paths";
  }

  // 4. File tree detection — tree-drawing characters or high path density
  const hasTreeChars = lines.some((l) => TREE_CHARS.test(l));
  const pathLines = lines.filter((l) => PATH_PATTERN.test(l.trim()));
  if (hasTreeChars && pathLines.length > 2) return "filetree";
  if (lines.length >= 3 && pathLines.length / lines.length > 0.6) return "filetree";

  // 5. Code detection — high bracket/semicolon density
  const codeChars = (trimmed.match(/[{}();=<>[\]]/g) || []).length;
  if (codeChars / trimmed.length > 0.04 && lines.length > 3) return "code";

  return "plain";
}
