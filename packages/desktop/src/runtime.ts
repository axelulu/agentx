import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Toolkit,
  createDesktopHandlers,
  ContextManager,
  createContextMiddleware,
} from "@workspace/agent";
import type { AgentMessage, AgentTool } from "@workspace/agent";
import { ProviderManager } from "./providers/provider-manager.js";
import { ConversationManager } from "./conversations/conversation-manager.js";
import { JsonFileStore } from "./conversations/json-file-store.js";
import { SessionRunner } from "./sessions/session-runner.js";
import {
  DEFAULT_TOOL_PERMISSIONS,
  getToolPermissionCategory,
  isWriteOrExecuteTool,
} from "./types.js";
import type {
  DesktopRuntimeConfig,
  DesktopProviderConfig,
  ConversationData,
  MessageData,
  SerializableAgentEvent,
  SessionStatusInfo,
  SessionStatus,
  ToolPermissions,
} from "./types.js";

// ---------------------------------------------------------------------------
// SessionState — per-conversation agent execution state
// ---------------------------------------------------------------------------

interface SessionState {
  runner: SessionRunner;
  conversationId: string;
  eventLog: SerializableAgentEvent[];
  status: SessionStatus;
  startedAt: number;
  subscriber: ((event: SerializableAgentEvent) => void) | null;
  pendingApprovals: Map<string, { resolve: (approved: boolean) => void; toolName: string }>;
  sessionApprovedCategories: Set<string>;
  pendingMessages: MessageData[];
  /** Number of input messages (user + history) at start — used to slice new messages */
  inputMessageCount: number;
  /** Cleanup timer ID for post-completion session retention */
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * DesktopRuntime — main facade for the desktop agent system.
 *
 * Composes agent + brain + tools + context into a single API surface
 * that Electron IPC handlers can call. This class itself has no
 * Electron dependency — IPC wiring is done in apps/agentx.
 *
 * Agent execution runs in the main process independently. Switching chats,
 * refreshing, or navigating away doesn't interrupt execution. Returning
 * to a conversation shows correct, real-time state via the subscriber pattern.
 */
export class DesktopRuntime {
  private config: DesktopRuntimeConfig;
  private toolkit!: Toolkit;
  private contextManager!: ContextManager;
  private providerManager: ProviderManager;
  private conversationManager!: ConversationManager;
  private sessions = new Map<string, SessionState>();
  private tools: AgentTool[] = [];

  // --- Tool Permissions ---
  private toolPermissions: ToolPermissions = { ...DEFAULT_TOOL_PERMISSIONS };
  private permissionsFilePath!: string;

  constructor(config: DesktopRuntimeConfig) {
    this.config = config;
    this.providerManager = new ProviderManager();
  }

  /**
   * Initialize all subsystems. Must be called before any other method.
   */
  async initialize(): Promise<void> {
    // 1. Initialize Toolkit (YAML loader)
    this.toolkit = new Toolkit({
      basePath: this.config.toolkitPath,
      language: this.config.language,
    });
    await this.toolkit.initialize();

    // 2. Register desktop tool handlers (with inline metadata)
    const handlers = createDesktopHandlers(this.config.workspacePath);
    for (const h of handlers) {
      this.toolkit.registerToolHandler(h.name, h.handler, h.options, {
        description: h.description,
        parameters: h.parameters,
        toolType: h.toolType,
      });
    }

    // 3. Build tools from registered handlers (YAML defs preferred, inline metadata as fallback)
    const rawTools = this.toolkit.buildToolsFromHandlers() as AgentTool[];

    // 4. Store raw tools (permission wrapping is done per-session)
    this.tools = rawTools;

    // 5. Initialize Context Manager
    this.contextManager = new ContextManager({
      maxContextTokens: 100_000,
      recentTurnsToKeep: 5,
      toolResultMaxChars: 3000,
      toolResultHeadChars: 500,
      toolResultTailChars: 2500,
    });

    // 6. Initialize Conversation Store
    const store = new JsonFileStore(this.config.dataPath);
    await store.initialize();
    this.conversationManager = new ConversationManager(store);

    // 7. Load tool permissions
    this.permissionsFilePath = join(this.config.dataPath, "..", "tool-permissions.json");
    this.loadToolPermissions();
  }

