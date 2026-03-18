import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

type LineType = "add" | "remove" | "context" | "header" | "hunk";

interface ParsedLine {
  type: LineType;
  text: string;
  oldNum: number | null;
  newNum: number | null;
}

interface DiffFile {
  filePath: string | null;
  lines: ParsedLine[];
}

/** Parse @@ -a,b +c,d @@ hunk header into starting line numbers */
function parseHunkHeader(line: string): { oldStart: number; newStart: number } | null {
  const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!m) return null;
  return { oldStart: parseInt(m[1], 10), newStart: parseInt(m[2], 10) };
}

/** Extract file path from diff headers */
function extractFilePath(lines: string[]): string | null {
  for (const line of lines) {
    // diff --git a/path b/path
    const gitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (gitMatch) return gitMatch[2];
    // +++ b/path
    const plusMatch = line.match(/^\+\+\+ b\/(.+)/);
    if (plusMatch) return plusMatch[1];
    // +++ path (no b/ prefix)
    const plusMatch2 = line.match(/^\+\+\+ (.+)/);
    if (plusMatch2 && plusMatch2[1] !== "/dev/null") return plusMatch2[1];
  }
  return null;
}

function classifyLine(line: string): LineType {
  if (
    line.startsWith("diff --git") ||
    line.startsWith("diff --cc") ||
    line.startsWith("---") ||
    line.startsWith("+++") ||
    line.startsWith("index ") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file") ||
    line.startsWith("rename ")
  ) {
    return "header";
  }
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "remove";
  return "context";
}

function parseDiff(content: string): DiffFile[] {
  const rawLines = content.split("\n");
  // Remove trailing empty line
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  const files: DiffFile[] = [];
  let currentLines: ParsedLine[] = [];
  let currentRawLines: string[] = [];
  let oldLine = 0;
  let newLine = 0;

  const flushFile = () => {
    if (currentLines.length > 0) {
      files.push({
        filePath: extractFilePath(currentRawLines),
        lines: currentLines,
      });
    }
    currentLines = [];
    currentRawLines = [];
  };

  for (const line of rawLines) {
    const type = classifyLine(line);

    // New file boundary
    if (line.startsWith("diff --git") || line.startsWith("diff --cc")) {
      flushFile();
    }

    currentRawLines.push(line);

    if (type === "hunk") {
      const parsed = parseHunkHeader(line);
      if (parsed) {
        oldLine = parsed.oldStart;
        newLine = parsed.newStart;
      }
      currentLines.push({ type, text: line, oldNum: null, newNum: null });
    } else if (type === "header") {
      currentLines.push({ type, text: line, oldNum: null, newNum: null });
    } else if (type === "add") {
      currentLines.push({ type, text: line, oldNum: null, newNum: newLine });
      newLine++;
    } else if (type === "remove") {
      currentLines.push({ type, text: line, oldNum: oldLine, newNum: null });
      oldLine++;
    } else {
      // context line
      currentLines.push({ type, text: line, oldNum: oldLine, newNum: newLine });
      oldLine++;
      newLine++;
    }
  }

  flushFile();
  return files;
}

const LINE_STYLES: Record<LineType, string> = {
  add: "bg-foreground/[0.05] text-foreground/90",
  remove: "bg-foreground/[0.03] text-foreground/40 line-through",
  context: "text-muted-foreground/80",
  header: "text-muted-foreground/60",
  hunk: "text-muted-foreground/60 bg-foreground/[0.03]",
};

const LINE_NUM_STYLES: Record<LineType, string> = {
  add: "text-foreground/30",
  remove: "text-foreground/20",
  context: "text-muted-foreground/30",
  header: "text-muted-foreground/20",
  hunk: "text-muted-foreground/25",
};

export const DiffView = memo(function DiffView({ content }: { content: string }) {
  const files = useMemo(() => parseDiff(content), [content]);

  return (
    <div className="font-mono text-[11px] leading-relaxed overflow-x-auto">
      {files.map((file, fi) => (
        <div key={fi}>
          {/* File header */}
          {file.filePath && (
            <div className="sticky top-0 px-2 py-1 bg-foreground/[0.04] text-foreground/80 text-[11px] font-medium border-b border-border truncate">
              {file.filePath}
            </div>
          )}
          {/* Lines */}
          {file.lines.map((line, i) => (
            <div key={i} className={cn("flex whitespace-pre", LINE_STYLES[line.type])}>
              {/* Line numbers */}
              <span
                className={cn(
                  "select-none shrink-0 w-8 text-right pr-1 border-r border-border",
                  LINE_NUM_STYLES[line.type],
                )}
              >
                {line.oldNum ?? ""}
              </span>
              <span
                className={cn(
                  "select-none shrink-0 w-8 text-right pr-1 border-r border-border",
                  LINE_NUM_STYLES[line.type],
                )}
              >
                {line.newNum ?? ""}
              </span>
              {/* Content */}
              <span className="px-2 flex-1">{line.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});
