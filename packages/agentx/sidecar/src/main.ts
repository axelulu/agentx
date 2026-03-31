/**
 * AgentX Sidecar — JSON-RPC 2.0 wrapper around AgentRuntime
 *
 * Communication: newline-delimited JSON-RPC over stdin/stdout
 *
 * Request:  {"jsonrpc":"2.0","id":1,"method":"conversation:create","params":["My Chat"]}
 * Response: {"jsonrpc":"2.0","id":1,"result":{...}}
 * Push:     {"jsonrpc":"2.0","method":"agent:event","params":[{...}]}
 */

// Redirect console.log to stderr so stdout stays clean for JSON-RPC.
// Runtime code (and third-party libraries) use console.log for debug output;
// without this, those lines pollute the JSON-RPC channel and cause parse errors
// on the Rust side.
const _origLog = console.log;
console.log = (...args: unknown[]) => {
  console.error(...args);
};

import { createInterface } from "readline";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { AgentRuntime } from "@agentx/runtime";
import { PtyManager } from "./pty";
import { readJsonFile } from "./stores";
import type { HandlerMap } from "./handlers";
import {
  createProviderStore,
  registerProviderHandlers,
  createKBStore,
  registerKBHandlers,
  createSkillsStore,
  registerSkillsHandlers,
  createMCPStore,
  registerMCPHandlers,
  createSchedulerStore,
  registerSchedulerHandlers,
  setupSchedulerCallbacks,
  createChannelManager,
  createChannelStore,
  registerChannelHandlers,
  createPreferencesStore,
  registerPreferencesHandlers,
  createToolPermissionsStore,
  registerToolPermissionsHandlers,
  registerConversationHandlers,
  registerVoiceHandlers,
  registerScreenHandlers,
  registerAIActionHandlers,
  createNIPolling,
  registerNotificationHandlers,
  NI_DEFAULT_CONFIG,
} from "./handlers";
import type { ChannelConfig } from "@agentx/runtime";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { dataDir: string; toolkitPath: string; workspacePath: string } {
  const args = process.argv.slice(2);
  let dataDir = "";
  let toolkitPath = "";
  let workspacePath = homedir();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data-dir" && args[i + 1]) {
      dataDir = args[++i]!;
    } else if (args[i] === "--toolkit-path" && args[i + 1]) {
      toolkitPath = args[++i]!;
    } else if (args[i] === "--workspace-path" && args[i + 1]) {
      workspacePath = args[++i]!;
    }
  }

  if (!dataDir) {
    dataDir = join(homedir(), ".agentx");
  }
  if (!toolkitPath) {
    toolkitPath = join(process.cwd(), "resources", "toolkit");
  }

  return { dataDir, toolkitPath, workspacePath };
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function sendResponse(id: number | string, result: unknown): void {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result: result ?? null });
  process.stdout.write(msg + "\n");
}

function sendError(id: number | string | null, code: number, message: string): void {
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  process.stdout.write(msg + "\n");
}

function pushNotification(method: string, params: unknown): void {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  process.stdout.write(msg + "\n");
}

// ---------------------------------------------------------------------------
// Proxy support
// ---------------------------------------------------------------------------