  // ---------------------------------------------------------------------------
  // Conversation management
  // ---------------------------------------------------------------------------

  async createConversation(title?: string): Promise<ConversationData> {
    return this.conversationManager.createConversation(title);
  }

  async listConversations(): Promise<ConversationData[]> {
    return this.conversationManager.listConversations();
  }

  async deleteConversation(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.runner.abort();
      if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
      this.sessions.delete(id);
    }
    return this.conversationManager.deleteConversation(id);
  }

  async getMessages(conversationId: string): Promise<MessageData[]> {
    return this.conversationManager.getMessages(conversationId);
  }

  async updateConversationTitle(id: string, title: string): Promise<ConversationData> {
    return this.conversationManager.updateTitle(id, title);
  }

  // ---------------------------------------------------------------------------
  // Provider management
  // ---------------------------------------------------------------------------

  setProviderConfig(config: DesktopProviderConfig): void {
    this.providerManager.setProvider(config);
  }

  removeProvider(id: string): void {
    this.providerManager.removeProvider(id);
  }

  setActiveProvider(id: string): void {
    this.providerManager.setActiveProvider(id);
  }

  getProviderConfigs(): DesktopProviderConfig[] {
    return this.providerManager.getProviderConfigs();
  }

  // ---------------------------------------------------------------------------
  // Tool permissions management
  // ---------------------------------------------------------------------------

  getToolPermissions(): ToolPermissions {
    return { ...this.toolPermissions };
  }

  setToolPermissions(permissions: ToolPermissions): void {
    this.toolPermissions = { ...permissions };
    this.saveToolPermissions();
  }

  private loadToolPermissions(): void {
    try {
      if (existsSync(this.permissionsFilePath)) {
        const data = JSON.parse(readFileSync(this.permissionsFilePath, "utf-8")) as ToolPermissions;
        this.toolPermissions = { ...DEFAULT_TOOL_PERMISSIONS, ...data };
      }
    } catch {
      // corrupted or missing — use defaults
    }
  }

