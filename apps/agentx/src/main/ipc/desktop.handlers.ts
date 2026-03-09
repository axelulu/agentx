import { ipcMain, BrowserWindow, app, net } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { is } from "@electron-toolkit/utils";
import { DesktopRuntime } from "@workspace/desktop";
import type {
  DesktopProviderConfig,
  KnowledgeBaseItem,
  MCPServerConfig,
  SkillDefinition,
  ToolPermissions,
} from "@workspace/desktop";
import { searchSkills, getSkill } from "@workspace/desktop";
import { setGlobalDispatcher, ProxyAgent, Agent } from "undici";

let runtime: DesktopRuntime;

// Resolved data directory — computed once in initDesktopRuntime(), used by all
// IPC handlers. Defaults to app.getPath("userData"), overridden by user pref.
// preferences.json itself always stays at app.getPath("userData") (bootstrap).
let resolvedDataDir: string;

// ---------------------------------------------------------------------------
// Proxy support — route all main-process fetch() through a proxy
// ---------------------------------------------------------------------------

function applyProxy(url: string | null): void {
  if (url) {
    setGlobalDispatcher(new ProxyAgent(url));
    console.log("[Proxy] Enabled:", url);
  } else {
    setGlobalDispatcher(new Agent());
    console.log("[Proxy] Disabled (direct connection)");
  }
}

// ---------------------------------------------------------------------------
// JSON file helpers for simple key-value stores
// ---------------------------------------------------------------------------

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // corrupted file — return fallback
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function initDesktopRuntime(): Promise<void> {
  // Read user-configured paths from preferences (saved by settings UI).
  // preferences.json always lives at the default userData location (bootstrap).
  const prefsPath = join(app.getPath("userData"), "preferences.json");
  const savedPrefs = readJsonFile<Record<string, string>>(prefsPath, {});

  const workspacePath = savedPrefs.workspacePath || app.getPath("home");
  resolvedDataDir = savedPrefs.dataPath || app.getPath("userData");

  runtime = new DesktopRuntime({
    toolkitPath: is.dev
      ? join(app.getAppPath(), "resources", "toolkit")
      : join(process.resourcesPath, "toolkit"),
    language: "en",
    workspacePath,
    dataPath: join(resolvedDataDir, "conversations"),
  });
  try {
    await runtime.initialize();
  } catch (err) {
    console.error("[DesktopRuntime] Initialization failed:", err);
    // Re-throw so the caller knows init failed — but IPC handlers are still
    // registered so the window can open and show an appropriate error state.
    throw err;
  }

  // Browser automation: set paths for child processes
  const browserScriptPath = is.dev
    ? join(app.getAppPath(), "resources", "browser", "browser-run.cjs")
    : join(process.resourcesPath, "browser", "browser-run.cjs");
  process.env.AGENTX_BROWSER_SCRIPT = browserScriptPath;

  // Use Electron's own embedded Node.js to run child scripts.
  // In packaged apps, system `node` is often not in PATH (macOS GUI apps
  // don't inherit the user's shell env). ELECTRON_RUN_AS_NODE=1 makes the
  // Electron binary behave as plain Node.js — but it MUST NOT be set
  // globally in process.env because Electron forks renderer helper
  // processes that inherit env vars and would break. Instead, the agent's
  // shell commands prefix each invocation with the env var inline.
  process.env.AGENTX_NODE = process.execPath;

  // playwright-core is bundled as an extraResource alongside browser-run.cjs
  // at Resources/browser/node_modules/playwright-core/, so normal Node.js
  // module resolution finds it without NODE_PATH or module.paths hacks.

  // Restore proxy setting from preferences
  if (typeof savedPrefs.proxyUrl === "string" && savedPrefs.proxyUrl) {
    applyProxy(savedPrefs.proxyUrl);
  }

  // Restore persisted provider configs into runtime
  const providersPath = join(resolvedDataDir, "providers.json");
  const savedProviders = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
  for (const config of savedProviders) {
    runtime.setProviderConfig(config);
  }
  const activeProvider = savedProviders.find((p) => p.isActive);
  if (activeProvider) {
    runtime.setActiveProvider(activeProvider.id);
  }

  // Restore persisted knowledge base into runtime
  const kbPath = join(resolvedDataDir, "knowledgebase.json");
  const savedKB = readJsonFile<KnowledgeBaseItem[]>(kbPath, []);
  runtime.setKnowledgeBase(savedKB);

  // Restore persisted installed skills into runtime
  const skillsBootPath = join(resolvedDataDir, "skills.json");
  const savedSkills = readJsonFile<SkillDefinition[]>(skillsBootPath, []);
  runtime.setInstalledSkills(savedSkills);

  // Restore global system prompt
  if (typeof savedPrefs.globalSystemPrompt === "string") {
    runtime.setGlobalSystemPrompt(savedPrefs.globalSystemPrompt);
  }

  // Restore MCP server configs and connect enabled servers
  const mcpPath = join(resolvedDataDir, "mcpservers.json");
  const savedMCP = readJsonFile<MCPServerConfig[]>(mcpPath, []);
  runtime.setMCPConfigs(savedMCP).catch((err) => {
    console.error("[MCP] Failed to initialize MCP servers:", err);
  });

  // Forward MCP status updates to all renderer windows
  runtime.setMCPStatusHandler((states) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("mcp:statusUpdate", states);
      }
    }
  });
}

