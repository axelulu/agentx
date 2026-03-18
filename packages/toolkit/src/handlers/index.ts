import type { NamedToolHandler } from "../types";
import { createBrowserToolHandlers } from "./browser-tools";
import { createFileToolHandlers } from "./file-tools";
import { createShellToolHandlers } from "./shell-tools";
import { createScreenCaptureHandler } from "./screen-capture";
import { createSearchToolHandlers } from "./search-tools";

/**
 * task_complete — terminal tool that signals the agent loop to stop.
 */
function taskComplete(): NamedToolHandler {
  return {
    name: "task_complete",
    description:
      "Call this tool when you have fully completed the user's task. Provide a brief summary of what was accomplished.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "A brief summary of what was accomplished",
        },
      },
      required: ["summary"],
    },
    toolType: "terminal",
    options: { category: "sequential" },
    async handler(args) {
      const summary = (args.summary as string) ?? "Task completed.";
      return { content: summary };
    },
  };
}

/**
 * Create all desktop tool handlers for the given workspace root.
 */
export function createDesktopHandlers(workspaceRoot: string): NamedToolHandler[] {
  return [
    ...createFileToolHandlers(workspaceRoot),
    ...createSearchToolHandlers(workspaceRoot),
    ...createShellToolHandlers(workspaceRoot),
    ...createBrowserToolHandlers(),
    createScreenCaptureHandler(),
    taskComplete(),
  ];
}

export { createBrowserToolHandlers } from "./browser-tools";
export { createFileToolHandlers } from "./file-tools";
export { createSearchToolHandlers } from "./search-tools";
export { createShellToolHandlers } from "./shell-tools";
export { createScreenCaptureHandler } from "./screen-capture";
