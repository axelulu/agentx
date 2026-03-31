import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import type { HandlerMap } from "./register-handlers";

export function registerScreenHandlers(handlers: HandlerMap): void {
  handlers["screen:capture"] = async () => {
    if (process.platform !== "darwin") return null;

    const tmpFile = join(tmpdir(), `agentx-screenshot-${Date.now()}.png`);

    try {
      await new Promise<void>((resolve, reject) => {
        execFile("screencapture", ["-i", "-x", "-t", "png", tmpFile], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      if (!existsSync(tmpFile)) return null;

      const imageBuffer = readFileSync(tmpFile);
      const base64 = imageBuffer.toString("base64");

      try {
        unlinkSync(tmpFile);
      } catch {
        // ignore
      }

      return { data: base64, mimeType: "image/png" };
    } catch {
      try {
        unlinkSync(tmpFile);
      } catch {
        // ignore
      }
      return null;
    }
  };
}