  private saveToolPermissions(): void {
    try {
      writeFileSync(
        this.permissionsFilePath,
        JSON.stringify(this.toolPermissions, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.error("[DesktopRuntime] Failed to save tool permissions:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-session tool permission wrapping
  // ---------------------------------------------------------------------------

  /**
   * Wrap a tool with permission enforcement scoped to a specific session.
   */
  private wrapToolWithSessionPermissions(tool: AgentTool, session: SessionState): AgentTool {
    const runtime = this;
    const originalExecute = tool.execute;

    return {
      ...tool,
      async execute(args, ctx) {
        const category = getToolPermissionCategory(tool.name);

        // 1. Check if tool category is enabled
        if (category !== "none") {
          const allowed = runtime.toolPermissions[category];
          if (!allowed) {
            return {
              content: `Permission denied: ${tool.name} is disabled in settings. The user has disabled the "${category}" permission.`,
              isError: true,
            };
          }
        }

        // 2. Check path restrictions for file tools
        if (
          (category === "fileRead" || category === "fileWrite") &&
          runtime.toolPermissions.allowedPaths.length > 0
        ) {
          const filePath = (args.file_path as string) ?? "";
          const isPathAllowed = runtime.toolPermissions.allowedPaths.some((allowed) =>
            filePath.startsWith(allowed),
          );
          if (!isPathAllowed) {
            return {
              content: `Permission denied: access to "${filePath}" is outside allowed paths.`,
              isError: true,
            };
          }
        }

        // 3. Check if approval is needed
        const mode = runtime.toolPermissions.approvalMode;
        const needsApproval =
          mode === "always-ask" || (mode === "smart" && isWriteOrExecuteTool(tool.name));

        if (
          needsApproval &&
          category !== "none" &&
          !session.sessionApprovedCategories.has(category)
        ) {
          const approved = await runtime.requestToolApproval(session, tool.name, args);
          if (!approved) {
            return {
              content: `Tool execution denied by user: ${tool.name}`,
              isError: true,
            };
          }
        }

        return originalExecute(args, ctx);
      },
    };
  }

  /**
   * Request user approval for a tool execution, scoped to a session.
   * Blocks until user connects and responds — does NOT auto-approve when no subscriber.
   */
  private requestToolApproval(
    session: SessionState,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      session.pendingApprovals.set(approvalId, { resolve, toolName });
      session.status = "awaiting_approval";

      const approvalEvent: SerializableAgentEvent = {
        type: "tool_approval_request",
        conversationId: session.conversationId,
        approvalId,
        toolName,
        arguments: args,
        timestamp: Date.now(),
      };

      // Log in event log so it replays when user subscribes
      session.eventLog.push(approvalEvent);

      // Forward to subscriber if present
      session.subscriber?.(approvalEvent);
    });
  }

  /**
   * Resolve a pending tool approval (called from IPC handler).
   * Now requires conversationId to find the correct session.
   */
  resolveToolApproval(conversationId: string, approvalId: string, approved: boolean): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    const pending = session.pendingApprovals.get(approvalId);
    if (pending) {
      if (approved) {
        const category = getToolPermissionCategory(pending.toolName);
        if (category !== "none") {
          session.sessionApprovedCategories.add(category);
        }
      }
      session.status = "running";
      pending.resolve(approved);
      session.pendingApprovals.delete(approvalId);
    }
  }

  // ---------------------------------------------------------------------------
  // Subscriber pattern — for connecting/disconnecting renderers
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to a session's events. Replays eventLog first, then forwards live events.
   */
  subscribe(conversationId: string, callback: (event: SerializableAgentEvent) => void): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    // Replay existing events
    for (const event of session.eventLog) {
      callback(event);
    }

    // Set as live subscriber
    session.subscriber = callback;
  }

  /**
   * Unsubscribe from a session's events.
   */
  unsubscribe(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.subscriber = null;
    }
  }

  /**
   * Get status info for a specific session, or null if no session exists.
   */
  getSessionStatus(conversationId?: string): SessionStatusInfo | null {
    if (!conversationId) return null;
    const session = this.sessions.get(conversationId);
    if (!session) return null;

    let pendingApproval: (SerializableAgentEvent & { type: "tool_approval_request" }) | undefined;
    if (session.status === "awaiting_approval" && session.pendingApprovals.size > 0) {
      for (let i = session.eventLog.length - 1; i >= 0; i--) {
        const e = session.eventLog[i];
        if (e && e.type === "tool_approval_request") {
          pendingApproval = e;
          break;
        }
      }
    }

    return {
      conversationId: session.conversationId,
      status: session.status,
      startedAt: session.startedAt,
      eventCount: session.eventLog.length,
      pendingApproval: pendingApproval ?? undefined,
    };
  }

