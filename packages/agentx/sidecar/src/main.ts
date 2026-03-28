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
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { execFile, execFileSync } from "child_process";
import { AgentRuntime } from "@agentx/runtime";
import type {
  ProviderConfig,
  KnowledgeBaseItem,
  MCPServerConfig,
  SkillDefinition,
  ToolPermissions,
  ScheduledTask,
  ChannelConfig,
} from "@agentx/runtime";
import { ChannelManager } from "@agentx/runtime";
import { searchSkills } from "@agentx/runtime";

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
  // Set env vars so all subsystems (channels, etc.) can detect proxy
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
// Notification Intelligence — macOS notification center reader & AI classifier
// ---------------------------------------------------------------------------

interface MacNotification {
  id: string;
  appId: string;
  appName: string;
  title: string;
  subtitle: string;
  body: string;
  deliveredAt: number;
  category?: "urgent" | "important" | "normal" | "spam";
  categoryReason?: string;
  read: boolean;
}

interface NIConfig {
  enabled: boolean;
  pollingIntervalMs: number;
  autoClassify: boolean;
  rules: Array<{
    id: string;
    appId?: string;
    keyword?: string;
    category: "urgent" | "important" | "normal" | "spam";
  }>;
}

const NI_DEFAULT_CONFIG: NIConfig = {
  enabled: false,
  pollingIntervalMs: 30000,
  autoClassify: true,
  rules: [],
};

// Core Data timestamp epoch: 2001-01-01T00:00:00Z
const CORE_DATA_EPOCH = 978307200;

/** Bundle ID → human-readable app name mapping */
const APP_NAME_CACHE: Record<string, string> = {};

function resolveAppName(bundleId: string): string {
  if (APP_NAME_CACHE[bundleId]) return APP_NAME_CACHE[bundleId]!;

  // Extract a reasonable name from the bundle ID
  const parts = bundleId.split(".");
  let name = parts[parts.length - 1] || bundleId;

  // Try to get the actual app name via mdls (Spotlight metadata)
  try {
    const output = execFileSync("bash", [
      "-c",
      `mdfind "kMDItemCFBundleIdentifier == '${bundleId}'" | head -1`,
    ])
      .toString()
      .trim();

    if (output) {
      const appName = output.split("/").pop()?.replace(".app", "") || name;
      name = appName;
    }
  } catch {
    // Fallback: clean up bundle ID
  }

  APP_NAME_CACHE[bundleId] = name;
  return name;
}

function readMacOSNotifications(limit = 50): MacNotification[] {
  if (process.platform !== "darwin") return [];

  try {
    // Find the notification DB
    const dbPath = join(homedir(), "Library/Group Containers/group.com.apple.usernoted/db2/db");

    if (!existsSync(dbPath)) {
      console.error("[NI] Notification DB not found at:", dbPath);
      return [];
    }

    // Query the database using sqlite3 CLI
    const sql = `SELECT r.rec_id, a.identifier, r.delivered_date FROM record r JOIN app a ON r.app_id = a.app_id ORDER BY r.delivered_date DESC LIMIT ${limit}`;
    const output = execFileSync("sqlite3", ["-readonly", dbPath, "-separator", "|||", sql])
      .toString()
      .trim();

    if (!output) return [];

    const notifications: MacNotification[] = [];
    const rows = output.split("\n");

    for (const row of rows) {
      const [recId, appId, dateStr] = row.split("|||");
      if (!recId || !appId || !dateStr) continue;

      const deliveredAt = (parseFloat(dateStr) + CORE_DATA_EPOCH) * 1000;

      // Extract notification content from the plist blob
      let title = "";
      let body = "";
      let subtitle = "";

      try {
        // Write blob to temp file and extract fields with plutil
        const tmpPath = join(tmpdir(), `agentx_ni_${recId}.plist`);
        execFileSync("sqlite3", [
          "-readonly",
          dbPath,
          `SELECT writefile('${tmpPath}', data) FROM record WHERE rec_id = ${recId}`,
        ]);

        try {
          title = execFileSync("plutil", ["-extract", "req.titl", "raw", tmpPath])
            .toString()
            .trim();
        } catch {}

        try {
          body = execFileSync("plutil", ["-extract", "req.body", "raw", tmpPath]).toString().trim();
        } catch {}

        try {
          subtitle = execFileSync("plutil", ["-extract", "req.subt", "raw", tmpPath])
            .toString()
            .trim();
        } catch {}

        try {
          unlinkSync(tmpPath);
        } catch {}
      } catch {
        // Skip notifications we can't decode
        continue;
      }

      // Skip empty notifications
      if (!title && !body) continue;

      notifications.push({
        id: recId,
        appId,
        appName: resolveAppName(appId),
        title,
        subtitle,
        body,
        deliveredAt,
        read: false,
      });
    }

    return notifications;
  } catch (err) {
    console.error("[NI] Failed to read notifications:", err);
    return [];
  }
}

