import { exec } from "node:child_process";
import type { NamedToolHandler } from "../types";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_LENGTH = 50_000;

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
        const child = exec(
          command,
          {
            cwd: workspaceRoot,
            timeout: timeoutMs,
            maxBuffer: 5 * 1024 * 1024, // 5MB
            env: { ...process.env, FORCE_COLOR: "0" },
          },
          (error, stdout, stderr) => {
            let output = stdout || "";
            if (stderr) {
              output += (output ? "\n" : "") + stderr;
            }

            // Truncate large output
            if (output.length > MAX_OUTPUT_LENGTH) {
              const head = output.substring(0, MAX_OUTPUT_LENGTH / 2);
              const tail = output.substring(output.length - MAX_OUTPUT_LENGTH / 2);
              output = `${head}\n...[${output.length - MAX_OUTPUT_LENGTH} chars truncated]...\n${tail}`;
            }

            if (error) {
              resolve({
                content: JSON.stringify({
                  exitCode: error.code ?? 1,
                  output,
                  error: error.message,
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
          },
        );

        // Handle abort signal
        ctx.signal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        });
      });
    },
  };
}
