import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Toolkit,
  createDesktopHandlers,
  ContextManager,
  createContextMiddleware,
} from "@agentx/agent";
import type { AgentMessage, AgentTool, ContentPart } from "@agentx/agent";
import { ProviderManager } from "./providers/provider-manager.js";
import { ConversationManager } from "./conversations/conversation-manager.js";
import { JsonFileStore } from "./conversations/json-file-store.js";
import { SessionRunner } from "./sessions/session-runner.js";
import { MCPClientManager } from "./mcp/index.js";
import { ScheduledTaskManager, createSchedulerToolHandlers } from "./scheduler/index.js";
import type { ScheduledTask, ScheduledTaskStatusUpdate } from "./scheduler/index.js";
import { MemoryManager } from "./memory/index.js";
import type { ConversationSummary, LearnedFact, MemoryConfig } from "./memory/index.js";
import { createSubAgentTool, createOrchestratorTool } from "./sub-agent/index.js";
import {
  DEFAULT_TOOL_PERMISSIONS,
  getToolPermissionCategory,
  isWriteOrExecuteTool,
} from "./types.js";
import type {
  AgentRuntimeConfig,
  ProviderConfig,
  ConversationData,
  KnowledgeBaseItem,
  SkillDefinition,
  MCPServerConfig,
  MCPServerState,
  MessageData,
  BranchInfo,
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
  /** ID of the last message emitted in this session — used as parentId for next message */
  lastEmittedMessageId: string | null;
  /** ID of the user message that triggered this session — used for activeBranches */
  triggerUserMessageId: string | null;
  /** Promise tracking the in-flight persistence flush — awaited before regenerate */
  flushPromise: Promise<void> | null;
  /** Index into eventLog up to which events have been delivered to the subscriber.
   *  Used to avoid replaying already-delivered events on re-subscribe. */
  deliveredUpTo: number;
}

/**
 * AgentRuntime — main facade for the desktop agent system.
 *
 * Composes agent + brain + tools + context into a single API surface
 * that Tauri IPC handlers can call. This class itself has no
 * Tauri dependency — IPC wiring is done in apps/desktop.
 *
 * Agent execution runs in the main process independently. Switching chats,
 * refreshing, or navigating away doesn't interrupt execution. Returning
 * to a conversation shows correct, real-time state via the subscriber pattern.
 */
export class AgentRuntime {
  private config: AgentRuntimeConfig;
  private toolkit!: Toolkit;
  private contextManager!: ContextManager;
  private providerManager: ProviderManager;
  private conversationManager!: ConversationManager;
  private sessions = new Map<string, SessionState>();
  private tools: AgentTool[] = [];
  private mcpManager: MCPClientManager;
  private mcpTools: AgentTool[] = [];

  // --- Memory ---
  private memoryManager!: MemoryManager;

  // --- Knowledge Base ---
  private knowledgeBase: KnowledgeBaseItem[] = [];

  // --- Installed Skills ---
  private installedSkills: SkillDefinition[] = [];

  // --- Global System Prompt ---
  private globalSystemPrompt = "";

  // --- Tool Permissions ---
  private toolPermissions: ToolPermissions = { ...DEFAULT_TOOL_PERMISSIONS };
  private permissionsFilePath!: string;

  // --- Scheduled Tasks ---
  private schedulerManager: ScheduledTaskManager;
  private schedulerTools: AgentTool[] = [];
  private schedulerPersistFn: ((tasks: ScheduledTask[]) => void) | null = null;

  // --- Session Completion ---
  private sessionCompletionHandler:
    | ((conversationId: string, status: SessionStatus) => void)
    | null = null;