  /**
   * List all conversation IDs with active (non-completed) sessions.
   */
  getRunningConversations(): string[] {
    const result: string[] = [];
    for (const [convId, session] of this.sessions) {
      if (session.status === "running" || session.status === "awaiting_approval") {
        result.push(convId);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Agent execution
  // ---------------------------------------------------------------------------

  /**
   * Send a user message and start the agent loop in the background.
   * Returns immediately — events are delivered via the subscriber pattern.
   */
  async sendMessage(conversationId: string, content: string): Promise<void> {
    const streamFn = this.providerManager.createStreamFn();
    const model = this.providerManager.getDefaultModel();

    // Load existing messages and sanitize (fix corrupted persisted data)
    const rawMessages = await this.conversationManager.getMessages(conversationId);
    const existingMessages = sanitizeMessages(rawMessages);
    const agentMessages = existingMessages.map(toAgentMessage);

    // Append the new user message
    agentMessages.push({ role: "user", content });

    // Debug: log message structure for diagnosing 400 errors
    console.log(
      `[DesktopRuntime] sendMessage: ${agentMessages.length} messages`,
      agentMessages
        .map((m, i) => {
          const tc =
            m.role === "assistant" && m.toolCalls ? ` [${m.toolCalls.length} tool_calls]` : "";
          const tcId =
            m.role === "tool" ? ` (toolCallId=${(m as { toolCallId?: string }).toolCallId})` : "";
          return `  ${i}: ${m.role}${tc}${tcId} content=${typeof m.content === "string" ? `"${m.content.slice(0, 50)}..."` : m.content}`;
        })
        .join("\n"),
    );

    // Record user message
    await this.conversationManager.appendMessages(conversationId, [
      { role: "user", content, timestamp: Date.now() },
    ]);

    // Build system prompt
    const capabilities = this.config.capabilities ?? this.toolkit.getAllCapabilityIds();
    const toolSummary = this.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
    const promptVars: Record<string, unknown> = {
      tool_names: this.tools.map((t) => t.name).join(", "),
      tool_summary: toolSummary,
    };
    let systemPrompt = this.toolkit.composePrompt(capabilities, promptVars);
    if (systemPrompt.length < 100) {
      systemPrompt = FALLBACK_SYSTEM_PROMPT + (systemPrompt ? "\n\n" + systemPrompt : "");
    }

    // Create session state
    const session: SessionState = {
      runner: new SessionRunner(),
      conversationId,
      eventLog: [],
      status: "running",
      startedAt: Date.now(),
      subscriber: null,
      pendingApprovals: new Map(),
      sessionApprovedCategories: new Set(),
      pendingMessages: [],
      inputMessageCount: agentMessages.length,
      cleanupTimer: null,
    };

    // Abort any existing session for this conversation
    const existingSession = this.sessions.get(conversationId);
    if (existingSession) {
      existingSession.runner.abort();
      if (existingSession.cleanupTimer) clearTimeout(existingSession.cleanupTimer);
    }

    this.sessions.set(conversationId, session);

    // Wrap tools with per-session permissions
    const sessionTools = this.tools.map((tool) =>
      this.wrapToolWithSessionPermissions(tool, session),
    );

    const contextMiddleware = createContextMiddleware(this.contextManager, {
      conversationId,
      streamFn,
      model,
    });

    // Fire-and-forget — run the session in background
    this.runSession(session, agentMessages, {
      model,
      systemPrompt,
      tools: sessionTools,
      streamFn,
      middleware: [contextMiddleware],
    }).catch((err) => {
      console.error(`[DesktopRuntime] Session ${conversationId} failed:`, err);
    });
  }

  /**
   * Run the agent loop in the background. Internal method.
   */
  private async runSession(
    session: SessionState,
    agentMessages: AgentMessage[],
    config: {
      model: string;
      systemPrompt: string;
      tools: AgentTool[];
      streamFn: ReturnType<ProviderManager["createStreamFn"]>;
      middleware: unknown[];
    },
  ): Promise<void> {
    const conversationId = session.conversationId;

    const onEvent = (event: SerializableAgentEvent) => {
      // Log to event log
      session.eventLog.push(event);

      // Forward to subscriber
      session.subscriber?.(event);

      // Incremental persistence
      this.handleIncrementalPersistence(session, event);
    };

    try {
      await session.runner.run(
        agentMessages,
        config as Parameters<SessionRunner["run"]>[1],
        conversationId,
        onEvent,
      );

      // Final flush of any remaining pending messages
      if (session.pendingMessages.length > 0) {
        await this.conversationManager.appendMessages(conversationId, session.pendingMessages);
        session.pendingMessages = [];
      }

      session.status = "completed";
    } catch (err) {
      // Flush what we have on error too
      if (session.pendingMessages.length > 0) {
        try {
          await this.conversationManager.appendMessages(conversationId, session.pendingMessages);
          session.pendingMessages = [];
        } catch {
          // ignore flush errors
        }
      }

      session.status = "error";

      // Emit error event
      const errorEvent: SerializableAgentEvent = {
        type: "error",
        conversationId,
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
        fatal: true,
      };
      session.eventLog.push(errorEvent);
      session.subscriber?.(errorEvent);
    } finally {
      // Cancel any pending approvals
      for (const [, pending] of session.pendingApprovals) {
        pending.resolve(false);
      }
      session.pendingApprovals.clear();

      // Keep session for 30s for reconnection, then clean up
      session.cleanupTimer = setTimeout(() => {
        if (this.sessions.get(conversationId) === session) {
          this.sessions.delete(conversationId);
        }
      }, 30_000);
    }
  }

  // ---------------------------------------------------------------------------
  // Incremental message persistence
  // ---------------------------------------------------------------------------

  /**
   * Persist messages incrementally as events arrive, rather than waiting
   * for the full agent loop to complete.
   */
  private handleIncrementalPersistence(session: SessionState, event: SerializableAgentEvent): void {
    switch (event.type) {
      case "message_end":
        // Accumulate assistant message
        session.pendingMessages.push({
          role: "assistant",
          content: event.content,
          timestamp: event.timestamp,
        });
        break;

      case "tool_start": {
        // Find the last assistant message in pending (may not be the last entry
        // because earlier tool_end events push tool-result messages after it).
        let assistantMsg: MessageData | undefined;
        for (let i = session.pendingMessages.length - 1; i >= 0; i--) {
          if (session.pendingMessages[i]!.role === "assistant") {
            assistantMsg = session.pendingMessages[i];
            break;
          }
        }
        if (assistantMsg) {
          if (!assistantMsg.toolCalls) assistantMsg.toolCalls = [];
          assistantMsg.toolCalls.push({
            id: event.toolCallId,
            name: event.toolName,
            arguments: event.arguments,
          });
        }
        break;
      }

      case "tool_end": {
        // Accumulate tool result message (flush happens at turn_end)
        session.pendingMessages.push({
          role: "tool",
          content: event.result.content,
          toolCallId: event.toolCallId,
          isError: event.result.isError,
          timestamp: event.timestamp,
        });
        break;
      }

      case "turn_end":
      case "agent_end": {
        // Flush all pending messages at the end of a turn (or agent run).
        // This ensures assistant messages contain ALL tool calls from the
        // turn before being written to disk.
        const toFlush = session.pendingMessages.splice(0);
        if (toFlush.length > 0) {
          this.conversationManager.appendMessages(session.conversationId, toFlush).catch((err) => {
            console.error(
              `[DesktopRuntime] Failed to persist messages for ${session.conversationId}:`,
              err,
            );
          });
        }
        break;
      }
    }
  }

  /**
   * Abort a running agent session.
   */
  abort(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.runner.abort();
      session.status = "aborted";
      // Cancel any pending approvals on abort
      for (const [, pending] of session.pendingApprovals) {
        pending.resolve(false);
      }
      session.pendingApprovals.clear();
    }
  }
}

// ---------------------------------------------------------------------------
// Fallback system prompt (used when YAML templates are missing)
// ---------------------------------------------------------------------------

const FALLBACK_SYSTEM_PROMPT = `You are AgentX, an AI assistant with access to tools that let you interact with the user's computer.

When the user asks you to do something:
1. Think about what steps are needed.
2. Use your tools to carry out each step.
3. After each tool result, decide if more steps are needed.
4. Continue until the task is fully complete.
5. When finished, call the task_complete tool with a brief summary of what you accomplished.

Always use tools when the task involves reading, creating, or modifying files, or running commands.
Do not just describe what you would do — actually do it by calling the appropriate tool.
If a tool call fails, read the error and try a different approach.
When the task is complete, you MUST call the task_complete tool to signal that you are done.`;

// ---------------------------------------------------------------------------
// Message sanitization — fixes corrupted persisted data
// ---------------------------------------------------------------------------

/**
 * Sanitize messages loaded from disk to fix structural issues that
 * would cause provider API 400 errors.
 *
 * Fixes:
 * 1. Orphaned tool results (toolCallId not in any assistant's toolCalls)
 *    → adds the missing toolCall to the nearest preceding assistant
 * 2. Missing tool results for an assistant's toolCalls
 *    → inserts placeholder error results
 * 3. Consecutive user messages → merges them
 */
function sanitizeMessages(messages: MessageData[]): MessageData[] {
  if (messages.length === 0) return messages;

  // Collect all declared toolCall IDs from assistant messages
  const declaredToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.toolCalls) {
      for (const tc of msg.toolCalls) declaredToolCallIds.add(tc.id);
    }
  }

