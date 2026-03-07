import type { Middleware, LLMMessage } from "../types.js";
import type { ContextManager } from "../context-manager.js";
import type { OptimizeContextOptions } from "../types.js";

/**
 * Create a Middleware that applies context optimization
 * before each model call.
 */
export function createContextMiddleware(
  manager: ContextManager,
  options?: OptimizeContextOptions,
): Middleware {
  return {
    name: "context-optimizer",
    async beforeModelCall(ctx): Promise<LLMMessage[] | void> {
      const optimized = await manager.optimizeContext(ctx.messages, {
        ...options,
        streamFn: options?.streamFn ?? ctx.config.streamFn,
        model: options?.model ?? ctx.config.model,
      });
      return optimized;
    },
  };
}
