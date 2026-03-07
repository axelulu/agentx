import { resolve, normalize } from "node:path";

/**
 * Validate and resolve a file path, ensuring it stays within the workspace root.
 * Returns the resolved absolute path or throws if the path escapes the workspace.
 */
export function sanitizePath(inputPath: string, workspaceRoot: string): string {
  const resolvedRoot = resolve(workspaceRoot);
  const resolvedPath = resolve(resolvedRoot, normalize(inputPath));

  if (!resolvedPath.startsWith(resolvedRoot + "/") && resolvedPath !== resolvedRoot) {
    throw new Error(`Path "${inputPath}" resolves outside workspace root "${resolvedRoot}"`);
  }

  return resolvedPath;
}

/**
 * Check if a path is within the workspace root (does not throw).
 */
export function isPathWithinWorkspace(inputPath: string, workspaceRoot: string): boolean {
  try {
    sanitizePath(inputPath, workspaceRoot);
    return true;
  } catch {
    return false;
  }
}
