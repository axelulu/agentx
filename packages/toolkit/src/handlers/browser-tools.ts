import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { NamedToolHandler } from "../types";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_LENGTH = 50_000;
const PROGRESS_INTERVAL_MS = 150;

/** Path pattern to detect screenshot file paths in output */
const SCREENSHOT_PATH_RE = /(?:^|\s)(\/[^\s]+\.png)\b/;

let chromeChecked = false;

/**
 * Resolve the agent-browser binary path.
 * Prefers AGENTX_BROWSER_BIN env var, falls back to "agent-browser" in PATH.
 */
function getBrowserBin(): string {
  return process.env.AGENTX_BROWSER_BIN || "agent-browser";
}

/**
 * Lazily check/install Chrome on first use.
 */
async function ensureChromeInstalled(bin: string): Promise<void> {
  if (chromeChecked) return;

  try {
    const exitCode = await new Promise<number | null>((resolve) => {
      const child = spawn(bin, ["install", "--check"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      child.on("close", resolve);
      child.on("error", () => resolve(1));
    });

    if (exitCode !== 0) {
      await new Promise<void>((resolve) => {
        const child = spawn(bin, ["install"], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        child.on("close", () => resolve());
        child.on("error", () => resolve());
      });
    }
  } catch {
    // Non-fatal — let the actual command fail with a clear error
  }

  chromeChecked = true;
}

/**
 * Create browser tool handlers using agent-browser CLI.
 */
export function createBrowserToolHandlers(): NamedToolHandler[] {
  return [browserRun()];
}

function browserRun(): NamedToolHandler {
  return {
    name: "browser_run",
    description:
      "Execute a browser automation command using agent-browser. Supports commands like: open, snapshot, click, type, fill, screenshot, evaluate, scroll, wait, close, and more. Uses @eN element references from snapshot output.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "The agent-browser command to execute, e.g. 'open https://example.com', 'snapshot', 'click @e3', 'screenshot /tmp/page.png'",
        },
        timeout_ms: {
          type: "number",
          description: "Optional timeout in milliseconds (default: 60000)",
        },
      },
      required: ["command"],
    },
    options: { category: "sequential", timeoutMs: DEFAULT_TIMEOUT_MS },
    async handler(args, ctx) {
      const command = args.command as string;
      const timeoutMs = (args.timeout_ms as number) ?? DEFAULT_TIMEOUT_MS;
      const bin = getBrowserBin();

      // Lazy Chrome install check
      await ensureChromeInstalled(bin);

      return new Promise((resolve) => {
        // Pass bin + command as a single shell string so arguments are
        // split correctly (e.g. "agent-browser open https://example.com")
        const child = spawn(`${bin} ${command}`, {
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, FORCE_COLOR: "0" },
        });

        let output = "";
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
          output += text;
          pendingDelta += text;
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          output += text;
          pendingDelta += text;
        });

        child.on("close", async (code) => {
          clearTimeout(timeoutTimer);
          clearInterval(flushTimer);
          flushProgress();

          // Truncate large output
          if (output.length > MAX_OUTPUT_LENGTH) {
            const head = output.substring(0, MAX_OUTPUT_LENGTH / 2);
            const tail = output.substring(output.length - MAX_OUTPUT_LENGTH / 2);
            output = `${head}\n...[${output.length - MAX_OUTPUT_LENGTH} chars truncated]...\n${tail}`;
          }

          const exitCode = code ?? 0;

          // Check for screenshot file path in output and attach image
          let images: Array<{ data: string; mimeType: string }> | undefined;
          if (command.startsWith("screenshot")) {
            const match = SCREENSHOT_PATH_RE.exec(output);
            const screenshotPath = match?.[1];
            if (screenshotPath) {
              try {
                const imageBuffer = await readFile(screenshotPath);
                images = [{ data: imageBuffer.toString("base64"), mimeType: "image/png" }];
              } catch {
                // Screenshot file not readable — continue without image
              }
            }
          }

          if (timedOut || exitCode !== 0) {
            resolve({
              content: JSON.stringify({
                exitCode: exitCode || 1,
                output,
                error: timedOut ? `Command timed out after ${timeoutMs}ms` : undefined,
              }),
              isError: true,
              images,
            });
            return;
          }

          resolve({
            content: JSON.stringify({ exitCode: 0, output }),
            images,
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

        ctx.signal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        });
      });
    },
  };
}
