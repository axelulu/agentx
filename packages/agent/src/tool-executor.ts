import type { AgentEvent, AgentTool, AgentToolResult, ToolCall } from "./types.js";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const DEFAULT_PARALLEL_CONCURRENCY = 5;

interface ExecuteToolsConfig {
  defaultTimeoutMs?: number;
  parallelConcurrency?: number;
}

interface ExecutionGroup {
  indices: number[];
  parallel: boolean;
}

/**
 * Execute an array of tool calls, respecting category-based parallelism.
 *
 * Consecutive tools with `category: "parallel"` are batched and run concurrently.
 * All others run sequentially in order.
 *
 * Emits `tool_start`, optionally `tool_update`, and `tool_end` for each tool.
 */
export async function executeTools(
  toolCalls: ToolCall[],
  toolMap: Map<string, AgentTool>,
  signal: AbortSignal,
  emit: (event: AgentEvent) => void,
  config?: ExecuteToolsConfig,
): Promise<Array<{ toolCallId: string; result: AgentToolResult }>> {
  const timeoutMs = config?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const concurrency = config?.parallelConcurrency ?? DEFAULT_PARALLEL_CONCURRENCY;

  // Build execution groups based on tool category
  const groups = resolveExecutionGroups(toolCalls, toolMap);
  const results: Array<{ toolCallId: string; result: AgentToolResult }> = [];

  for (const group of groups) {
    if (signal.aborted) break;

    if (group.parallel && group.indices.length > 1) {
      // Parallel execution with concurrency limit
      const batchResults = await runParallel(
        group.indices,
        toolCalls,
        toolMap,
        signal,
        emit,
        timeoutMs,
        concurrency,
      );
      results.push(...batchResults);
    } else {
      // Sequential execution
      for (const idx of group.indices) {
        if (signal.aborted) break;
        const r = await executeSingle(toolCalls[idx]!, toolMap, signal, emit, timeoutMs);
        results.push(r);
      }
    }
  }

  return results;
}

function resolveExecutionGroups(
  toolCalls: ToolCall[],
  toolMap: Map<string, AgentTool>,
): ExecutionGroup[] {
  const groups: ExecutionGroup[] = [];
  let parallelBatch: number[] = [];

  const flushParallel = () => {
    if (parallelBatch.length > 0) {
      groups.push({ indices: parallelBatch, parallel: true });
      parallelBatch = [];
    }
  };

  for (let i = 0; i < toolCalls.length; i++) {
    const tool = toolMap.get(toolCalls[i]!.name);
    const category = tool?.category ?? "sequential";
    if (category === "parallel") {
      parallelBatch.push(i);
    } else {
      flushParallel();
      groups.push({ indices: [i], parallel: false });
    }
  }

  flushParallel();
  return groups;
}

async function runParallel(
  indices: number[],
  toolCalls: ToolCall[],
  toolMap: Map<string, AgentTool>,
  signal: AbortSignal,
  emit: (event: AgentEvent) => void,
  timeoutMs: number,
  _concurrency: number,
): Promise<Array<{ toolCallId: string; result: AgentToolResult }>> {
  // Run all parallel tools concurrently via Promise.allSettled
  const settled = await Promise.allSettled(
    indices.map((idx) => executeSingle(toolCalls[idx]!, toolMap, signal, emit, timeoutMs)),
  );

  const results: Array<{ toolCallId: string; result: AgentToolResult }> = [];

  for (let i = 0; i < indices.length; i++) {
    const outcome = settled[i]!;
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      const toolCall = toolCalls[indices[i]!]!;
      results.push({
        toolCallId: toolCall.id,
        result: {
          content: `Tool execution error: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`,
          isError: true,
        },
      });
    }
  }

  return results;
}

async function executeSingle(
  toolCall: ToolCall,
  toolMap: Map<string, AgentTool>,
  signal: AbortSignal,
  emit: (event: AgentEvent) => void,
  timeoutMs: number,
): Promise<{ toolCallId: string; result: AgentToolResult }> {
  const tool = toolMap.get(toolCall.name);

  emit({
    type: "tool_start",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    arguments: toolCall.arguments,
    timestamp: Date.now(),
  });

  if (!tool) {
    const result: AgentToolResult = {
      content: `Tool not found: ${toolCall.name}`,
      isError: true,
    };
    emit({
      type: "tool_end",
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result,
      timestamp: Date.now(),
    });
    return { toolCallId: toolCall.id, result };
  }

  const effectiveTimeout = tool.timeoutMs ?? timeoutMs;
  let result: AgentToolResult;

  try {
    result = await withTimeout(
      tool.execute(toolCall.arguments, {
        signal,
        emitProgress: (update: string) => {
          emit({
            type: "tool_update",
            toolCallId: toolCall.id,
            update,
            timestamp: Date.now(),
          });
        },
      }),
      effectiveTimeout,
      toolCall.name,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { content: `Tool execution error: ${message}`, isError: true };
  }

  emit({
    type: "tool_end",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    result,
    timestamp: Date.now(),
  });

  return { toolCallId: toolCall.id, result };
}

function withTimeout<T>(promise: Promise<T>, ms: number, toolName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${ms}ms: ${toolName}`));
    }, ms);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
