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
  ToolPermissions,
} from "./types.js";

/**
 * DesktopRuntime — main facade for the desktop agent system.
 *
 * Composes agent + brain + tools + context into a single API surface
 * that Electron IPC handlers can call. This class itself has no
 * Electron dependency — IPC wiring is done in apps/agentx.
 */
export class DesktopRuntime {
  private config: DesktopRuntimeConfig;
  private toolkit!: Toolkit;
  private contextManager!: ContextManager;
  private providerManager: ProviderManager;
  private conversationManager!: ConversationManager;
  private sessions = new Map<string, SessionRunner>();
  private tools: AgentTool[] = [];

  // --- Tool Permissions ---
  private toolPermissions: ToolPermissions = { ...DEFAULT_TOOL_PERMISSIONS };
  private permissionsFilePath!: string;

  // --- Tool Approval ---
  private pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>();
  private activeOnEvent: ((event: SerializableAgentEvent) => void) | null = null;

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

    // 4. Wrap tools with permission enforcement
    this.tools = rawTools.map((tool) => this.wrapToolWithPermissions(tool));

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
    // Abort any running session
    this.sessions.get(id)?.abort();
    this.sessions.delete(id);
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

  /**
   * Wrap a tool with permission enforcement.
   * Checks if the tool is allowed and if user approval is needed.
   */
  private wrapToolWithPermissions(tool: AgentTool): AgentTool {
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

        if (needsApproval && category !== "none") {
          const approved = await runtime.requestToolApproval(tool.name, args);
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
   * Request user approval for a tool execution.
   * Sends an event to the renderer and waits for the response.
   */
  private requestToolApproval(toolName: string, args: Record<string, unknown>): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      this.pendingApprovals.set(approvalId, { resolve });

      // Emit approval request to renderer
      this.activeOnEvent?.({
        type: "tool_approval_request",
        approvalId,
        toolName,
        arguments: args,
        timestamp: Date.now(),
      });

      // If no active event callback (shouldn't happen), auto-approve
      if (!this.activeOnEvent) {
        this.pendingApprovals.delete(approvalId);
        resolve(true);
      }
    });
  }

  /**
   * Resolve a pending tool approval (called from IPC handler).
   */
  resolveToolApproval(approvalId: string, approved: boolean): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (pending) {
      pending.resolve(approved);
      this.pendingApprovals.delete(approvalId);
    }
  }

  // ---------------------------------------------------------------------------
  // Agent execution
  // ---------------------------------------------------------------------------

  /**
   * Send a user message and run the agent loop.
   * Events are delivered via the onEvent callback (suitable for IPC push).
   */
  async sendMessage(
    conversationId: string,
    content: string,
    onEvent: (event: SerializableAgentEvent) => void,
  ): Promise<void> {
    const streamFn = this.providerManager.createStreamFn();
    const model = this.providerManager.getDefaultModel();

    // Load existing messages
    const existingMessages = await this.conversationManager.getMessages(conversationId);
    const agentMessages = existingMessages.map(toAgentMessage);

    // Append the new user message
    agentMessages.push({ role: "user", content });

    // Record user message
    await this.conversationManager.appendMessages(conversationId, [
      { role: "user", content, timestamp: Date.now() },
    ]);

    // Build system prompt
    const capabilities = this.config.capabilities ?? this.toolkit.getAllCapabilityIds();

    // Pass available tool names/descriptions into prompt variables
    const toolSummary = this.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
    const promptVars: Record<string, unknown> = {
      tool_names: this.tools.map((t) => t.name).join(", "),
      tool_summary: toolSummary,
    };

    let systemPrompt = this.toolkit.composePrompt(capabilities, promptVars);

    // Fallback: if composed prompt is too short, the YAML is likely missing
    if (systemPrompt.length < 100) {
      systemPrompt = FALLBACK_SYSTEM_PROMPT + (systemPrompt ? "\n\n" + systemPrompt : "");
    }

    // Create session
    const runner = new SessionRunner();
    this.sessions.set(conversationId, runner);

    const contextMiddleware = createContextMiddleware(this.contextManager, {
      conversationId,
      streamFn,
      model,
    });

    // Set active event callback for tool approval flow
    this.activeOnEvent = onEvent;

    try {
      const resultMessages = await runner.run(
        agentMessages,
        {
          model,
          systemPrompt,
          tools: this.tools,
          streamFn,
          middleware: [contextMiddleware],
        },
        onEvent,
      );

      // Persist new messages (everything after our input messages)
      const newMessages = resultMessages.slice(agentMessages.length);
      if (newMessages.length > 0) {
        await this.conversationManager.appendMessages(
          conversationId,
          newMessages.map(toMessageData),
        );
      }
    } finally {
      this.sessions.delete(conversationId);
      this.activeOnEvent = null;
      // Cancel any pending approvals
      for (const [id, pending] of this.pendingApprovals) {
        pending.resolve(false);
      }
      this.pendingApprovals.clear();
    }
  }

  /**
   * Abort a running agent session.
   */
  abort(conversationId: string): void {
    this.sessions.get(conversationId)?.abort();
    // Cancel any pending approvals on abort
    for (const [, pending] of this.pendingApprovals) {
      pending.resolve(false);
    }
    this.pendingApprovals.clear();
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
    content: msg.content,
    toolCalls: msg.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
  };
}

function toMessageData(msg: AgentMessage): MessageData {
  const base = { timestamp: Date.now() };

  if (msg.role === "user") {
    return {
      ...base,
      role: "user",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    };
  }
  if (msg.role === "tool") {
    return {
      ...base,
      role: "tool",
      content: msg.content,
      toolCallId: msg.toolCallId,
      isError: msg.isError,
    };
  }
  // assistant
  return {
    ...base,
    role: "assistant",
    content: msg.content,
    toolCalls: msg.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
  };
}
