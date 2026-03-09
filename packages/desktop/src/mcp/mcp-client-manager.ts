import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { AgentTool, AgentToolResult } from "@workspace/agent";
import type { MCPServerConfig, MCPServerState, MCPConnectionStatus } from "../types.js";

// ---------------------------------------------------------------------------
// Internal connection state
// ---------------------------------------------------------------------------

interface MCPConnection {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  status: MCPConnectionStatus;
  error?: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize a server name for use as a tool name prefix (alphanumeric + underscore) */
function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 32);
}

// ---------------------------------------------------------------------------
// MCPClientManager
// ---------------------------------------------------------------------------

export class MCPClientManager {
  private connections = new Map<string, MCPConnection>();
  private onStatusChange: ((states: MCPServerState[]) => void) | null = null;
  private onToolsChanged: (() => void) | null = null;

  setStatusChangeHandler(handler: (states: MCPServerState[]) => void): void {
    this.onStatusChange = handler;
  }

  setToolsChangedHandler(handler: () => void): void {
    this.onToolsChanged = handler;
  }

  /**
   * Apply a set of MCP server configs.
   * - New configs → connect
   * - Removed configs → disconnect
   * - Changed configs → reconnect
   * - Unchanged → skip
   * - Disabled configs → disconnect if connected
   */
  async applyConfigs(configs: MCPServerConfig[]): Promise<void> {
    const desiredIds = new Set(configs.map((c) => c.id));

    // Disconnect removed servers
    for (const [id, conn] of this.connections) {
      if (!desiredIds.has(id)) {
        await this.disconnectServer(id);
        this.connections.delete(id);
      }
    }

    // Connect / reconnect changed servers
    const connectPromises: Promise<void>[] = [];
    for (const config of configs) {
      if (!config.enabled) {
        // Disabled — disconnect if connected
        if (this.connections.has(config.id)) {
          await this.disconnectServer(config.id);
          this.connections.delete(config.id);
        }
        continue;
      }

      const existing = this.connections.get(config.id);
      if (
        existing &&
        this.configUnchanged(existing.config, config) &&
        existing.status === "connected"
      ) {
        continue; // No change
      }

      // Disconnect old connection if exists
      if (existing) {
        await this.disconnectServer(config.id);
      }

      connectPromises.push(this.connectServer(config));
    }

    await Promise.allSettled(connectPromises);
    this.emitStatusChange();
    this.onToolsChanged?.();
  }

  /**
   * Build AgentTool[] from all connected servers' tools.
   */
  buildTools(): AgentTool[] {
    const tools: AgentTool[] = [];

    for (const conn of this.connections.values()) {
      if (conn.status !== "connected") continue;

      const prefix = `mcp_${sanitizeName(conn.config.name)}`;

      for (const mcpTool of conn.tools) {
        const originalName = mcpTool.name;
        const toolName = `${prefix}_${sanitizeName(originalName)}`;
        const client = conn.client;

        tools.push({
          name: toolName,
          description: `[MCP: ${conn.config.name}] ${mcpTool.description || originalName}`,
          parameters: mcpTool.inputSchema ?? { type: "object", properties: {} },
          async execute(args: Record<string, unknown>): Promise<AgentToolResult> {
            try {
              const result = await client.callTool({
                name: originalName,
                arguments: args,
              });

              // Concatenate MCP content array into a single string
              const contentParts = (result.content as Array<{ type: string; text?: string }>) ?? [];
              const text = contentParts
                .map((part) => {
                  if (part.type === "text") return part.text ?? "";
                  return JSON.stringify(part);
                })
                .join("\n");

              return {
                content: text || "(no output)",
                isError: result.isError === true,
              };
            } catch (err) {
              return {
                content: `MCP tool error: ${err instanceof Error ? err.message : String(err)}`,
                isError: true,
              };
            }
          },
        });
      }
    }

    return tools;
  }

  /**
   * Get current state of all servers.
   */
  getServerStates(): MCPServerState[] {
    const states: MCPServerState[] = [];
    for (const conn of this.connections.values()) {
      states.push({
        id: conn.config.id,
        name: conn.config.name,
        status: conn.status,
        toolCount: conn.tools.length,
        error: conn.error,
      });
    }
    return states;
  }

  /**
   * Disconnect all servers. Call on app exit.
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const id of this.connections.keys()) {
      promises.push(this.disconnectServer(id));
    }
    await Promise.allSettled(promises);
    this.connections.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async connectServer(config: MCPServerConfig): Promise<void> {
    const conn: MCPConnection = {
      config,
      client: null!,
      transport: null!,
      status: "connecting",
      tools: [],
    };
    this.connections.set(config.id, conn);

    try {
      // Create transport
      let transport: StdioClientTransport | SSEClientTransport;
      if (config.transport === "stdio") {
        if (!config.command) throw new Error("stdio server requires a command");
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: config.env
            ? ({ ...process.env, ...config.env } as Record<string, string>)
            : undefined,
        });
      } else {
        if (!config.url) throw new Error("SSE server requires a URL");
        transport = new SSEClientTransport(new URL(config.url));
      }

      conn.transport = transport;

      // Create client
      const client = new Client({ name: "agentx-desktop", version: "1.0.0" }, { capabilities: {} });
      conn.client = client;

      // Connect with timeout
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout (30s)")), 30_000),
        ),
      ]);

      // List tools
      const result = await client.listTools();
      conn.tools = (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      }));

      conn.status = "connected";
      conn.error = undefined;
      console.log(`[MCP] Connected to "${config.name}" — ${conn.tools.length} tools available`);
    } catch (err) {
      conn.status = "error";
      conn.error = err instanceof Error ? err.message : String(err);
      console.error(`[MCP] Failed to connect to "${config.name}":`, conn.error);
    }
  }

  private async disconnectServer(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;

    try {
      await conn.client?.close();
    } catch {
      // Ignore close errors
    }

    try {
      await conn.transport?.close();
    } catch {
      // Ignore close errors
    }

    conn.status = "disconnected";
    conn.tools = [];
  }

  private configUnchanged(a: MCPServerConfig, b: MCPServerConfig): boolean {
    return (
      a.transport === b.transport &&
      a.command === b.command &&
      a.url === b.url &&
      JSON.stringify(a.args) === JSON.stringify(b.args) &&
      JSON.stringify(a.env) === JSON.stringify(b.env) &&
      a.enabled === b.enabled
    );
  }

  private emitStatusChange(): void {
    this.onStatusChange?.(this.getServerStates());
  }
}