function applyProxy(url: string | null): void {
  if (url) {
    process.env.HTTPS_PROXY = url;
    process.env.HTTP_PROXY = url;
  } else {
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici");
    const { setGlobalDispatcher, ProxyAgent, Agent } = undici;
    if (url) {
      setGlobalDispatcher(new ProxyAgent(url));
      console.error("[Sidecar/Proxy] Enabled:", url);
    } else {
      setGlobalDispatcher(new Agent());
      console.error("[Sidecar/Proxy] Disabled");
    }
  } catch {
    console.error("[Sidecar/Proxy] undici not available");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { dataDir, toolkitPath, workspacePath } = parseArgs();

  console.error(`[Sidecar] Starting with dataDir=${dataDir} toolkitPath=${toolkitPath}`);

  // Ensure data directory exists
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(join(dataDir, "conversations"), { recursive: true });

  // Read preferences
  const prefsPath = join(dataDir, "preferences.json");
  const savedPrefs = readJsonFile<Record<string, string>>(prefsPath, {});

  const resolvedDataDir = savedPrefs.dataPath || dataDir;
  const resolvedWorkspace = savedPrefs.workspacePath || workspacePath;

  if (resolvedDataDir !== dataDir) {
    mkdirSync(resolvedDataDir, { recursive: true });
  }

  // Initialize runtime
  const runtime = new AgentRuntime({
    toolkitPath,
    language: "en",
    workspacePath: resolvedWorkspace,
    dataPath: join(resolvedDataDir, "conversations"),
  });

  try {
    await runtime.initialize();
    console.error("[Sidecar] Runtime initialized successfully");
  } catch (err) {
    console.error("[Sidecar] Runtime initialization failed:", err);
  }

  // ---------------------------------------------------------------------------
  // Data file paths
  // ---------------------------------------------------------------------------

  const providersPath = join(resolvedDataDir, "providers.json");
  const kbPath = join(resolvedDataDir, "knowledgebase.json");
  const skillsPath = join(resolvedDataDir, "skills.json");
  const mcpPath = join(resolvedDataDir, "mcpservers.json");
  const schedulerPath = join(resolvedDataDir, "scheduled-tasks.json");
  const channelsPath = join(resolvedDataDir, "channels.json");
  const channelConversationsPath = join(resolvedDataDir, "channel-conversations.json");
  const toolPermsPath = join(resolvedDataDir, "tool-permissions.json");
  const niConfigPath = join(resolvedDataDir, "ni-config.json");
  const niReadIdsPath = join(resolvedDataDir, "ni-read-ids.json");

  // ---------------------------------------------------------------------------
  // Create stores
  // ---------------------------------------------------------------------------

  const providerStore = createProviderStore(providersPath, pushNotification, runtime);
  const kbStore = createKBStore(kbPath, pushNotification, runtime);
  const skillsStore = createSkillsStore(skillsPath, pushNotification, runtime);
  const mcpStore = createMCPStore(mcpPath, pushNotification, runtime);
  const schedulerStore = createSchedulerStore(schedulerPath, pushNotification);
  const channelStore = createChannelStore(channelsPath, pushNotification);
  const preferencesStore = createPreferencesStore(prefsPath, pushNotification);
  const toolPermsStore = createToolPermissionsStore(toolPermsPath, pushNotification, runtime);

  // ---------------------------------------------------------------------------
  // Restore persisted data
  // ---------------------------------------------------------------------------

  // Proxy
  if (typeof savedPrefs.proxyUrl === "string" && savedPrefs.proxyUrl) {
    applyProxy(savedPrefs.proxyUrl);
  }

  // Providers
  const savedProviders = providerStore.load();
  for (const config of savedProviders) {
    runtime.setProviderConfig(config);
  }
  const activeProvider = savedProviders.find((p) => p.isActive);
  if (activeProvider) {
    runtime.setActiveProvider(activeProvider.id);
  }

  // Knowledge base
  const savedKB = kbStore.load();
  runtime.setKnowledgeBase(savedKB);

  // Skills
  const savedSkills = skillsStore.load();
  runtime.setInstalledSkills(savedSkills);

  // Global system prompt
  if (typeof savedPrefs.globalSystemPrompt === "string") {
    runtime.setGlobalSystemPrompt(savedPrefs.globalSystemPrompt);
  }

  // MCP servers
  const savedMCP = mcpStore.load();
  runtime.setMCPConfigs(savedMCP).catch((err) => {
    console.error("[Sidecar/MCP] Failed to initialize:", err);
  });

  runtime.setMCPStatusHandler((states) => {
    pushNotification("mcp:statusUpdate", states);
  });

  // Channels
  const channelManager = createChannelManager(
    runtime,
    channelsPath,
    channelConversationsPath,
    pushNotification,
  );

  const savedChannels = readJsonFile<ChannelConfig[]>(channelsPath, []);
  if (savedChannels.length > 0) {
    channelManager.setConfigs(savedChannels).catch((err) => {
      console.error("[Sidecar/Channels] Failed to restore:", err);
    });
  }

  // Scheduler
  const savedTasks = schedulerStore.load();
  setupSchedulerCallbacks(runtime, schedulerPath, pushNotification, savedTasks);
  runtime.setScheduledTasks(savedTasks);
  runtime.startScheduler();

  // Wire agent completion notifications
  runtime.setSessionCompletionHandler((conversationId) => {
    pushNotification("notification:show", {
      title: "Agent Finished",
      body: "Response ready",
    });
    pushNotification("notification:navigateToConversation", conversationId);
  });

  // Wire conversation metadata updated (title/icon auto-generated)
  runtime.setConversationMetadataUpdatedHandler((conversationId) => {
    pushNotification("conversation:metadataUpdated", { conversationId });
  });

  // Notification Intelligence
  const niPolling = createNIPolling(niConfigPath, niReadIdsPath, providersPath, pushNotification);
  const savedNIConfig = readJsonFile(niConfigPath, NI_DEFAULT_CONFIG);
  if (savedNIConfig.enabled) {
    niPolling.start();
  }

  // PTY manager
  const ptyManager = new PtyManager(pushNotification);

  // ---------------------------------------------------------------------------
  // Register all handlers
  // ---------------------------------------------------------------------------

  const handlers: HandlerMap = {};

  registerConversationHandlers(handlers, runtime, pushNotification);
  registerProviderHandlers(handlers, providerStore, runtime);
  registerKBHandlers(handlers, kbStore);
  registerSkillsHandlers(handlers, skillsStore, runtime);
  registerMCPHandlers(handlers, mcpStore, runtime);
  registerSchedulerHandlers(handlers, schedulerStore, runtime);
  registerChannelHandlers(handlers, channelStore, channelManager);
  registerPreferencesHandlers(handlers, preferencesStore, runtime, applyProxy);
  registerToolPermissionsHandlers(handlers, toolPermsStore);
  registerVoiceHandlers(handlers, prefsPath, providersPath);
  registerScreenHandlers(handlers);
  registerAIActionHandlers(handlers, providersPath);
  registerNotificationHandlers(handlers, niConfigPath, niReadIdsPath, providersPath, niPolling);

  // Proxy
  handlers["proxy:apply"] = (url: string | null) => {
    applyProxy(url || null);
  };

  // Terminal PTY
  handlers["terminal:create"] = (sessionId: string, cols: number, rows: number, cwd?: string) => {
    ptyManager.create(sessionId, cols, rows, cwd);
  };
  handlers["terminal:write"] = (sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  };
  handlers["terminal:resize"] = (sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows);
  };
  handlers["terminal:destroy"] = (sessionId: string) => {
    ptyManager.destroy(sessionId);
  };

  // ---------------------------------------------------------------------------
  // stdin JSON-RPC reader
  // ---------------------------------------------------------------------------

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on("line", async (line: string) => {
    line = line.trim();
    if (!line) return;

    let parsed: { jsonrpc?: string; id?: number | string; method?: string; params?: unknown };
    try {
      parsed = JSON.parse(line);
    } catch {
      sendError(null, -32700, "Parse error");
      return;
    }

    const { id, method, params } = parsed;

    if (!method) {
      if (id !== undefined) sendError(id, -32600, "Invalid request: missing method");
      return;
    }

    const handler = handlers[method];
    if (!handler) {
      if (id !== undefined) sendError(id, -32601, `Method not found: ${method}`);
      return;
    }

    try {
      const args = Array.isArray(params) ? params : params ? [params] : [];
      const result = await handler(...args);

      if (id !== undefined) {
        sendResponse(id, result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (id !== undefined) {
        sendError(id, -32000, message);
      } else {
        console.error(`[Sidecar] Error in notification handler ${method}:`, message);
      }
    }
  });

  rl.on("close", async () => {
    console.error("[Sidecar] stdin closed, shutting down...");
    try {
      ptyManager.destroyAll();
      await channelManager.shutdown();
      await runtime?.shutdown();
    } catch (err) {
      console.error("[Sidecar] Shutdown error:", err);
    }
    process.exit(0);
  });

  console.error("[Sidecar] Ready, listening on stdin");

  // Notify the Rust host that we are fully initialized and accepting requests.
  pushNotification("sidecar:initialized", {});
}

main().catch((err) => {
  console.error("[Sidecar] Fatal error:", err);
  process.exit(1);
});
