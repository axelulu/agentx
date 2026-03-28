import { spawn } from "node:child_process";
import type { NamedToolHandler, ToolExecutionContext } from "../types";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_LENGTH = 50_000;
const PROGRESS_INTERVAL_MS = 150;

/**
 * Create AppleScript/JXA automation tool handlers.
 * Allows the agent to execute AppleScript or JavaScript for Automation (JXA)
 * scripts to control macOS applications.
 */
export function createAppleScriptToolHandlers(): NamedToolHandler[] {
  return [appleScriptRun()];
}

function appleScriptRun(): NamedToolHandler {
  return {
    name: "applescript_run",
    description:
      "Execute an AppleScript or JXA (JavaScript for Automation) script on macOS. " +
      "Use this to automate macOS applications like Finder, Safari, Keynote, Mail, Calendar, " +
      "Notes, Reminders, System Settings, and any scriptable app. " +
      "Returns the script output or error.",
    parameters: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description:
            "The script source code to execute. For AppleScript, write standard AppleScript syntax. " +
            "For JXA, write JavaScript that uses the Application() API.",
        },
        language: {
          type: "string",
          description: 'The scripting language: "applescript" (default) or "javascript" (for JXA).',
          enum: ["applescript", "javascript"],
        },
        timeout_ms: {
          type: "number",
          description:
            "Timeout in milliseconds. The script will be terminated if it exceeds this duration. Defaults to 30000 (30 seconds).",
        },
      },
      required: ["script"],
    },
    options: { category: "sequential", timeoutMs: DEFAULT_TIMEOUT_MS },
    handler(args, ctx: ToolExecutionContext) {
      const script = args.script as string;
      const language = (args.language as string) ?? "applescript";
      const timeoutMs = (args.timeout_ms as number) ?? DEFAULT_TIMEOUT_MS;

      // Build osascript arguments
      const osascriptArgs: string[] = [];
      if (language === "javascript") {
        osascriptArgs.push("-l", "JavaScript");
      }
      osascriptArgs.push("-e", script);

      return new Promise((resolve) => {
        const child = spawn("osascript", osascriptArgs, {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });

        let stdout = "";
        let stderr = "";
        let pendingDelta = "";
        let timedOut = false;

        const flushProgress = () => {
          if (pendingDelta && ctx.emitProgress) {
            ctx.emitProgress(pendingDelta);
            pendingDelta = "";
          }
        };

        const flushTimer = setInterval(flushProgress, PROGRESS_INTERVAL_MS);

        const timeoutTimer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, timeoutMs);

        child.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stdout += text;
          pendingDelta += text;
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stderr += text;
          pendingDelta += text;
        });

        child.on("close", (code) => {
          clearTimeout(timeoutTimer);
          clearInterval(flushTimer);
          flushProgress();

          let output = stdout;
          if (stderr) {
            output = output ? `${output}\n[stderr]\n${stderr}` : stderr;
          }

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
                error: timedOut ? `Script timed out after ${timeoutMs}ms` : undefined,
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
              output: "",
              error: err.message,
            }),
            isError: true,
          });
        });

        ctx.signal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        });
      });
    },
  };
}
