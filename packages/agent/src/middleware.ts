import type { AgentMiddleware } from "./types.js";

/**
 * Create a named middleware from hook functions.
 */
export function createMiddleware(
  name: string,
  hooks: Omit<AgentMiddleware, "name">,
): AgentMiddleware {
  return { name, ...hooks };
}

/**
 * Compose multiple middlewares into a single middleware.
 * Hooks are executed in order for before* hooks, and reverse order for after* hooks.
 */
export function composeMiddleware(...middlewares: AgentMiddleware[]): AgentMiddleware {
  return {
    name: `composed(${middlewares.map((m) => m.name).join(", ")})`,

    async beforeModelCall(ctx) {
      let messages = ctx.messages;
      for (const mw of middlewares) {
        if (mw.beforeModelCall) {
          const result = await mw.beforeModelCall({ ...ctx, messages });
          if (result) messages = result;
        }
      }
      return messages.length !== ctx.messages.length || messages !== ctx.messages
        ? messages
        : undefined;
    },

    async afterModelCall(ctx) {
      // Reverse order for after hooks
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i];
        if (mw.afterModelCall) {
          const shouldStop = await mw.afterModelCall(ctx);
          if (shouldStop === true) return true;
        }
      }
      return undefined;
    },

    async beforeToolExecution(ctx) {
      let args: Record<string, unknown> | undefined;
      for (const mw of middlewares) {
        if (mw.beforeToolExecution) {
          const result = await mw.beforeToolExecution(ctx);
          if (result) args = result;
        }
      }
      return args;
    },

    async afterToolExecution(ctx) {
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i];
        if (mw.afterToolExecution) {
          await mw.afterToolExecution(ctx);
        }
      }
    },
  };
}