  // Fix 1: orphaned tool results → add missing toolCall to preceding assistant
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg.role === "tool" && msg.toolCallId && !declaredToolCallIds.has(msg.toolCallId)) {
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j]!.role === "assistant") {
          if (!messages[j]!.toolCalls) messages[j]!.toolCalls = [];
          messages[j]!.toolCalls!.push({
            id: msg.toolCallId,
            name: "unknown_tool",
            arguments: {},
          });
          declaredToolCallIds.add(msg.toolCallId);
          console.warn(`[sanitize] Rebuilt missing toolCall ${msg.toolCallId} on assistant[${j}]`);
          break;
        }
      }
    }
  }

  // Collect existing tool result IDs
  const existingResultIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "tool" && msg.toolCallId) existingResultIds.add(msg.toolCallId);
  }

  // Fix 2: missing tool results → insert placeholders after the assistant's tool results
  const patched: MessageData[] = [];
  for (let i = 0; i < messages.length; i++) {
    patched.push(messages[i]!);
    const msg = messages[i]!;

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      // Skip over the following tool result messages for this assistant
      while (i + 1 < messages.length && messages[i + 1]!.role === "tool") {
        i++;
        patched.push(messages[i]!);
      }
      // Now add placeholders for any tool calls missing their results
      for (const tc of msg.toolCalls) {
        if (!existingResultIds.has(tc.id)) {
          console.warn(
            `[sanitize] Adding placeholder for missing tool result ${tc.id} (${tc.name})`,
          );
          patched.push({
            role: "tool",
            content: "[Tool result not recorded]",
            toolCallId: tc.id,
            isError: true,
            timestamp: msg.timestamp ?? Date.now(),
          });
        }
      }
    }
  }

  // Fix 3: merge consecutive user messages
  const result: MessageData[] = [];
  for (const msg of patched) {
    const prev = result[result.length - 1];
    if (prev && prev.role === "user" && msg.role === "user") {
      prev.content = ((prev.content ?? "") + "\n\n" + (msg.content ?? "")).trim();
      console.warn("[sanitize] Merged consecutive user messages");
    } else {
      result.push(msg);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Message conversion helpers
// ---------------------------------------------------------------------------

function toAgentMessage(msg: MessageData): AgentMessage {
  if (msg.role === "user") {
    return { role: "user", content: msg.content ?? "" };
  }
  if (msg.role === "tool") {
    return {
      role: "tool",
      toolCallId: msg.toolCallId ?? "",
      content: msg.content ?? "",
      isError: msg.isError,
    };
  }
  // assistant
  return {
    role: "assistant",
    content: msg.content || null,
    toolCalls: msg.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
  };
}