async function classifyNotifications(
  notifications: MacNotification[],
  providersPath: string,
  rules: NIConfig["rules"],
): Promise<MacNotification[]> {
  // First, apply manual rules
  const unclassified: MacNotification[] = [];

  for (const n of notifications) {
    let matched = false;
    for (const rule of rules) {
      if (rule.appId && n.appId !== rule.appId) continue;
      if (rule.keyword) {
        const kw = rule.keyword.toLowerCase();
        const text = `${n.title} ${n.subtitle} ${n.body}`.toLowerCase();
        if (!text.includes(kw)) continue;
      }
      n.category = rule.category;
      n.categoryReason = "Matched rule";
      matched = true;
      break;
    }
    if (!matched) unclassified.push(n);
  }

  // AI classify remaining notifications
  if (unclassified.length === 0) return notifications;

  try {
    const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
    const activeProvider = providers.find((p) => p.isActive) || providers[0];
    if (!activeProvider) {
      // No provider — default to "normal"
      for (const n of unclassified) {
        n.category = "normal";
      }
      return notifications;
    }

    const prompt = `Classify each notification into one of these categories:
- urgent: Needs immediate attention (e.g., security alerts, system errors, urgent messages from people)
- important: Should see soon (e.g., direct messages, calendar reminders, important app updates)
- normal: Regular notifications (e.g., news, social media, general updates)
- spam: Can be silenced (e.g., marketing, promotional, repetitive low-value alerts)

Notifications to classify:
${unclassified.map((n, i) => `[${i}] App: ${n.appName} (${n.appId}) | Title: ${n.title} | Body: ${n.body}`).join("\n")}

Respond with ONLY a JSON array of objects: [{"index": 0, "category": "...", "reason": "brief reason"}, ...]`;

    let apiUrl: string;
    let headers: Record<string, string>;
    let reqBody: unknown;

    if (activeProvider.type === "anthropic") {
      apiUrl =
        (activeProvider.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "") +
        "/v1/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": activeProvider.apiKey,
        "anthropic-version": "2023-06-01",
      };
      reqBody = {
        model: activeProvider.defaultModel || "claude-sonnet-4-20250514",
        max_tokens: 2048,
        temperature: 0,
        system: "You are a notification classifier. Only output valid JSON arrays, nothing else.",
        messages: [{ role: "user", content: prompt }],
      };
    } else {
      let baseUrl = (activeProvider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
      if (activeProvider.type === "gemini" && !activeProvider.baseUrl) {
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
      }
      apiUrl = `${baseUrl}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeProvider.apiKey}`,
      };
      const defaultModel =
        activeProvider.type === "gemini"
          ? "gemini-2.0-flash"
          : activeProvider.defaultModel || "gpt-4o";
      reqBody = {
        model: activeProvider.defaultModel || defaultModel,
        temperature: 0,
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content:
              "You are a notification classifier. Only output valid JSON arrays, nothing else.",
          },
          { role: "user", content: prompt },
        ],
      };
    }

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });

    if (resp.ok) {
      const json = JSON.parse(await resp.text());
      let resultText: string;
      if (activeProvider.type === "anthropic") {
        resultText =
          json.content?.[0]?.text ||
          json.content?.map((c: { text: string }) => c.text).join("") ||
          "";
      } else {
        resultText = json.choices?.[0]?.message?.content || "";
      }

      // Parse the JSON array from the response
      const jsonMatch = resultText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const classifications = JSON.parse(jsonMatch[0]) as Array<{
          index: number;
          category: string;
          reason: string;
        }>;
        for (const c of classifications) {
          const n = unclassified[c.index];
          if (n && ["urgent", "important", "normal", "spam"].includes(c.category)) {
            n.category = c.category as MacNotification["category"];
            n.categoryReason = c.reason;
          }
        }
      }
    }
  } catch (err) {
    console.error("[NI] AI classification failed:", err);
  }

  // Default unclassified to "normal"
  for (const n of unclassified) {
    if (!n.category) n.category = "normal";
  }

  return notifications;
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

  // Restore proxy
  if (typeof savedPrefs.proxyUrl === "string" && savedPrefs.proxyUrl) {
    applyProxy(savedPrefs.proxyUrl);
  }

  // Restore providers
  const providersPath = join(resolvedDataDir, "providers.json");
  const savedProviders = readJsonFile<ProviderConfig[]>(providersPath, []);
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

  // Restore channels
  const channelsPath = join(resolvedDataDir, "channels.json");
  const channelConversationsPath = join(resolvedDataDir, "channel-conversations.json");
  const channelManager = new ChannelManager(runtime, {
    configPath: channelsPath,
    conversationMapPath: channelConversationsPath,
    onStatusUpdate: (states) => {
      pushNotification("channel:statusUpdate", states);
    },
    onQRCode: (channelId, qrDataUrl) => {
      pushNotification("channel:qrCode", { channelId, qrDataUrl });
    },
    onConversationsChanged: () => {
      pushNotification("channel:conversationsChanged", {});
    },
    onConfigUpdate: (channelId, settingsUpdate) => {
      const configs = readJsonFile<ChannelConfig[]>(channelsPath, []);
      const idx = configs.findIndex((c) => c.id === channelId);
      if (idx >= 0) {
        configs[idx]!.settings = { ...configs[idx]!.settings, ...settingsUpdate };
        writeJsonFile(channelsPath, configs);
      }
    },
  });

  const savedChannels = readJsonFile<ChannelConfig[]>(channelsPath, []);
  if (savedChannels.length > 0) {
    channelManager.setConfigs(savedChannels).catch((err) => {
      console.error("[Sidecar/Channels] Failed to restore:", err);
    });
  }

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

  // Wire conversation metadata updated (title/icon auto-generated)
  runtime.setConversationMetadataUpdatedHandler((conversationId) => {
    pushNotification("conversation:metadataUpdated", { conversationId });
  });

  // Notification Intelligence paths and state
  const niConfigPath = join(resolvedDataDir, "ni-config.json");
  const niReadIdsPath = join(resolvedDataDir, "ni-read-ids.json");
  let niPollingTimer: ReturnType<typeof setInterval> | null = null;
  let niLastSeenId = "";

  function startNIPolling() {
    if (niPollingTimer) return;
    const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
    const interval = Math.max(10000, config.pollingIntervalMs || 30000);

    console.error(`[NI] Starting polling every ${interval / 1000}s`);

    const poll = async () => {
      try {
        const raw = readMacOSNotifications(50);
        if (raw.length === 0) return;

        // Check if there are new notifications
        const newestId = raw[0]?.id || "";
        if (newestId === niLastSeenId) return;
        niLastSeenId = newestId;

        // Mark read status
        const readIds = readJsonFile<string[]>(niReadIdsPath, []);
        const readSet = new Set(readIds);
        for (const n of raw) {
          n.read = readSet.has(n.id);
        }

        // Auto-classify if enabled
        const currentConfig = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
        let notifications = raw;
        if (currentConfig.autoClassify) {
          notifications = await classifyNotifications(raw, providersPath, currentConfig.rules);
        }

        // Push update to frontend
        pushNotification("ni:update", notifications);

        // Show native notification for urgent items
        const unreadUrgent = notifications.filter((n) => n.category === "urgent" && !n.read);
        if (unreadUrgent.length > 0) {
          pushNotification("notification:show", {
            title: `${unreadUrgent.length} urgent notification${unreadUrgent.length > 1 ? "s" : ""}`,
            body:
              unreadUrgent[0]!.title + (unreadUrgent[0]!.body ? `: ${unreadUrgent[0]!.body}` : ""),
          });
        }
      } catch (err) {
        console.error("[NI] Poll error:", err);
      }
    };

    // Initial poll
    poll();
    niPollingTimer = setInterval(poll, interval);
  }

  function stopNIPolling() {
    if (niPollingTimer) {
      clearInterval(niPollingTimer);
      niPollingTimer = null;
      console.error("[NI] Polling stopped");
    }
  }

  // Auto-start if previously enabled
  const savedNIConfig = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
  if (savedNIConfig.enabled) {
    startNIPolling();
  }

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
    "provider:list": () => readJsonFile<ProviderConfig[]>(providersPath, []),
    "provider:set": (config: ProviderConfig) => {
      const configs = readJsonFile<ProviderConfig[]>(providersPath, []);
      const idx = configs.findIndex((p) => p.id === config.id);
      if (idx >= 0) configs[idx] = config;
      else configs.push(config);
      writeJsonFile(providersPath, configs);
      runtime.setProviderConfig(config);
    },
    "provider:remove": (id: string) => {
      const configs = readJsonFile<ProviderConfig[]>(providersPath, []);
      writeJsonFile(
        providersPath,
        configs.filter((p) => p.id !== id),
      );
      runtime.removeProvider(id);
    },
    "provider:setActive": (id: string) => {
      const configs = readJsonFile<ProviderConfig[]>(providersPath, []);
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

    // Channels
    "channel:list": () => readJsonFile<ChannelConfig[]>(channelsPath, []),
    "channel:set": async (config: { id: string }) => {
      const configs = readJsonFile<ChannelConfig[]>(channelsPath, []);
      const idx = configs.findIndex((c) => c.id === config.id);
      if (idx >= 0) configs[idx] = config as ChannelConfig;
      else configs.push(config as ChannelConfig);
      writeJsonFile(channelsPath, configs);
      await channelManager.setConfigs(configs);
    },
    "channel:remove": async (id: string) => {
      const configs = readJsonFile<ChannelConfig[]>(channelsPath, []);
      const remaining = configs.filter((c) => c.id !== id);
      writeJsonFile(channelsPath, remaining);
      await channelManager.setConfigs(remaining);
    },
    "channel:status": () => channelManager.getStates(),
    "channel:start": async (id: string) => {
      await channelManager.startChannel(id);
    },
    "channel:stop": async (id: string) => {
      await channelManager.stopChannel(id);
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
          const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
          const isDirectOpenAI = (p: ProviderConfig): boolean =>
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

    // Translate
    "translate:run": async (text: string, targetLang: string) => {
      try {
        const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
        const activeProvider = providers.find((p) => p.isActive) || providers[0];

        if (!activeProvider) {
          return {
            text: "",
            error: "No AI provider configured. Please set up a provider in Settings.",
          };
        }

        // Build the provider's StreamFn via ProviderManager
        const pm = runtime as unknown as { providerManager?: unknown };
        // Use runtime's provider directly by making a simple API call
        const langNames: Record<string, string> = {
          zh: "Chinese (Simplified)",
          en: "English",
          ja: "Japanese",
          ko: "Korean",
          fr: "French",
          de: "German",
          es: "Spanish",
          ru: "Russian",
          pt: "Portuguese",
          ar: "Arabic",
        };
        const targetName = langNames[targetLang] || targetLang;

        const systemPrompt = `You are a professional translator. Translate the given text to ${targetName}. Only output the translated text, nothing else. Do not add explanations, quotes, or formatting. Preserve the original formatting (line breaks, paragraphs, etc).`;

        // Determine API details based on provider type
        let apiUrl: string;
        let headers: Record<string, string>;
        let body: unknown;

        if (activeProvider.type === "anthropic") {
          apiUrl =
            (activeProvider.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "") +
            "/v1/messages";
          headers = {
            "Content-Type": "application/json",
            "x-api-key": activeProvider.apiKey,
            "anthropic-version": "2023-06-01",
          };
          body = {
            model: activeProvider.defaultModel || "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0.2,
            system: systemPrompt,
            messages: [{ role: "user", content: text }],
          };
        } else {
          // OpenAI-compatible (openai, gemini, custom)
          let baseUrl = (activeProvider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
          if (activeProvider.type === "gemini" && !activeProvider.baseUrl) {
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
          }
          apiUrl = `${baseUrl}/chat/completions`;
          headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeProvider.apiKey}`,
          };
          const defaultModel =
            activeProvider.type === "gemini"
              ? "gemini-2.0-flash"
              : activeProvider.defaultModel || "gpt-4o";
          body = {
            model: activeProvider.defaultModel || defaultModel,
            temperature: 0.2,
            max_tokens: 4096,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
          };
        }

        const resp = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const respText = await resp.text();
        if (!resp.ok) {
          return { text: "", error: `API error (${resp.status}): ${respText.slice(0, 200)}` };
        }

        const json = JSON.parse(respText);

        let translatedText: string;
        if (activeProvider.type === "anthropic") {
          translatedText =
            json.content?.[0]?.text ||
            json.content?.map((c: { text: string }) => c.text).join("") ||
            "";
        } else {
          translatedText = json.choices?.[0]?.message?.content || "";
        }

        return { text: translatedText.trim() };
      } catch (err) {
        return { text: "", error: err instanceof Error ? err.message : "Translation failed" };
      }
    },

    // Shortcuts.app integration — one-shot AI prompt with optional system prompt
    "shortcuts:run": async (prompt: string, systemPrompt?: string | null) => {
      try {
        const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
        const activeProvider = providers.find((p) => p.isActive) || providers[0];

        if (!activeProvider) {
          return {
            text: "",
            error: "No AI provider configured. Please set up a provider in Settings.",
          };
        }

        const sysPrompt =
          systemPrompt || "You are a helpful assistant. Respond concisely and directly.";

        let apiUrl: string;
        let headers: Record<string, string>;
        let body: unknown;

        if (activeProvider.type === "anthropic") {
          apiUrl =
            (activeProvider.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "") +
            "/v1/messages";
          headers = {
            "Content-Type": "application/json",
            "x-api-key": activeProvider.apiKey,
            "anthropic-version": "2023-06-01",
          };
          body = {
            model: activeProvider.defaultModel || "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0.3,
            system: sysPrompt,
            messages: [{ role: "user", content: prompt }],
          };
        } else {
          let baseUrl = (activeProvider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
          if (activeProvider.type === "gemini" && !activeProvider.baseUrl) {
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
          }
          apiUrl = `${baseUrl}/chat/completions`;
          headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeProvider.apiKey}`,
          };
          const defaultModel =
            activeProvider.type === "gemini"
              ? "gemini-2.0-flash"
              : activeProvider.defaultModel || "gpt-4o";
          body = {
            model: activeProvider.defaultModel || defaultModel,
            temperature: 0.3,
            max_tokens: 4096,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: prompt },
            ],
          };
        }

        const resp = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const respText = await resp.text();
        if (!resp.ok) {
          return { text: "", error: `API error (${resp.status}): ${respText.slice(0, 200)}` };
        }

        const json = JSON.parse(respText);

        let resultText: string;
        if (activeProvider.type === "anthropic") {
          resultText =
            json.content?.[0]?.text ||
            json.content?.map((c: { text: string }) => c.text).join("") ||
            "";
        } else {
          resultText = json.choices?.[0]?.message?.content || "";
        }

        return { text: resultText.trim() };
      } catch (err) {
        return {
          text: "",
          error: err instanceof Error ? err.message : "Shortcut action failed",
        };
      }
    },

    // Notification Intelligence
    "ni:getConfig": () => readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG),
    "ni:setConfig": (config: NIConfig) => {
      writeJsonFile(niConfigPath, config);
      // Restart polling if config changed
      if (config.enabled && !niPollingTimer) {
        startNIPolling();
      } else if (!config.enabled && niPollingTimer) {
        stopNIPolling();
      }
    },
    "ni:fetch": () => {
      const raw = readMacOSNotifications(100);
      const readIds = readJsonFile<string[]>(niReadIdsPath, []);
      const readSet = new Set(readIds);
      for (const n of raw) {
        n.read = readSet.has(n.id);
      }
      return raw;
    },
    "ni:classify": async (notifs: MacNotification[]) => {
      const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
      return await classifyNotifications(notifs, providersPath, config.rules);
    },
    "ni:start": () => {
      const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
      config.enabled = true;
      writeJsonFile(niConfigPath, config);
      startNIPolling();
    },
    "ni:stop": () => {
      const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
      config.enabled = false;
      writeJsonFile(niConfigPath, config);
      stopNIPolling();
    },
    "ni:markRead": (ids: string[]) => {
      const existing = readJsonFile<string[]>(niReadIdsPath, []);
      const set = new Set(existing);
      for (const id of ids) set.add(id);
      // Keep only the last 500 read IDs to prevent unbounded growth
      const arr = Array.from(set).slice(-500);
      writeJsonFile(niReadIdsPath, arr);
    },

    // Clipboard AI Pipeline
    "clipboard:process": async (text: string, action: string) => {
      try {
        const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
        const activeProvider = providers.find((p) => p.isActive) || providers[0];

        if (!activeProvider) {
          return {
            text: "",
            error: "No AI provider configured. Please set up a provider in Settings.",
          };
        }

        // Build system prompt based on action
        const actionPrompts: Record<string, string> = {
          translate:
            "You are a professional translator. Detect the source language automatically. If the text is in Chinese, translate to English. If it is in any other language, translate to Chinese (Simplified). Only output the translated text, nothing else. Preserve the original formatting.",
          summarize:
            "You are an expert summarizer. Summarize the given text concisely in the same language as the input. Keep the key points and structure. Only output the summary, nothing else.",
          explain:
            "You are a helpful assistant. Explain the given text clearly and concisely in the same language as the input. Focus on the meaning and context. Only output the explanation, nothing else.",
          rewrite:
            "You are a professional writer. Rewrite the given text to improve clarity, readability, and style while preserving the original meaning. Keep the same language. Only output the rewritten text, nothing else.",
          "code-explain":
            "You are an expert programmer. Explain the given code clearly and concisely. Describe what it does, the key logic, and any notable patterns. Use the same language as any comments in the code, or Chinese if no comments. Only output the explanation, nothing else.",
          format:
            "You are a format conversion assistant. Convert the given text to a cleaner, more structured format. For example: JSON to YAML, messy text to Markdown table, unformatted code to properly formatted code, etc. Infer the best target format. Only output the converted result, nothing else.",
        };

        const systemPrompt =
          actionPrompts[action] ||
          "You are a helpful assistant. Process the given text according to the user's intent. Only output the result, nothing else.";

        // Determine API details based on provider type
        let apiUrl: string;
        let headers: Record<string, string>;
        let body: unknown;

        if (activeProvider.type === "anthropic") {
          apiUrl =
            (activeProvider.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "") +
            "/v1/messages";
          headers = {
            "Content-Type": "application/json",
            "x-api-key": activeProvider.apiKey,
            "anthropic-version": "2023-06-01",
          };
          body = {
            model: activeProvider.defaultModel || "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: "user", content: text }],
          };
        } else {
          // OpenAI-compatible (openai, gemini, custom)
          let baseUrl = (activeProvider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
          if (activeProvider.type === "gemini" && !activeProvider.baseUrl) {
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
          }
          apiUrl = `${baseUrl}/chat/completions`;
          headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeProvider.apiKey}`,
          };
          const defaultModel =
            activeProvider.type === "gemini"
              ? "gemini-2.0-flash"
              : activeProvider.defaultModel || "gpt-4o";
          body = {
            model: activeProvider.defaultModel || defaultModel,
            temperature: 0.3,
            max_tokens: 4096,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
          };
        }

        const resp = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const respText = await resp.text();
        if (!resp.ok) {
          return { text: "", error: `API error (${resp.status}): ${respText.slice(0, 200)}` };
        }

        const json = JSON.parse(respText);

        let resultText: string;
        if (activeProvider.type === "anthropic") {
          resultText =
            json.content?.[0]?.text ||
            json.content?.map((c: { text: string }) => c.text).join("") ||
            "";
        } else {
          resultText = json.choices?.[0]?.message?.content || "";
        }

        return { text: resultText.trim() };
      } catch (err) {
        return { text: "", error: err instanceof Error ? err.message : "Processing failed" };
      }
    },

    // File Tags: AI analysis
    "fileTags:analyze": async (path: string, contentPreview: string, metadata: unknown) => {
      try {
        const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
        const activeProvider = providers.find((p) => p.isActive) || providers[0];

        if (!activeProvider) {
          return { tags: [], summary: "No AI provider configured.", error: "No provider" };
        }

        const fileName = path.split("/").pop() || path;
        const systemPrompt = `You are a file analysis assistant. Analyze the given file and return a JSON object with:
- "tags": array of 2-5 short descriptive tags (in English, lowercase, relevant to the file content/type)
- "summary": a one-sentence summary of what this file is/does
- "category": a single category like "source-code", "document", "config", "image", "data", "script", etc.
- "language": programming language if applicable, otherwise omit

Return ONLY valid JSON, no markdown, no explanation.`;

        const userPrompt = `File: ${fileName}
${metadata ? `Metadata: ${JSON.stringify(metadata)}` : ""}

Content preview:
${contentPreview.slice(0, 3000)}`;

        let apiUrl: string;
        let headers: Record<string, string>;
        let body: unknown;

        if (activeProvider.type === "anthropic") {
          apiUrl =
            (activeProvider.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "") +
            "/v1/messages";
          headers = {
            "Content-Type": "application/json",
            "x-api-key": activeProvider.apiKey,
            "anthropic-version": "2023-06-01",
          };
          body = {
            model: activeProvider.defaultModel || "claude-sonnet-4-20250514",
            max_tokens: 1024,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          };
        } else {
          let baseUrl = (activeProvider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
          if (activeProvider.type === "gemini" && !activeProvider.baseUrl) {
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
          }
          apiUrl = `${baseUrl}/chat/completions`;
          headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeProvider.apiKey}`,
          };
          const defaultModel =
            activeProvider.type === "gemini"
              ? "gemini-2.0-flash"
              : activeProvider.defaultModel || "gpt-4o";
          body = {
            model: activeProvider.defaultModel || defaultModel,
            temperature: 0,
            max_tokens: 1024,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          };
        }

        const resp = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const respText = await resp.text();
        if (!resp.ok) {
          return {
            tags: [],
            summary: "",
            error: `API error (${resp.status}): ${respText.slice(0, 200)}`,
          };
        }

        const json = JSON.parse(respText);

        let resultText: string;
        if (activeProvider.type === "anthropic") {
          resultText =
            json.content?.[0]?.text ||
            json.content?.map((c: { text: string }) => c.text).join("") ||
            "";
        } else {
          resultText = json.choices?.[0]?.message?.content || "";
        }

        // Parse the JSON response
        const cleaned = resultText
          .trim()
          .replace(/^```json\s*/, "")
          .replace(/```\s*$/, "");
        const parsed = JSON.parse(cleaned);
        return {
          tags: parsed.tags || [],
          summary: parsed.summary || "",
          category: parsed.category || "",
          language: parsed.language,
          topics: parsed.topics,
        };
      } catch (err) {
        return {
          tags: [],
          summary: "",
          error: err instanceof Error ? err.message : "Analysis failed",
        };
      }
    },
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
      await channelManager.shutdown();
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