export function registerDesktopHandlers(): void {
  // Conversation CRUD
  ipcMain.handle("conversation:create", (_event, title?: string) =>
    runtime.createConversation(title),
  );
  ipcMain.handle("conversation:list", () => runtime.listConversations());
  ipcMain.handle("conversation:delete", (_event, id: string) => runtime.deleteConversation(id));
  ipcMain.handle("conversation:messages", (_event, id: string) => runtime.getActiveMessages(id));
  ipcMain.handle("conversation:updateTitle", (_event, id: string, title: string) =>
    runtime.updateConversationTitle(id, title),
  );

  // ---------------------------------------------------------------------------
  // Conversation search
  // ---------------------------------------------------------------------------

  ipcMain.handle("conversation:search", (_event, query: string) =>
    runtime.searchConversations(query),
  );

  // ---------------------------------------------------------------------------
  // Per-conversation system prompt
  // ---------------------------------------------------------------------------

  ipcMain.handle("conversation:getSystemPrompt", (_event, id: string) =>
    runtime.getConversationSystemPrompt(id),
  );

  ipcMain.handle("conversation:setSystemPrompt", (_event, id: string, prompt: string) =>
    runtime.setConversationSystemPrompt(id, prompt),
  );

  ipcMain.handle("conversation:setFolder", (_event, id: string, folderId: string | null) =>
    runtime.setConversationFolder(id, folderId),
  );

  ipcMain.handle("conversation:setFavorite", (_event, id: string, isFavorite: boolean) =>
    runtime.setConversationFavorite(id, isFavorite),
  );

  // ---------------------------------------------------------------------------
  // Branching
  // ---------------------------------------------------------------------------

  ipcMain.handle("conversation:branchInfo", (_event, id: string) => runtime.getBranchInfo(id));

  ipcMain.handle("conversation:switchBranch", (_event, id: string, targetMessageId: string) =>
    runtime.switchBranch(id, targetMessageId),
  );

  // ---------------------------------------------------------------------------
  // Agent execution — fire-and-forget send, subscriber-based events
  // ---------------------------------------------------------------------------

  ipcMain.handle("agent:send", async (_event, conversationId: string, content: string) => {
    await runtime.sendMessage(conversationId, content);
  });

  ipcMain.handle(
    "agent:regenerate",
    async (_event, conversationId: string, assistantMessageId: string) => {
      return await runtime.regenerateMessage(conversationId, assistantMessageId);
    },
  );

  ipcMain.on("agent:abort", (_event, conversationId: string) => runtime.abort(conversationId));

  ipcMain.handle("agent:subscribe", (event, conversationId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    runtime.subscribe(conversationId, (evt) => {
      if (!win.isDestroyed()) {
        win.webContents.send("agent:event", evt);
      }
    });
  });

  ipcMain.on("agent:unsubscribe", (_event, conversationId: string) => {
    runtime.unsubscribe(conversationId);
  });

  ipcMain.handle("agent:status", (_event, conversationId?: string) => {
    return runtime.getSessionStatus(conversationId);
  });

  ipcMain.handle("agent:runningConversations", () => {
    return runtime.getRunningConversations();
  });

  // ---------------------------------------------------------------------------
  // Provider management (JSON file persistence)
  // ---------------------------------------------------------------------------

  const providersPath = join(resolvedDataDir, "providers.json");

  ipcMain.handle("provider:list", () => {
    return readJsonFile<DesktopProviderConfig[]>(providersPath, []);
  });

  ipcMain.handle("provider:set", (_event, config: DesktopProviderConfig) => {
    const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
    const idx = configs.findIndex((p) => p.id === config.id);
    if (idx >= 0) {
      configs[idx] = config;
    } else {
      configs.push(config);
    }
    writeJsonFile(providersPath, configs);
    runtime.setProviderConfig(config);
  });

  ipcMain.on("provider:remove", (_event, id: string) => {
    const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
    writeJsonFile(
      providersPath,
      configs.filter((p) => p.id !== id),
    );
    runtime.removeProvider(id);
  });

  ipcMain.on("provider:setActive", (_event, id: string) => {
    const configs = readJsonFile<DesktopProviderConfig[]>(providersPath, []);
    for (const p of configs) {
      p.isActive = p.id === id;
    }
    writeJsonFile(providersPath, configs);
    runtime.setActiveProvider(id);
  });

  // ---------------------------------------------------------------------------
  // Knowledge Base (JSON file persistence)
  // ---------------------------------------------------------------------------

  const kbPath = join(resolvedDataDir, "knowledgebase.json");

  ipcMain.handle("kb:list", () => {
    return readJsonFile<unknown[]>(kbPath, []);
  });

  ipcMain.handle("kb:set", (_event, item: { id: string }) => {
    const items = readJsonFile<KnowledgeBaseItem[]>(kbPath, []);
    const idx = items.findIndex((k) => k.id === item.id);
    if (idx >= 0) {
      items[idx] = item as KnowledgeBaseItem;
    } else {
      items.push(item as KnowledgeBaseItem);
    }
    writeJsonFile(kbPath, items);
    runtime.setKnowledgeBase(items);
  });

  ipcMain.on("kb:remove", (_event, id: string) => {
    const items = readJsonFile<KnowledgeBaseItem[]>(kbPath, []);
    const updated = items.filter((k) => k.id !== id);
    writeJsonFile(kbPath, updated);
    runtime.setKnowledgeBase(updated);
  });

  // ---------------------------------------------------------------------------
  // MCP Servers (JSON file persistence + runtime hot-reload)
  // ---------------------------------------------------------------------------

  const mcpPath = join(resolvedDataDir, "mcpservers.json");

  ipcMain.handle("mcp:list", () => {
    return readJsonFile<unknown[]>(mcpPath, []);
  });

  ipcMain.handle("mcp:set", (_event, config: { id: string }) => {
    const configs = readJsonFile<MCPServerConfig[]>(mcpPath, []);
    const idx = configs.findIndex((m) => m.id === config.id);
    if (idx >= 0) {
      configs[idx] = config as MCPServerConfig;
    } else {
      configs.push(config as MCPServerConfig);
    }
    writeJsonFile(mcpPath, configs);
    // Hot-reload: apply updated configs to runtime
    runtime?.setMCPConfigs(configs).catch((err) => {
      console.error("[MCP] Failed to apply configs:", err);
    });
  });

  ipcMain.on("mcp:remove", (_event, id: string) => {
    const configs = readJsonFile<MCPServerConfig[]>(mcpPath, []);
    const remaining = configs.filter((m) => m.id !== id);
    writeJsonFile(mcpPath, remaining);
    // Hot-reload: apply remaining configs
    runtime?.setMCPConfigs(remaining).catch((err) => {
      console.error("[MCP] Failed to apply configs after remove:", err);
    });
  });

  ipcMain.handle("mcp:status", () => {
    return runtime?.getMCPServerStates() ?? [];
  });

  ipcMain.handle("mcp:reconnect", async (_event, id?: string) => {
    const configs = readJsonFile<MCPServerConfig[]>(mcpPath, []);
    await runtime?.setMCPConfigs(configs);
  });

  // ---------------------------------------------------------------------------
  // Tool Permissions (JSON file persistence — works even if runtime init failed)
  // ---------------------------------------------------------------------------

  const toolPermsPath = join(resolvedDataDir, "tool-permissions.json");
  const defaultToolPerms: ToolPermissions = {
    approvalMode: "smart",
    fileRead: true,
    fileWrite: true,
    shellExecute: true,
    mcpCall: true,
    allowedPaths: [],
  };

  ipcMain.handle("toolPermissions:get", () => {
    return readJsonFile<ToolPermissions>(toolPermsPath, defaultToolPerms);
  });

  ipcMain.handle("toolPermissions:set", (_event, permissions: ToolPermissions) => {
    writeJsonFile(toolPermsPath, permissions);
    // Sync to runtime if available
    try {
      runtime?.setToolPermissions(permissions);
    } catch (err) {
      console.error("[Desktop] Failed to sync tool permissions to runtime:", err);
    }
  });

  // ---------------------------------------------------------------------------
  // User Preferences (theme, language, sidebar — JSON file persistence)
  // ---------------------------------------------------------------------------

  const prefsPath = join(app.getPath("userData"), "preferences.json");
  const defaultPrefs = { theme: "system", language: "en", sidebarOpen: true };

  ipcMain.handle("preferences:get", () => {
    return readJsonFile(prefsPath, defaultPrefs);
  });

  ipcMain.handle("preferences:set", (_event, prefs: Record<string, unknown>) => {
    const current = readJsonFile(prefsPath, defaultPrefs);
    writeJsonFile(prefsPath, { ...current, ...prefs });
    // Apply proxy when proxyUrl preference changes
    if ("proxyUrl" in prefs) {
      applyProxy((prefs.proxyUrl as string) || null);
    }
    // Sync global system prompt to runtime
    if ("globalSystemPrompt" in prefs) {
      try {
        runtime?.setGlobalSystemPrompt((prefs.globalSystemPrompt as string) || "");
      } catch {
        // runtime may not be initialized
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Proxy (runtime application)
  // ---------------------------------------------------------------------------

  ipcMain.handle("proxy:apply", (_event, url: string | null) => {
    applyProxy(url || null);
  });

  // ---------------------------------------------------------------------------
  // Tool Approval (renderer responds to approval requests)
  // ---------------------------------------------------------------------------

  ipcMain.handle(
    "tool:respondApproval",
    (_event, conversationId: string, approvalId: string, approved: boolean) => {
      try {
        runtime?.resolveToolApproval(conversationId, approvalId, approved);
      } catch (err) {
        console.error("[Desktop] respondApproval failed:", err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Skills (JSON file persistence + API proxy)
  // ---------------------------------------------------------------------------

  const skillsPath = join(resolvedDataDir, "skills.json");

  ipcMain.handle("skills:search", async (_event, query: string, tag?: string, perPage?: number) => {
    try {
      const result = await searchSkills(query, tag, perPage);
      return result;
    } catch (err) {
      console.error("[Skills] Search failed:", err);
      throw err;
    }
  });

  ipcMain.handle("skills:listInstalled", () => {
    return readJsonFile<SkillDefinition[]>(skillsPath, []);
  });

  ipcMain.handle("skills:install", (_event, skill: SkillDefinition) => {
    const skills = readJsonFile<SkillDefinition[]>(skillsPath, []);
    const idx = skills.findIndex((s) => s.id === skill.id);
    if (idx >= 0) {
      skills[idx] = skill;
    } else {
      skills.push(skill);
    }
    writeJsonFile(skillsPath, skills);
    runtime.setInstalledSkills(skills);
  });

  ipcMain.handle("skills:uninstall", (_event, id: string) => {
    const skills = readJsonFile<SkillDefinition[]>(skillsPath, []);
    const updated = skills.filter((s) => s.id !== id);
    writeJsonFile(skillsPath, updated);
    runtime.setInstalledSkills(updated);
  });

  ipcMain.handle("skills:getEnabled", async (_event, conversationId: string) => {
    return runtime.getConversationEnabledSkills(conversationId);
  });

  ipcMain.handle(
    "skills:setEnabled",
    async (_event, conversationId: string, skillIds: string[]) => {
      return runtime.setConversationEnabledSkills(conversationId, skillIds);
    },
  );

  // ---------------------------------------------------------------------------
  // Voice — Whisper transcription
  // ---------------------------------------------------------------------------

  ipcMain.handle(
    "voice:transcribe",
    async (_event, audioBuffer: ArrayBuffer, language?: string) => {
      try {
        // Read dedicated STT settings from user preferences first.
        // If the user configured sttApiUrl + sttApiKey, use those directly
        // (supports OpenAI, Groq, local Whisper, or any compatible endpoint).
        const prefs = readJsonFile<Record<string, unknown>>(prefsPath, {});
        const voicePrefs = (prefs.voice ?? {}) as {
          sttApiUrl?: string;
          sttApiKey?: string;
        };

        let apiUrl: string;
        let apiKey: string;

        if (voicePrefs.sttApiUrl && voicePrefs.sttApiKey) {
          // User has dedicated STT settings — use them directly
          apiUrl = voicePrefs.sttApiUrl.replace(/\/+$/, "");
          apiKey = voicePrefs.sttApiKey;
          console.log("[Voice] Using dedicated STT endpoint:", apiUrl);
        } else {
          // Fall back to auto-detecting from providers
          const providers = readJsonFile<DesktopProviderConfig[]>(providersPath, []);

          const isDirectOpenAI = (p: DesktopProviderConfig): boolean =>
            !!p.apiKey && (!p.baseUrl || p.baseUrl.includes("api.openai.com"));

          const provider =
            providers.find((p) => isDirectOpenAI(p)) ||
            providers.find((p) => !!p.apiKey && (p.type === "openai" || p.type === "custom"));

          if (!provider) {
            return {
              error:
                "No STT API configured. Go to Settings → Voice to set up a Whisper-compatible endpoint (OpenAI, Groq, etc.).",
            };
          }

          apiUrl = (provider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
          apiKey = provider.apiKey;
          console.log("[Voice] Auto-detected provider:", provider.name, "| baseUrl:", apiUrl);
        }

        const fullUrl = `${apiUrl}/audio/transcriptions`;

        // Build multipart/form-data body
        const boundary = `----FormBoundary${Date.now().toString(36)}`;
        const CRLF = "\r\n";
        const audioBuf = Buffer.from(audioBuffer);

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

        console.log("[Voice] POST", fullUrl, "| audio size:", audioBuf.byteLength, "bytes");

        const resp = await net.fetch(fullUrl, {
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
        } else if (resp.status === 405) {
          console.error("[Voice] 405 from", fullUrl);
          return {
            error:
              "This endpoint does not support Whisper. Configure a compatible STT API in Settings → Voice (e.g. api.openai.com or api.groq.com).",
          };
        } else {
          console.error("[Voice] Whisper API error:", resp.status, respText);
          return { error: `Transcription failed (${resp.status})` };
        }
      } catch (err) {
        console.error("[Voice] Transcription failed:", err);
        return { error: err instanceof Error ? err.message : "Transcription failed" };
      }
    },
  );
}
