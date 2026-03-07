import type { NamedToolHandler } from "../types";
import { createFileToolHandlers } from "./file-tools";
import { createShellToolHandlers } from "./shell-tools";

/**
 * Create all desktop tool handlers for the given workspace root.
 */
export function createDesktopHandlers(workspaceRoot: string): NamedToolHandler[] {
  return [...createFileToolHandlers(workspaceRoot), ...createShellToolHandlers(workspaceRoot)];
}

export { createFileToolHandlers } from "./file-tools";
export { createShellToolHandlers } from "./shell-tools";
