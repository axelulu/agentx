import { spawn } from "node:child_process";
import type { NamedToolHandler } from "../types";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_LENGTH = 50_000;
const PROGRESS_INTERVAL_MS = 150;

/** Blocked commands that could be destructive */
const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+\/(?!\w)/, // rm -rf / (root)
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  /:(){ :|:& };:/, // fork bomb
];

/**
 * Create desktop shell tool handlers.
 * Runs commands in the workspace root with safety restrictions.
 */
export function createShellToolHandlers(workspaceRoot: string): NamedToolHandler[] {
  return [shellRun(workspaceRoot)];
}

function shellRun(workspaceRoot: string): NamedToolHandler {
  return {
    name: "shell_run",
    description:
      "Execute a shell command in the workspace directory and return its output. Use for running scripts, installing packages, git operations, etc.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout_ms: {
          type: "number",
          description: "Optional timeout in milliseconds (default: 30000)",
        },
      },
      required: ["command"],
    },
    options: { category: "sequential", timeoutMs: DEFAULT_TIMEOUT_MS },
    handler(args, ctx) {
      const command = args.command as string;
      const timeoutMs = (args.timeout_ms as number) ?? DEFAULT_TIMEOUT_MS;

      // Safety check
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
          return Promise.resolve({
            content: `Command blocked for safety: matches restricted pattern`,
            isError: true,
          });
        }
      }

      return new Promise((resolve) => {
        const child = spawn(command, {
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          cwd: workspaceRoot,
          env: { ...process.env, FORCE_COLOR: "0" },
        });

        let output = "";
        let pendingDelta = "";
        let timedOut = false;

        // Flush pending delta via emitProgress
        const flushProgress = () => {
          if (pendingDelta && ctx.emitProgress) {
            ctx.emitProgress(pendingDelta);
            pendingDelta = "";
          }
        };

        // Periodic flush timer
        const flushTimer = setInterval(flushProgress, PROGRESS_INTERVAL_MS);

        // Manual timeout (spawn doesn't support timeout option)
        const timeoutTimer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, timeoutMs);

        child.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          output += text;
          pendingDelta += text;
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          output += text;
          pendingDelta += text;
        });

        child.on("close", (code) => {
          clearTimeout(timeoutTimer);
          clearInterval(flushTimer);
          flushProgress(); // flush any remaining delta

          // Truncate large output
          if (output.length > MAX_OUTPUT_LENGTH) {
            const head = output.substring(0, MAX_OUTPUT_LENGTH / 2);
            const tail = output.substring(output.length - MAX_OUTPUT_LENGTH / 2);
            output = `${head}\n...[${output.length - MAX_OUTPUT_LENGTH} chars truncated]...\n${tail}`;
          }

          const exitCode = code ?? 0;
          if (timedOut || exitCode !== 0) {
            resolve({
              content: JSON.stringify({
                exitCode: exitCode || 1,
                output,
                error: timedOut ? `Command timed out after ${timeoutMs}ms` : undefined,
              }),
              isError: true,
            });
            return;
          }

          resolve({
            content: JSON.stringify({
              exitCode: 0,
              output,
            }),
          });
        });

        child.on("error", (err) => {
          clearTimeout(timeoutTimer);
          clearInterval(flushTimer);
          resolve({
            content: JSON.stringify({
              exitCode: 1,
              output,
              error: err.message,
            }),
            isError: true,
          });
        });

        // Handle abort signal
        ctx.signal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        });
      });
    },
  };
}
