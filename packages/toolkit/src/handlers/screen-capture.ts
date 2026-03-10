import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import type { NamedToolHandler } from "../types";

/**
 * Create the screen_capture tool handler.
 * Uses macOS `screencapture` command to capture screenshots.
 */
export function createScreenCaptureHandler(): NamedToolHandler {
  return {
    name: "screen_capture",
    description:
      "Capture a screenshot of the entire screen or a specific region. The captured image is returned for visual analysis (OCR, UI inspection, etc.).",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "object",
          description: "Optional region to capture. If omitted, captures the entire screen.",
          properties: {
            x: { type: "number", description: "X coordinate of top-left corner" },
            y: { type: "number", description: "Y coordinate of top-left corner" },
            width: { type: "number", description: "Width of the region" },
            height: { type: "number", description: "Height of the region" },
          },
          required: ["x", "y", "width", "height"],
        },
      },
    },
    options: { category: "sequential" },
    async handler(args, ctx) {
      if (process.platform !== "darwin") {
        return {
          content: "screen_capture is only available on macOS.",
          isError: true,
        };
      }

      const tmpFile = join(tmpdir(), `agentx-screenshot-${randomUUID()}.png`);
      const region = args.region as
        | { x: number; y: number; width: number; height: number }
        | undefined;

      try {
        // Build screencapture command arguments
        const captureArgs: string[] = ["-x", "-t", "png"];
        if (region) {
          captureArgs.push("-R", `${region.x},${region.y},${region.width},${region.height}`);
        }
        captureArgs.push(tmpFile);

        // Execute screencapture
        await new Promise<void>((resolve, reject) => {
          const proc = execFile("screencapture", captureArgs, (error) => {
            if (error) reject(error);
            else resolve();
          });

          // Respect abort signal
          if (ctx.signal.aborted) {
            proc.kill();
            reject(new Error("Aborted"));
          }
          ctx.signal.addEventListener("abort", () => proc.kill(), { once: true });
        });

        // Read the captured image
        const imageBuffer = await readFile(tmpFile);
        const base64 = imageBuffer.toString("base64");

        // Clean up temp file
        await unlink(tmpFile).catch(() => {});

        const sizeKB = Math.round(imageBuffer.length / 1024);
        const description = region
          ? `Screenshot captured (region: ${region.width}x${region.height} at ${region.x},${region.y}, ${sizeKB}KB)`
          : `Screenshot captured (full screen, ${sizeKB}KB)`;

        return {
          content: description,
          images: [{ data: base64, mimeType: "image/png" }],
        };
      } catch (err) {
        // Clean up on error
        await unlink(tmpFile).catch(() => {});
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: `Failed to capture screenshot: ${message}`,
          isError: true,
        };
      }
    },
  };
}