  constructor(config: AgentRuntimeConfig) {
    this.config = config;
    this.providerManager = new ProviderManager();
    this.mcpManager = new MCPClientManager();
    this.mcpManager.setToolsChangedHandler(() => this.rebuildMcpTools());
    this.schedulerManager = new ScheduledTaskManager();
    this.schedulerManager.setWorkspacePath(config.workspacePath);
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
      enableSummarization: true,
    });

    // 6. Initialize Conversation Store
    const store = new JsonFileStore(this.config.dataPath);
    await store.initialize();
    this.conversationManager = new ConversationManager(store);

    // 7. Load tool permissions
    this.permissionsFilePath = join(this.config.dataPath, "..", "tool-permissions.json");
    this.loadToolPermissions();

    // 8. Initialize Memory Manager
    this.memoryManager = new MemoryManager(join(this.config.dataPath, ".."));
    await this.memoryManager.initialize();

    // 9. Register scheduler tool handlers and build tools
    this.rebuildSchedulerTools();

    // Connect scheduler to runtime for prompt-type tasks
    this.schedulerManager.setSendMessageFn((convId, content) => this.sendMessage(convId, content));
    this.schedulerManager.setCreateConversationFn((title) => this.createConversation(title));
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
    await this.conversationManager.deleteConversation(id);
    // Clean up associated memories
    await this.cleanupMemoriesForConversation(id).catch((err) => {
      console.error(`[AgentRuntime] Failed to clean up memories for ${id}:`, err);
    });
  }

  async getMessages(conversationId: string): Promise<MessageData[]> {
    return this.conversationManager.getMessages(conversationId);
  }

  async getActiveMessages(conversationId: string): Promise<MessageData[]> {
    return this.conversationManager.getActiveMessages(conversationId);
  }

  async switchBranch(conversationId: string, targetMessageId: string): Promise<void> {
    return this.conversationManager.switchBranch(conversationId, targetMessageId);
  }

  async getBranchInfo(conversationId: string): Promise<BranchInfo> {
    return this.conversationManager.getBranchInfo(conversationId);
  }

  /**
   * Regenerate: re-run the agent from the user message that precedes the
   * given assistant message, creating a new branch.
   */
  async regenerateMessage(
    conversationId: string,
    assistantMessageId: string,
  ): Promise<{ started: boolean }> {
    // Wait for any pending persistence flush to complete before reading messages
    const prevSession = this.sessions.get(conversationId);
    if (prevSession?.flushPromise) {
      await prevSession.flushPromise;
    }

    // Load the active path to find the user message before this assistant
    const activeMessages = await this.conversationManager.getActiveMessages(conversationId);
    const assistantIdx = activeMessages.findIndex((m) => m.id === assistantMessageId);
    if (assistantIdx < 0) {
      console.warn(
        `[AgentRuntime] regenerate: assistant message ${assistantMessageId} not found in active messages`,
      );
      return { started: false };
    }

    // Walk backwards to find the preceding user message
    let userMessage: MessageData | undefined;
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (activeMessages[i]!.role === "user" && activeMessages[i]!.content) {
        userMessage = activeMessages[i];
        break;
      }
    }
    if (!userMessage?.content) {
      console.warn(`[AgentRuntime] regenerate: no preceding user message found`);
      return { started: false };
    }

    // Truncate history to just before the user message that will be re-sent
    const userIdx = activeMessages.indexOf(userMessage);
    const truncatedMessages = activeMessages.slice(0, userIdx);

    // Now run a new agent session with the truncated history + user message
    const streamFn = this.providerManager.createStreamFn();
    const model = this.providerManager.getDefaultModel();

    const sanitized = sanitizeMessages(truncatedMessages);
    const agentMessages = sanitized.map((m) => toAgentMessage(m, this.config.dataPath));
    agentMessages.push({ role: "user", content: userMessage.content });

    // The user message already exists in the tree — we just create a new
    // assistant child branch off it. Use the existing user message ID.
    const userMsgId = userMessage.id ?? randomUUID();

    // Build system prompt (same logic as sendMessage)
    const capabilities = this.config.capabilities ?? this.toolkit.getAllCapabilityIds();
    const regenSubAgentDefs = this.buildSubAgentTools([], streamFn, model);
    const allTools = [
      ...this.tools,
      ...this.mcpTools,
      ...this.schedulerTools,
      ...regenSubAgentDefs,
    ];
    const toolSummary = allTools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
    const promptVars: Record<string, unknown> = {
      tool_names: allTools.map((t) => t.name).join(", "),
      tool_summary: toolSummary,
    };
    let systemPrompt = this.toolkit.composePrompt(capabilities, promptVars);
    if (systemPrompt.length < 100) {
      systemPrompt = FALLBACK_SYSTEM_PROMPT + (systemPrompt ? "\n\n" + systemPrompt : "");
    }

    const convData = await this.conversationManager.getConversation(conversationId);
    const customPrompt = convData?.systemPrompt || this.globalSystemPrompt;
    if (customPrompt) {
      systemPrompt += "\n\n## Custom Instructions\n" + customPrompt;
    }

    const kbContext = this.buildKnowledgeBaseContext();
    if (kbContext) {
      systemPrompt += "\n\n" + kbContext;
    }

    const enabledSkillIds = convData?.enabledSkills ?? [];
    const skillsContext = this.buildSkillsContext(enabledSkillIds);
    if (skillsContext) {
      systemPrompt += "\n\n" + skillsContext;
    }

    // Inject cross-session memory context (filtered by current conversation relevance)
    const regenMemoryCtx = [
      ...truncatedMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage.content },
    ];
    const memoryContext = await this.memoryManager.buildMemoryContext(regenMemoryCtx);
    if (memoryContext) {
      systemPrompt += "\n\n" + memoryContext;
    }

    // Create session
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
      lastEmittedMessageId: userMsgId,
      triggerUserMessageId: userMsgId,
      flushPromise: null,
      deliveredUpTo: 0,
    };

    // Abort any existing session
    const existingSession = this.sessions.get(conversationId);
    if (existingSession) {
      existingSession.runner.abort();
      if (existingSession.cleanupTimer) clearTimeout(existingSession.cleanupTimer);
    }

    this.sessions.set(conversationId, session);

    const baseTools = [...this.tools, ...this.mcpTools, ...this.schedulerTools].map((tool) =>
      this.wrapToolWithSessionPermissions(tool, session),
    );
    const subAgentTools = this.buildSubAgentTools(baseTools, streamFn, model);
    const sessionTools = [...baseTools, ...subAgentTools];

    const contextMiddleware = createContextMiddleware(this.contextManager, {
      conversationId,
      streamFn,
      model,
    });

    this.runSession(session, agentMessages, {
      model,
      systemPrompt,
      tools: sessionTools,
      streamFn,
      middleware: [contextMiddleware],
    }).catch((err) => {
      console.error(`[AgentRuntime] Regenerate session ${conversationId} failed:`, err);
    });

    return { started: true };
  }

  async updateConversationTitle(id: string, title: string): Promise<ConversationData> {
    return this.conversationManager.updateTitle(id, title);
  }

  // ---------------------------------------------------------------------------
  // Provider management
  // ---------------------------------------------------------------------------

  setProviderConfig(config: ProviderConfig): void {
    this.providerManager.setProvider(config);
  }

  removeProvider(id: string): void {
    this.providerManager.removeProvider(id);
  }

  setActiveProvider(id: string): void {
    this.providerManager.setActiveProvider(id);
  }

  getProviderConfigs(): ProviderConfig[] {
    return this.providerManager.getProviderConfigs();
  }

  // ---------------------------------------------------------------------------
  // Knowledge Base management
  // ---------------------------------------------------------------------------

  setKnowledgeBase(items: KnowledgeBaseItem[]): void {
    this.knowledgeBase = items;
  }

  getKnowledgeBase(): KnowledgeBaseItem[] {
    return this.knowledgeBase;
  }

  // ---------------------------------------------------------------------------
  // MCP Server management
  // ---------------------------------------------------------------------------

  async setMCPConfigs(configs: MCPServerConfig[]): Promise<void> {
    await this.mcpManager.applyConfigs(configs);
  }

  getMCPServerStates(): MCPServerState[] {
    return this.mcpManager.getServerStates();
  }

  setMCPStatusHandler(handler: (states: MCPServerState[]) => void): void {
    this.mcpManager.setStatusChangeHandler(handler);
  }

  private rebuildMcpTools(): void {
    this.mcpTools = this.mcpManager.buildTools();
    console.error(`[AgentRuntime] MCP tools rebuilt: ${this.mcpTools.length} tools available`);
  }

  async shutdown(): Promise<void> {
    this.schedulerManager.stop();
    await this.mcpManager.disconnectAll();
  }

  // ---------------------------------------------------------------------------
  // Scheduled Tasks management
  // ---------------------------------------------------------------------------

  getScheduledTaskManager(): ScheduledTaskManager {
    return this.schedulerManager;
  }

  setSchedulerPersistFn(fn: (tasks: ScheduledTask[]) => void): void {
    this.schedulerPersistFn = fn;
    this.rebuildSchedulerTools();
  }

  setScheduledTasks(tasks: ScheduledTask[]): void {
    this.schedulerManager.setTasks(tasks);
  }

  setSchedulerStatusHandler(handler: (update: ScheduledTaskStatusUpdate) => void): void {
    this.schedulerManager.setStatusHandler(handler);
  }

  startScheduler(): void {
    this.schedulerManager.start();
  }

  setSessionCompletionHandler(
    handler: (conversationId: string, status: SessionStatus) => void,
  ): void {
    this.sessionCompletionHandler = handler;
  }

  private conversationMetadataUpdatedHandler: ((conversationId: string) => void) | null = null;

  /** Prevents concurrent/duplicate title generation for the same conversation */
  private titleGenerationInFlight = new Set<string>();

  setConversationMetadataUpdatedHandler(handler: (conversationId: string) => void): void {
    this.conversationMetadataUpdatedHandler = handler;
  }

  private rebuildSchedulerTools(): void {
    const persistFn = this.schedulerPersistFn ?? (() => {});
    const handlers = createSchedulerToolHandlers(this.schedulerManager, persistFn);
    // Build AgentTool objects from the handler definitions
    this.schedulerTools = handlers.map((h) => ({
      name: h.name,
      description: h.description ?? "",
      parameters: h.parameters as AgentTool["parameters"],
      execute: (args: Record<string, unknown>, _ctx: { signal: AbortSignal }) =>
        h.handler(args) as ReturnType<AgentTool["execute"]>,
    }));
    console.error(`[AgentRuntime] Scheduler tools rebuilt: ${this.schedulerTools.length} tools`);
  }

  /**
   * Build sub_agent and orchestrate_sub_agents tools bound to the current session.
   * Child agents get all base tools except sub_agent/orchestrate_sub_agents (prevents recursion).
   */
  private buildSubAgentTools(
    baseTools: AgentTool[],
    streamFn: ReturnType<ProviderManager["createStreamFn"]>,
    model: string,
  ): AgentTool[] {
    const childTools = baseTools.filter(
      (t) => t.name !== "sub_agent" && t.name !== "orchestrate_sub_agents",
    );
    const deps = { streamFn, model, tools: childTools };

    const toAgentTool = (handler: ReturnType<typeof createSubAgentTool>): AgentTool => ({
      name: handler.name,
      description: handler.description ?? "",
      parameters: handler.parameters as AgentTool["parameters"],
      category: handler.options?.category,
      timeoutMs: handler.options?.timeoutMs,
      execute: (args, ctx) => handler.handler(args, ctx),
    });

    return [toAgentTool(createSubAgentTool(deps)), toAgentTool(createOrchestratorTool(deps))];
  }

  // ---------------------------------------------------------------------------
  // Installed Skills management
  // ---------------------------------------------------------------------------

  setInstalledSkills(skills: SkillDefinition[]): void {
    this.installedSkills = skills;
  }

  getInstalledSkills(): SkillDefinition[] {
    return this.installedSkills;
  }

  // ---------------------------------------------------------------------------
  // Per-conversation enabled skills
  // ---------------------------------------------------------------------------

  async getConversationEnabledSkills(conversationId: string): Promise<string[]> {
    const data = await this.conversationManager.getConversation(conversationId);
    return data?.enabledSkills ?? [];
  }

  async setConversationEnabledSkills(conversationId: string, skillIds: string[]): Promise<void> {
    const data = await this.conversationManager.getConversation(conversationId);
    if (!data) throw new Error(`Conversation not found: ${conversationId}`);
    data.enabledSkills = skillIds.length > 0 ? skillIds : undefined;
    data.updatedAt = Date.now();
    await this.conversationManager.saveConversation(data);
  }

  // ---------------------------------------------------------------------------
  // Global system prompt
  // ---------------------------------------------------------------------------

  setGlobalSystemPrompt(prompt: string): void {
    this.globalSystemPrompt = prompt;
  }

  getGlobalSystemPrompt(): string {
    return this.globalSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Per-conversation system prompt
  // ---------------------------------------------------------------------------

  async setConversationSystemPrompt(conversationId: string, prompt: string): Promise<void> {
    const data = await this.conversationManager.getConversation(conversationId);
    if (!data) throw new Error(`Conversation not found: ${conversationId}`);
    data.systemPrompt = prompt || undefined;
    data.updatedAt = Date.now();
    await this.conversationManager.saveConversation(data);
  }

  async getConversationSystemPrompt(conversationId: string): Promise<string> {
    const data = await this.conversationManager.getConversation(conversationId);
    return data?.systemPrompt ?? "";
  }

  // ---------------------------------------------------------------------------
  // Per-conversation folder assignment
  // ---------------------------------------------------------------------------

  async setConversationFolder(conversationId: string, folderId: string | null): Promise<void> {
    const data = await this.conversationManager.getConversation(conversationId);
    if (!data) throw new Error(`Conversation not found: ${conversationId}`);
    data.folderId = folderId || undefined;
    data.updatedAt = Date.now();
    await this.conversationManager.saveConversation(data);
  }

  // ---------------------------------------------------------------------------
  // Per-conversation favorite toggle
  // ---------------------------------------------------------------------------

  async setConversationFavorite(conversationId: string, isFavorite: boolean): Promise<void> {
    const data = await this.conversationManager.getConversation(conversationId);
    if (!data) throw new Error(`Conversation not found: ${conversationId}`);
    data.isFavorite = isFavorite || undefined;
    data.updatedAt = Date.now();
    await this.conversationManager.saveConversation(data);
  }

  async setConversationSource(conversationId: string, source: string): Promise<void> {
    const data = await this.conversationManager.getConversation(conversationId);
    if (!data) throw new Error(`Conversation not found: ${conversationId}`);
    data.source = source || undefined;
    data.updatedAt = Date.now();
    await this.conversationManager.saveConversation(data);
  }

  async setConversationChannelKey(conversationId: string, channelKey: string): Promise<void> {
    const data = await this.conversationManager.getConversation(conversationId);
    if (!data) throw new Error(`Conversation not found: ${conversationId}`);
    data.channelKey = channelKey || undefined;
    data.updatedAt = Date.now();
    await this.conversationManager.saveConversation(data);
  }

  // ---------------------------------------------------------------------------
  // Conversation search
  // ---------------------------------------------------------------------------

  async searchConversations(
    query: string,
  ): Promise<Array<ConversationData & { snippet?: string }>> {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    const conversations = await this.conversationManager.listConversations();
    const results: Array<ConversationData & { snippet?: string }> = [];

    for (const conv of conversations) {
      // Title match
      if (conv.title.toLowerCase().includes(lower)) {
        results.push(conv);
        continue;
      }
      // Content match — scan messages
      const messages = await this.conversationManager.getMessages(conv.id);
      for (const msg of messages) {
        if (msg.content && msg.content.toLowerCase().includes(lower)) {
          const idx = msg.content.toLowerCase().indexOf(lower);
          const start = Math.max(0, idx - 40);
          const end = Math.min(msg.content.length, idx + query.length + 40);
          const snippet =
            (start > 0 ? "…" : "") +
            msg.content.slice(start, end) +
            (end < msg.content.length ? "…" : "");
          results.push({ ...conv, snippet });
          break;
        }
      }
    }

    return results;
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
      console.error("[AgentRuntime] Failed to save tool permissions:", err);
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
      if (session.subscriber) {
        session.subscriber(approvalEvent);
        session.deliveredUpTo = session.eventLog.length;
      }
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

    // Replay only events that haven't been delivered yet.
    // deliveredUpTo tracks how far we've sent — this makes subscribe fully
    // idempotent: calling it multiple times never re-delivers the same delta.
    for (let i = session.deliveredUpTo; i < session.eventLog.length; i++) {
      callback(session.eventLog[i]!);
    }
    session.deliveredUpTo = session.eventLog.length;

    // Set / replace the live subscriber
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
  async sendMessage(conversationId: string, content: string | ContentPart[]): Promise<void> {
    const streamFn = this.providerManager.createStreamFn();
    const model = this.providerManager.getDefaultModel();

    // Load active branch messages and sanitize (fix corrupted persisted data)
    const rawMessages = await this.conversationManager.getActiveMessages(conversationId);
    const existingMessages = sanitizeMessages(rawMessages);
    const agentMessages = existingMessages.map((m) => toAgentMessage(m, this.config.dataPath));

    // Append the new user message
    agentMessages.push({ role: "user", content });

    // Debug: log message count (detailed structure only at trace level to avoid noise)
    const contentPreview =
      typeof content === "string"
        ? `"${content.slice(0, 30)}..."`
        : `[${(content as ContentPart[]).length} parts]`;
    console.error(
      `[AgentRuntime] sendMessage: ${agentMessages.length} msgs, new=${contentPreview}`,
    );

    // Extract text and images from content for persistence
    let textContent: string;
    let imageRefs: Array<{ path: string; mimeType: string }> | undefined;
    if (typeof content === "string") {
      textContent = content;
    } else {
      const textParts = content.filter((p) => p.type === "text").map((p) => p.text);
      textContent = textParts.join("\n");
      const imageParts = content.filter((p) => p.type === "image");
      if (imageParts.length > 0) {
        imageRefs = [];
        const imagesDir = join(this.config.dataPath, "..", "images", conversationId);
        mkdirSync(imagesDir, { recursive: true });
        const userMsgIdForImages = randomUUID();
        for (let i = 0; i < imageParts.length; i++) {
          const img = imageParts[i]!;
          const ext =
            img.mimeType === "image/jpeg" ? "jpg" : (img.mimeType?.split("/")[1] ?? "png");
          const fileName = `${userMsgIdForImages}_${i}.${ext}`;
          const filePath = join(imagesDir, fileName);
          writeFileSync(filePath, Buffer.from(img.data!, "base64"));
          imageRefs.push({ path: filePath, mimeType: img.mimeType ?? "image/png" });
        }
      }
    }

    // Assign ID and parentId to the user message
    const userMsgId = randomUUID();
    const lastExisting = existingMessages[existingMessages.length - 1];
    const parentId = lastExisting?.id ?? undefined;

    // Record user message (text content + image references)
    await this.conversationManager.appendMessages(conversationId, [
      {
        id: userMsgId,
        parentId,
        role: "user",
        content: textContent,
        timestamp: Date.now(),
        images: imageRefs,
      },
    ]);

    // Build system prompt
    const capabilities = this.config.capabilities ?? this.toolkit.getAllCapabilityIds();
    const subAgentToolDefs = this.buildSubAgentTools([], streamFn, model); // lightweight ref for metadata
    const allTools = [...this.tools, ...this.mcpTools, ...this.schedulerTools, ...subAgentToolDefs];
    const toolSummary = allTools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
    const promptVars: Record<string, unknown> = {
      tool_names: allTools.map((t) => t.name).join(", "),
      tool_summary: toolSummary,
    };
    let systemPrompt = this.toolkit.composePrompt(capabilities, promptVars);
    if (systemPrompt.length < 100) {
      systemPrompt = FALLBACK_SYSTEM_PROMPT + (systemPrompt ? "\n\n" + systemPrompt : "");
    }

    // Inject custom system prompt (per-conversation takes priority, then global)
    const convData = await this.conversationManager.getConversation(conversationId);
    const customPrompt = convData?.systemPrompt || this.globalSystemPrompt;
    if (customPrompt) {
      systemPrompt += "\n\n## Custom Instructions\n" + customPrompt;
    }

    // Inject Knowledge Base context
    const kbContext = this.buildKnowledgeBaseContext();
    if (kbContext) {
      systemPrompt += "\n\n" + kbContext;
    }

    // Inject Skills context
    const enabledSkillIds = convData?.enabledSkills ?? [];
    const skillsContext = this.buildSkillsContext(enabledSkillIds);
    if (skillsContext) {
      systemPrompt += "\n\n" + skillsContext;
    }

    // Inject cross-session memory context (filtered by current conversation relevance)
    const memoryConversationCtx = [
      ...existingMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: textContent },
    ];
    const memoryContext = await this.memoryManager.buildMemoryContext(memoryConversationCtx);
    if (memoryContext) {
      systemPrompt += "\n\n" + memoryContext;
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
      lastEmittedMessageId: userMsgId,
      triggerUserMessageId: userMsgId,
      flushPromise: null,
      deliveredUpTo: 0,
    };

    // Abort any existing session for this conversation
    const existingSession = this.sessions.get(conversationId);
    if (existingSession) {
      existingSession.runner.abort();
      if (existingSession.cleanupTimer) clearTimeout(existingSession.cleanupTimer);
    }

    this.sessions.set(conversationId, session);

    // Wrap tools with per-session permissions, then add sub_agent tool
    const baseTools = [...this.tools, ...this.mcpTools, ...this.schedulerTools].map((tool) =>
      this.wrapToolWithSessionPermissions(tool, session),
    );
    const subAgentTools = this.buildSubAgentTools(baseTools, streamFn, model);
    const sessionTools = [...baseTools, ...subAgentTools];

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
      console.error(`[AgentRuntime] Session ${conversationId} failed:`, err);
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

    let titleGenerationTriggered = false;

    const onEvent = (event: SerializableAgentEvent) => {
      // Log to event log
      session.eventLog.push(event);

      // Forward to subscriber and advance delivery watermark
      if (session.subscriber) {
        session.subscriber(event);
        session.deliveredUpTo = session.eventLog.length;
      }

      // Incremental persistence
      this.handleIncrementalPersistence(session, event);

      // Start title/icon generation as soon as the first assistant response
      // is complete (turn_end), rather than waiting for the entire agent run.
      // The lock in generateTitleAndIcon prevents duplicates.
      if (!titleGenerationTriggered && event.type === "turn_end") {
        titleGenerationTriggered = true;
        this.generateTitleAndIcon(conversationId, config.model, config.streamFn).catch(() => {});
      }
    };

    try {
      await session.runner.run(
        agentMessages,
        config as Parameters<SessionRunner["run"]>[1],
        conversationId,
        onEvent,
      );

      // Wait for any in-flight flush from handleIncrementalPersistence (agent_end)
      if (session.flushPromise) {
        await session.flushPromise;
      }

      // Final flush of any remaining pending messages
      if (session.pendingMessages.length > 0) {
        await this.conversationManager.appendMessages(conversationId, session.pendingMessages);
        session.pendingMessages = [];
      }

      session.status = "completed";
      this.sessionCompletionHandler?.(conversationId, "completed");

      // Extract and persist cross-session memories (fire-and-forget)
      this.extractAndPersistMemories(conversationId, config.model, config.streamFn).catch((err) => {
        console.error(`[AgentRuntime] Memory extraction failed for ${conversationId}:`, err);
      });

      // Auto-generate title and icon (fire-and-forget, notifies frontend via callback when done)
      this.generateTitleAndIcon(conversationId, config.model, config.streamFn).catch((err) => {
        console.error(`[AgentRuntime] Title/icon generation failed for ${conversationId}:`, err);
      });
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
      this.sessionCompletionHandler?.(conversationId, "error");

      // Emit error event
      const errorEvent: SerializableAgentEvent = {
        type: "error",
        conversationId,
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
        fatal: true,
      };
      session.eventLog.push(errorEvent);
      if (session.subscriber) {
        session.subscriber(errorEvent);
        session.deliveredUpTo = session.eventLog.length;
      }
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
      case "message_end": {
        // Accumulate assistant message with id/parentId
        // Use the event's messageId so it matches the ID the frontend knows
        const msgId = event.messageId;
        session.pendingMessages.push({
          id: msgId,
          parentId: session.lastEmittedMessageId ?? undefined,
          role: "assistant",
          content: event.content,
          timestamp: event.timestamp,
        });
        session.lastEmittedMessageId = msgId;
        break;
      }

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
        // Accumulate tool result message with id/parentId
        const toolMsgId = randomUUID();
        session.pendingMessages.push({
          id: toolMsgId,
          parentId: session.lastEmittedMessageId ?? undefined,
          role: "tool",
          content: event.result.content,
          toolCallId: event.toolCallId,
          isError: event.result.isError,
          timestamp: event.timestamp,
        });
        session.lastEmittedMessageId = toolMsgId;
        break;
      }

      case "turn_end":
      case "agent_end": {
        // Flush all pending messages at the end of a turn (or agent run).
        // This ensures assistant messages contain ALL tool calls from the
        // turn before being written to disk.
        const toFlush = session.pendingMessages.splice(0);
        if (toFlush.length > 0) {
          const flushP = this.conversationManager
            .appendMessages(session.conversationId, toFlush)
            .then(() => {
              // After flushing, update activeBranches to point to the first assistant
              // response in this run (the direct child of the trigger user message).
              if (event.type === "agent_end" && session.triggerUserMessageId) {
                return this.updateActiveBranch(session).catch((err) => {
                  console.error(`[AgentRuntime] Failed to update activeBranches:`, err);
                });
              }
            })
            .catch((err) => {
              console.error(
                `[AgentRuntime] Failed to persist messages for ${session.conversationId}:`,
                err,
              );
            });
          session.flushPromise = flushP.then(() => {
            session.flushPromise = null;
          });
        } else if (event.type === "agent_end" && session.triggerUserMessageId) {
          const branchP = this.updateActiveBranch(session).catch((err) => {
            console.error(`[AgentRuntime] Failed to update activeBranches:`, err);
          });
          session.flushPromise = branchP.then(() => {
            session.flushPromise = null;
          });
        }
        break;
      }
    }
  }

  /**
   * After an agent run completes, update activeBranches to point to the
   * new assistant response (the child of the trigger user message).
   */
  private async updateActiveBranch(session: SessionState): Promise<void> {
    const { conversationId, triggerUserMessageId } = session;
    if (!triggerUserMessageId) return;

    const allMessages = await this.conversationManager.getMessages(conversationId);
    // Find children of the trigger user message
    const children = allMessages.filter((m) => m.parentId === triggerUserMessageId);
    if (children.length <= 1) return; // No branching needed for single child

    // Set the latest child as active
    const latestChild = children[children.length - 1];
    if (!latestChild?.id) return;

    const convData = await this.conversationManager.getConversation(conversationId);
    if (!convData) return;

    if (!convData.activeBranches) convData.activeBranches = {};
    convData.activeBranches[triggerUserMessageId] = latestChild.id;
    convData.updatedAt = Date.now();
    await this.conversationManager.saveConversation(convData);
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

  // ---------------------------------------------------------------------------
  // Skills — build context string from enabled skills
  // ---------------------------------------------------------------------------

  private buildSkillsContext(enabledSkillIds: string[]): string {
    if (enabledSkillIds.length === 0) return "";

    const sections: string[] = [];
    for (const id of enabledSkillIds) {
      const skill = this.installedSkills.find((s) => s.id === id);
      if (skill) {
        sections.push(`### ${skill.title}\n${skill.content}`);
      }
    }

    if (sections.length === 0) return "";
    return `## Active Skills\nThe following skills are enabled for this conversation. Follow their instructions when relevant.\n\n${sections.join("\n\n")}`;
  }

  // ---------------------------------------------------------------------------
  // Knowledge Base — build context string from enabled items
  // ---------------------------------------------------------------------------

  private buildKnowledgeBaseContext(): string {
    const enabledItems = this.knowledgeBase.filter((item) => item.enabled);
    if (enabledItems.length === 0) return "";

    const sections: string[] = [];
    for (const item of enabledItems) {
      let content: string | undefined;
      if (item.type === "text") {
        content = item.content;
      } else if (item.type === "file" && item.filePath) {
        try {
          content = readFileSync(item.filePath, "utf-8");
        } catch {
          console.warn(`[KnowledgeBase] Failed to read file: ${item.filePath}`);
          continue;
        }
      }
      if (content) {
        sections.push(`### ${item.name}\n${content}`);
      }
    }

    if (sections.length === 0) return "";
    return `## Knowledge Base\nThe following knowledge base entries are provided by the user as reference. Use them to inform your responses when relevant.\n\n${sections.join("\n\n")}`;
  }

  // ---------------------------------------------------------------------------
  // Auto-generate title + icon for new conversations
  // ---------------------------------------------------------------------------

  private async generateTitleAndIcon(
    conversationId: string,
    model: string,
    streamFn: ReturnType<ProviderManager["createStreamFn"]>,
  ): Promise<void> {
    // Skip if already generating for this conversation
    if (this.titleGenerationInFlight.has(conversationId)) return;

    const convData = await this.conversationManager.getConversation(conversationId);
    if (!convData) return;
    if (convData.title !== "New Conversation") return;

    const messages = await this.conversationManager.getActiveMessages(conversationId);
    if (messages.length < 2) return;

    const transcript = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
      .map((m) => `${m.role}: ${m.content!.slice(0, 300)}`)
      .slice(0, 6)
      .join("\n");

    if (transcript.length < 10) return;

    this.titleGenerationInFlight.add(conversationId);

    const tool: import("@agentx/agent").LLMToolDefinition = {
      type: "function",
      function: {
        name: "set_conversation_metadata",
        description: "Set the title and SVG icon for a conversation based on its content.",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "A concise conversation title, max 30 characters, no quotes.",
            },
            icon: {
              type: "string",
              description:
                'A minimal SVG icon string with viewBox="0 0 24 24", single path, monochrome using currentColor, no text elements, under 500 bytes. Example: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 ..."/></svg>',
            },
          },
          required: ["title", "icon"],
        },
      },
    };

    const prompt = `Based on this conversation, call the set_conversation_metadata tool with a concise title and a minimal SVG icon.\n\nConversation:\n${transcript}`;

    try {
      let toolArgs = "";
      const stream = streamFn(
        [
          {
            role: "system",
            content:
              "You generate concise titles and minimal SVG icons for conversations. You MUST call the set_conversation_metadata tool.",
          },
          { role: "user", content: prompt },
        ],
        { model, maxTokens: 500, tools: [tool] },
      );
      for await (const chunk of stream) {
        if (chunk.type === "tool_call_delta") {
          toolArgs += chunk.argumentsDelta;
        }
      }

      if (!toolArgs) {
        console.error(`[AgentRuntime] Title/icon generation: model did not call tool`);
        return;
      }

      // Re-check title hasn't been manually changed
      const fresh = await this.conversationManager.getConversation(conversationId);
      if (!fresh || fresh.title !== "New Conversation") return;

      const parsed = JSON.parse(toolArgs) as { title?: string; icon?: string };
      if (parsed.title) {
        await this.conversationManager.updateTitle(conversationId, parsed.title.slice(0, 60));
      }
      if (parsed.icon && parsed.icon.startsWith("<svg") && parsed.icon.length < 2000) {
        // Re-fetch after updateTitle to avoid overwriting the new title
        const updated = await this.conversationManager.getConversation(conversationId);
        if (updated) {
          updated.icon = parsed.icon;
          updated.updatedAt = Date.now();
          await this.conversationManager.saveConversation(updated);
        }
      }
      // Notify frontend immediately
      this.conversationMetadataUpdatedHandler?.(conversationId);
    } catch (err) {
      console.error(`[AgentRuntime] Title/icon generation error:`, err);
    } finally {
      this.titleGenerationInFlight.delete(conversationId);
    }
  }

  // ---------------------------------------------------------------------------
  // Cross-session memory management
  // ---------------------------------------------------------------------------

  /**
   * Extract and persist memories after a conversation completes.
   * Called as fire-and-forget from runSession().
   */
  private async extractAndPersistMemories(
    conversationId: string,
    model: string,
    streamFn: ReturnType<ProviderManager["createStreamFn"]>,
  ): Promise<void> {
    if (!this.memoryManager.isEnabled()) return;

    const convData = await this.conversationManager.getConversation(conversationId);
    if (!convData) return;

    const messages = await this.conversationManager.getActiveMessages(conversationId);
    if (messages.length < 2) return; // need at least a user + assistant exchange

    const simplifiedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const extraction = await this.memoryManager.extractMemories(
      conversationId,
      convData.title,
      simplifiedMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      streamFn as any,
      model,
    );

    if (extraction) {
      await this.memoryManager.processExtraction(conversationId, convData.title, extraction);
      console.error(
        `[AgentRuntime] Memory extracted for ${conversationId}: ${extraction.facts.length} facts`,
      );
    }
  }

  getMemoryConfig(): MemoryConfig {
    return this.memoryManager.getConfig();
  }

  async setMemoryConfig(config: MemoryConfig): Promise<void> {
    await this.memoryManager.setConfig(config);
  }

  async getMemorySummaries(): Promise<ConversationSummary[]> {
    return this.memoryManager.getSummaries();
  }

  async deleteMemorySummary(id: string): Promise<void> {
    return this.memoryManager.deleteSummary(id);
  }

  async getMemoryFacts(): Promise<LearnedFact[]> {
    return this.memoryManager.getFacts();
  }

  async deleteMemoryFact(id: string): Promise<void> {
    return this.memoryManager.deleteFact(id);
  }

  async updateMemoryFact(id: string, content: string): Promise<LearnedFact | null> {
    return this.memoryManager.updateFact(id, content);
  }

  /** Clean up memories when a conversation is deleted */
  async cleanupMemoriesForConversation(conversationId: string): Promise<void> {
    await this.memoryManager.removeSummariesForConversation(conversationId);
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

function toAgentMessage(msg: MessageData, _dataPath?: string): AgentMessage {
  if (msg.role === "user") {
    // Reconstruct ContentPart[] if message has stored images
    if (msg.images && msg.images.length > 0) {
      const parts: ContentPart[] = [];
      if (msg.content) {
        parts.push({ type: "text", text: msg.content });
      }
      for (const img of msg.images) {
        try {
          const data = readFileSync(img.path).toString("base64");
          parts.push({ type: "image", data, mimeType: img.mimeType });
        } catch {
          // Image file missing — skip
        }
      }
      return { role: "user", content: parts.length > 0 ? parts : (msg.content ?? "") };
    }
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
