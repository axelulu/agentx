/**
 * AgentX Sidecar — JSON-RPC 2.0 wrapper around DesktopRuntime
 *
 * Communication: newline-delimited JSON-RPC over stdin/stdout
 *
 * Request:  {"jsonrpc":"2.0","id":1,"method":"conversation:create","params":["My Chat"]}
 * Response: {"jsonrpc":"2.0","id":1,"result":{...}}
 * Push:     {"jsonrpc":"2.0","method":"agent:event","params":[{...}]}
 */

import { createInterface } from "readline";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { execFile } from "child_process";
import { DesktopRuntime } from "@workspace/desktop";
import type {
  DesktopProviderConfig,
  KnowledgeBaseItem,
  MCPServerConfig,
  SkillDefinition,
  ToolPermissions,
  ScheduledTask,
} from "@workspace/desktop";
import { searchSkills } from "@workspace/desktop";

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
// JSON helpers
// ---------------------------------------------------------------------------

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // corrupted
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
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
  // Dynamic import to avoid bundling issues
  try {
    const { setGlobalDispatcher, ProxyAgent, Agent } = require("undici");
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

  const conversationsDir = join(dataDir, "conversations");
  mkdirSync(conversationsDir, { recursive: true });

  // Read preferences
  const prefsPath = join(dataDir, "preferences.json");
  const savedPrefs = readJsonFile<Record<string, string>>(prefsPath, {});

  const resolvedDataDir = savedPrefs.dataPath || dataDir;
  const resolvedWorkspace = savedPrefs.workspacePath || workspacePath;

  // Initialize runtime
  const runtime = new DesktopRuntime({
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

  // Restore proxy
  if (typeof savedPrefs.proxyUrl === "string" && savedPrefs.proxyUrl) {
    applyProxy(savedPrefs.proxyUrl);
  }

  // Restore providers
  const providersPath = join(resolvedDataDir, "providers.json");
  const savedProviders = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
  for (const config of savedProviders) {
    runtime.setProviderConfig(config);
  }
  const activeProvider = savedProviders.find((p) => p.isActive);
  if (activeProvider) {
    runtime.setActiveProvider(activeProvider.id);
  }

  // Restore knowledge base
  const kbPath = join(resolvedDataDir, "knowledgebase.json");
  const savedKB = readJsonFile<KnowledgeBaseItem[]>(kbPath, []);
  runtime.setKnowledgeBase(savedKB);

  // Restore skills
  const skillsPath = join(resolvedDataDir, "skills.json");
  const savedSkills = readJsonFile<SkillDefinition[]>(skillsPath, []);
  runtime.setInstalledSkills(savedSkills);

  // Restore global system prompt
  if (typeof savedPrefs.globalSystemPrompt === "string") {
    runtime.setGlobalSystemPrompt(savedPrefs.globalSystemPrompt);
  }

  // Restore MCP servers
  const mcpPath = join(resolvedDataDir, "mcpservers.json");
  const savedMCP = readJsonFile<MCPServerConfig[]>(mcpPath, []);
  runtime.setMCPConfigs(savedMCP).catch((err) => {
    console.error("[Sidecar/MCP] Failed to initialize:", err);
  });

  // Forward MCP status updates
  runtime.setMCPStatusHandler((states) => {
    pushNotification("mcp:statusUpdate", states);
  });

  // Restore scheduled tasks
  const schedulerPath = join(resolvedDataDir, "scheduled-tasks.json");
  const savedTasks = readJsonFile<ScheduledTask[]>(schedulerPath, []);
  runtime.setSchedulerPersistFn((tasks) => {
    writeJsonFile(schedulerPath, tasks);
  });
  runtime.setScheduledTasks(savedTasks);

  const taskLastRunAt = new Map<string, number>();
  for (const t of savedTasks) {
    if (t.lastRunAt) taskLastRunAt.set(t.id, t.lastRunAt);
  }

  runtime.setSchedulerStatusHandler((update) => {
    writeJsonFile(schedulerPath, update.tasks);
    pushNotification("scheduler:statusUpdate", update.tasks);

    for (const task of update.tasks) {
      if (task.lastRunAt) {
        const prev = taskLastRunAt.get(task.id);
        if (prev !== undefined && prev !== task.lastRunAt) {
          pushNotification("notification:show", {
            title: task.lastRunError ? `❌ ${task.title}` : `✅ ${task.title}`,
            body: (task.lastRunError ?? task.lastRunResult ?? "Completed").slice(0, 120),
          });
        }
        taskLastRunAt.set(task.id, task.lastRunAt);
      }
    }
  });
  runtime.startScheduler();

  // Wire agent completion notifications
  runtime.setSessionCompletionHandler((conversationId) => {
    pushNotification("notification:show", {
      title: "Agent Finished",
      body: "Response ready",
    });
    pushNotification("notification:navigateToConversation", conversationId);
  });

  // Tool permissions
  const toolPermsPath = join(resolvedDataDir, "tool-permissions.json");
  const defaultToolPerms: ToolPermissions = {
    approvalMode: "smart",
    fileRead: true,
    fileWrite: true,
    shellExecute: true,
    mcpCall: true,
    allowedPaths: [],
  };

  // ---------------------------------------------------------------------------
  // Method handlers
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Record<string, (...args: any[]) => Promise<unknown> | unknown> = {
    // Conversation
    "conversation:create": (title?: string) => runtime.createConversation(title),
    "conversation:list": () => runtime.listConversations(),
    "conversation:delete": (id: string) => runtime.deleteConversation(id),
    "conversation:messages": (id: string) => runtime.getActiveMessages(id),
    "conversation:updateTitle": (id: string, title: string) =>
      runtime.updateConversationTitle(id, title),
    "conversation:search": (query: string) => runtime.searchConversations(query),
    "conversation:getSystemPrompt": (id: string) => runtime.getConversationSystemPrompt(id),
    "conversation:setSystemPrompt": (id: string, prompt: string) =>
      runtime.setConversationSystemPrompt(id, prompt),
    "conversation:setFolder": (id: string, folderId: string | null) =>
      runtime.setConversationFolder(id, folderId),
    "conversation:setFavorite": (id: string, isFavorite: boolean) =>
      runtime.setConversationFavorite(id, isFavorite),
    "conversation:branchInfo": (id: string) => runtime.getBranchInfo(id),
    "conversation:switchBranch": (id: string, targetMessageId: string) =>
      runtime.switchBranch(id, targetMessageId),

    // Agent
    "agent:send": async (conversationId: string, content: string | unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runtime.sendMessage(conversationId, content as any);
    },
    "agent:regenerate": (conversationId: string, assistantMessageId: string) =>
      runtime.regenerateMessage(conversationId, assistantMessageId),
    "agent:abort": (conversationId: string) => runtime.abort(conversationId),
    "agent:subscribe": (conversationId: string) => {
      runtime.subscribe(conversationId, (evt) => {
        pushNotification("agent:event", evt);
      });
    },
    "agent:unsubscribe": (conversationId: string) => runtime.unsubscribe(conversationId),
    "agent:status": (conversationId?: string) => runtime.getSessionStatus(conversationId),
    "agent:runningConversations": () => runtime.getRunningConversations(),

    // Provider
    "provider:list": () => readJsonFile<DesktopProviderConfig[]>(providersPath, []),
    "provider:set": (config: DesktopProviderConfig) => {
      const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
      const idx = configs.findIndex((p) => p.id === config.id);
      if (idx >= 0) configs[idx] = config;
      else configs.push(config);
      writeJsonFile(providersPath, configs);
      runtime.setProviderConfig(config);
    },
    "provider:remove": (id: string) => {
      const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
      writeJsonFile(
        providersPath,
        configs.filter((p) => p.id !== id),
      );
      runtime.removeProvider(id);
    },
    "provider:setActive": (id: string) => {
      const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
      for (const p of configs) p.isActive = p.id === id;
      writeJsonFile(providersPath, configs);
      runtime.setActiveProvider(id);
    },

    // Knowledge Base
    "kb:list": () => readJsonFile<unknown[]>(kbPath, []),
    "kb:set": (item: { id: string }) => {
      const items = readJsonFile<KnowledgeBaseItem[]>(kbPath, []);
      const idx = items.findIndex((k) => k.id === item.id);
      if (idx >= 0) items[idx] = item as KnowledgeBaseItem;
      else items.push(item as KnowledgeBaseItem);
      writeJsonFile(kbPath, items);
      runtime.setKnowledgeBase(items);
    },
    "kb:remove": (id: string) => {
      const items = readJsonFile<KnowledgeBaseItem[]>(kbPath, []);
      const updated = items.filter((k) => k.id !== id);
      writeJsonFile(kbPath, updated);
      runtime.setKnowledgeBase(updated);
    },

    // Skills
    "skills:search": async (query: string, tag?: string, perPage?: number) => {
      return await searchSkills(query, tag, perPage);
    },
    "skills:listInstalled": () => readJsonFile<SkillDefinition[]>(skillsPath, []),
    "skills:install": (skill: SkillDefinition) => {
      const skills = readJsonFile<SkillDefinition[]>(skillsPath, []);
      const idx = skills.findIndex((s) => s.id === skill.id);
      if (idx >= 0) skills[idx] = skill;
      else skills.push(skill);
      writeJsonFile(skillsPath, skills);
      runtime.setInstalledSkills(skills);
    },
    "skills:uninstall": (id: string) => {
      const skills = readJsonFile<SkillDefinition[]>(skillsPath, []);
      const updated = skills.filter((s) => s.id !== id);
      writeJsonFile(skillsPath, updated);
      runtime.setInstalledSkills(updated);
    },
    "skills:getEnabled": (conversationId: string) =>
      runtime.getConversationEnabledSkills(conversationId),
    "skills:setEnabled": (conversationId: string, skillIds: string[]) =>
      runtime.setConversationEnabledSkills(conversationId, skillIds),

    // MCP
    "mcp:list": () => readJsonFile<unknown[]>(mcpPath, []),
    "mcp:set": (config: { id: string }) => {
      const configs = readJsonFile<MCPServerConfig[]>(mcpPath, []);
      const idx = configs.findIndex((m) => m.id === config.id);
      if (idx >= 0) configs[idx] = config as MCPServerConfig;
      else configs.push(config as MCPServerConfig);
      writeJsonFile(mcpPath, configs);
      runtime?.setMCPConfigs(configs).catch((err) => {
        console.error("[Sidecar/MCP] Failed to apply configs:", err);
      });
    },
    "mcp:remove": (id: string) => {
      const configs = readJsonFile<MCPServerConfig[]>(mcpPath, []);
      const remaining = configs.filter((m) => m.id !== id);
      writeJsonFile(mcpPath, remaining);
      runtime?.setMCPConfigs(remaining).catch((err) => {
        console.error("[Sidecar/MCP] Failed to apply after remove:", err);
      });
    },
    "mcp:status": () => runtime?.getMCPServerStates() ?? [],
    "mcp:reconnect": async (id?: string) => {
      const configs = readJsonFile<MCPServerConfig[]>(mcpPath, []);
      await runtime?.setMCPConfigs(configs);
    },

    // Scheduler
    "scheduler:list": () => readJsonFile<ScheduledTask[]>(schedulerPath, []),
    "scheduler:set": (task: { id: string }) => {
      const tasks = readJsonFile<ScheduledTask[]>(schedulerPath, []);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) tasks[idx] = task as ScheduledTask;
      else tasks.push(task as ScheduledTask);
      writeJsonFile(schedulerPath, tasks);
      runtime?.setScheduledTasks(tasks);
    },
    "scheduler:remove": (id: string) => {
      const tasks = readJsonFile<ScheduledTask[]>(schedulerPath, []);
      const remaining = tasks.filter((t) => t.id !== id);
      writeJsonFile(schedulerPath, remaining);
      runtime?.setScheduledTasks(remaining);
    },
    "scheduler:runNow": async (id: string) => {
      const manager = runtime?.getScheduledTaskManager();
      if (manager) await manager.runNow(id);
    },

    // Memory
    "memory:getConfig": () =>
      runtime?.getMemoryConfig() ?? {
        enabled: true,
        maxSummaries: 50,
        maxFacts: 100,
        autoExtract: true,
      },
    "memory:setConfig": async (config: unknown) => {
      await runtime?.setMemoryConfig(config as Parameters<typeof runtime.setMemoryConfig>[0]);
    },
    "memory:getSummaries": async () => (await runtime?.getMemorySummaries()) ?? [],
    "memory:deleteSummary": async (id: string) => {
      await runtime?.deleteMemorySummary(id);
    },
    "memory:getFacts": async () => (await runtime?.getMemoryFacts()) ?? [],
    "memory:deleteFact": async (id: string) => {
      await runtime?.deleteMemoryFact(id);
    },
    "memory:updateFact": async (id: string, content: string) => {
      return await runtime?.updateMemoryFact(id, content);
    },

    // Tool Permissions
    "toolPermissions:get": () => readJsonFile<ToolPermissions>(toolPermsPath, defaultToolPerms),
    "toolPermissions:set": (permissions: ToolPermissions) => {
      writeJsonFile(toolPermsPath, permissions);
      try {
        runtime?.setToolPermissions(permissions);
      } catch (err) {
        console.error("[Sidecar] Failed to sync tool permissions:", err);
      }
    },

    // Tool Approval
    "tool:respondApproval": (conversationId: string, approvalId: string, approved: boolean) => {
      try {
        runtime?.resolveToolApproval(conversationId, approvalId, approved);
      } catch (err) {
        console.error("[Sidecar] respondApproval failed:", err);
      }
    },

    // Preferences
    "preferences:get": () => {
      const defaultPrefs = { theme: "system", language: "en", sidebarOpen: true };
      return readJsonFile(prefsPath, defaultPrefs);
    },
    "preferences:set": (prefs: Record<string, unknown>) => {
      const defaultPrefs = { theme: "system", language: "en", sidebarOpen: true };
      const current = readJsonFile(prefsPath, defaultPrefs);
      writeJsonFile(prefsPath, { ...current, ...prefs });
      if ("proxyUrl" in prefs) {
        applyProxy((prefs.proxyUrl as string) || null);
      }
      if ("globalSystemPrompt" in prefs) {
        try {
          runtime?.setGlobalSystemPrompt((prefs.globalSystemPrompt as string) || "");
        } catch {
          // runtime may not be initialized
        }
      }
    },

    // Proxy
    "proxy:apply": (url: string | null) => {
      applyProxy(url || null);
    },

    // Voice
    "voice:transcribe": async (audioBase64: string, language?: string) => {
      try {
        const prefs = readJsonFile<Record<string, unknown>>(prefsPath, {});
        const voicePrefs = (prefs.voice ?? {}) as {
          sttApiUrl?: string;
          sttApiKey?: string;
        };

        let apiUrl: string;
        let apiKey: string;

        if (voicePrefs.sttApiUrl && voicePrefs.sttApiKey) {
          apiUrl = voicePrefs.sttApiUrl.replace(/\/+$/, "");
          apiKey = voicePrefs.sttApiKey;
        } else {
          const providers = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
          const isDirectOpenAI = (p: DesktopProviderConfig): boolean =>
            !!p.apiKey && (!p.baseUrl || p.baseUrl.includes("api.openai.com"));
          const provider =
            providers.find((p) => isDirectOpenAI(p)) ||
            providers.find((p) => !!p.apiKey && (p.type === "openai" || p.type === "custom"));
          if (!provider) {
            return { error: "No STT API configured." };
          }
          apiUrl = (provider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
          apiKey = provider.apiKey;
        }

        const fullUrl = `${apiUrl}/audio/transcriptions`;
        const audioBuf = Buffer.from(audioBase64, "base64");

        const boundary = `----FormBoundary${Date.now().toString(36)}`;
        const CRLF = "\r\n";
        const parts: Buffer[] = [];
        parts.push(
          Buffer.from(
            `--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}whisper-1${CRLF}`,
          ),
        );
        if (language) {
          parts.push(
            Buffer.from(
              `--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}${language}${CRLF}`,
            ),
          );
        }
        parts.push(
          Buffer.from(
            `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="recording.webm"${CRLF}Content-Type: audio/webm${CRLF}${CRLF}`,
          ),
        );
        parts.push(audioBuf);
        parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
        const body = Buffer.concat(parts);

        const resp = await fetch(fullUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });

        const respText = await resp.text();
        if (resp.ok) {
          try {
            const json = JSON.parse(respText) as { text: string };
            return { text: json.text };
          } catch {
            return { error: "Invalid JSON response from Whisper API" };
          }
        } else {
          return { error: `Transcription failed (${resp.status})` };
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Transcription failed" };
      }
    },

    // Screen capture
    "screen:capture": async () => {
      if (process.platform !== "darwin") return null;

      const tmpFile = join(tmpdir(), `agentx-screenshot-${Date.now()}.png`);

      try {
        await new Promise<void>((resolve, reject) => {
          execFile("screencapture", ["-i", "-x", "-t", "png", tmpFile], (error) => {
            if (error) reject(error);
            else resolve();
          });
        });

        if (!existsSync(tmpFile)) return null;

        const imageBuffer = readFileSync(tmpFile);
        const base64 = imageBuffer.toString("base64");

        try {
          unlinkSync(tmpFile);
        } catch {
          // ignore
        }

        return { data: base64, mimeType: "image/png" };
      } catch {
        try {
          unlinkSync(tmpFile);
        } catch {
          // ignore
        }
        return null;
      }
    },

    // Notifications config (no-op, handled by Rust side)
    "notifications:config": () => null,
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

      // Only send response if there's an id (not a notification)
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
      await runtime?.shutdown();
    } catch (err) {
      console.error("[Sidecar] Shutdown error:", err);
    }
    process.exit(0);
  });

  console.error("[Sidecar] Ready, listening on stdin");
}

main().catch((err) => {
  console.error("[Sidecar] Fatal error:", err);
  process.exit(1);
});
