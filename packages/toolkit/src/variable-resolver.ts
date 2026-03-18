/**
 * Variable Resolver
 * Simple variable replacement utility for prompt templates and tool definitions
 *
 * Variable syntax: ${variableName}
 */

// Variable pattern: ${variableName}
const VARIABLE_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Replace variables in a string
 */
export function replaceVariables(
  content: string,
  variables: Record<string, unknown>,
  preserveUndefined = false,
): string {
  return content.replace(VARIABLE_PATTERN, (match, varName) => {
    const value = variables[varName.trim()];
    if (value === undefined) {
      return preserveUndefined ? match : "";
    }
    return String(value);
  });
}

/**
 * Deep replace variables in an object.
 *
 * Overloads handle the three structural cases (string, array, object)
 * so callers get back the same type they passed in without assertions.
 */
export function replaceVariablesInObject(
  obj: string,
  variables: Record<string, unknown>,
  preserveUndefined?: boolean,
): string;
export function replaceVariablesInObject<T>(
  obj: T[],
  variables: Record<string, unknown>,
  preserveUndefined?: boolean,
): T[];
export function replaceVariablesInObject<T extends Record<string, unknown>>(
  obj: T,
  variables: Record<string, unknown>,
  preserveUndefined?: boolean,
): T;
export function replaceVariablesInObject(
  obj: unknown,
  variables: Record<string, unknown>,
  preserveUndefined = false,
): unknown {
  if (typeof obj === "string") {
    return replaceVariables(obj, variables, preserveUndefined);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => replaceVariablesInObject(item, variables, preserveUndefined));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariablesInObject(value, variables, preserveUndefined);
    }
    return result;
  }

  return obj;
}

/**
 * Merge multiple variable sources (later sources override earlier ones)
 */
export function mergeVariables(
  ...sources: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (source) {
      Object.assign(result, source);
    }
  }
  return result;
}
