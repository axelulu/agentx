import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { execFileSync } from "child_process";
import type { ProviderConfig } from "@agentx/runtime";
import { readJsonFile, writeJsonFile, type NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

export interface MacNotification {
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

export interface NIConfig {
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

export const NI_DEFAULT_CONFIG: NIConfig = {
  enabled: false,
  pollingIntervalMs: 30000,
  autoClassify: true,
  rules: [],
};

// Core Data timestamp epoch: 2001-01-01T00:00:00Z
const CORE_DATA_EPOCH = 978307200;

const APP_NAME_CACHE: Record<string, string> = {};

function resolveAppName(bundleId: string): string {
  if (APP_NAME_CACHE[bundleId]) return APP_NAME_CACHE[bundleId]!;

  const parts = bundleId.split(".");
  let name = parts[parts.length - 1] || bundleId;

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
    const dbPath = join(homedir(), "Library/Group Containers/group.com.apple.usernoted/db2/db");

    if (!existsSync(dbPath)) {
      console.error("[NI] Notification DB not found at:", dbPath);
      return [];
    }

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

      let title = "";
      let body = "";
      let subtitle = "";

      try {
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
        continue;
      }

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

  if (unclassified.length === 0) return notifications;

  try {
    const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
    const activeProvider = providers.find((p) => p.isActive) || providers[0];
    if (!activeProvider) {
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

  for (const n of unclassified) {
    if (!n.category) n.category = "normal";
  }

  return notifications;
}

export interface NIState {
  pollingTimer: ReturnType<typeof setInterval> | null;
  lastSeenId: string;
}

export function createNIPolling(
  niConfigPath: string,
  niReadIdsPath: string,
  providersPath: string,
  notify: NotifyFn,
): { start: () => void; stop: () => void; state: NIState } {
  const niState: NIState = { pollingTimer: null, lastSeenId: "" };

  function start() {
    if (niState.pollingTimer) return;
    const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
    const interval = Math.max(10000, config.pollingIntervalMs || 30000);

    console.error(`[NI] Starting polling every ${interval / 1000}s`);

    const poll = async () => {
      try {
        const raw = readMacOSNotifications(50);
        if (raw.length === 0) return;

        const newestId = raw[0]?.id || "";
        if (newestId === niState.lastSeenId) return;
        niState.lastSeenId = newestId;

        const readIds = readJsonFile<string[]>(niReadIdsPath, []);
        const readSet = new Set(readIds);
        for (const n of raw) {
          n.read = readSet.has(n.id);
        }

        const currentConfig = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
        let notifications = raw;
        if (currentConfig.autoClassify) {
          notifications = await classifyNotifications(raw, providersPath, currentConfig.rules);
        }

        notify("ni:update", notifications);

        const unreadUrgent = notifications.filter((n) => n.category === "urgent" && !n.read);
        if (unreadUrgent.length > 0) {
          notify("notification:show", {
            title: `${unreadUrgent.length} urgent notification${unreadUrgent.length > 1 ? "s" : ""}`,
            body:
              unreadUrgent[0]!.title + (unreadUrgent[0]!.body ? `: ${unreadUrgent[0]!.body}` : ""),
          });
        }
      } catch (err) {
        console.error("[NI] Poll error:", err);
      }
    };

    poll();
    niState.pollingTimer = setInterval(poll, interval);
  }

  function stop() {
    if (niState.pollingTimer) {
      clearInterval(niState.pollingTimer);
      niState.pollingTimer = null;
      console.error("[NI] Polling stopped");
    }
  }

  return { start, stop, state: niState };
}

export function registerNotificationHandlers(
  handlers: HandlerMap,
  niConfigPath: string,
  niReadIdsPath: string,
  providersPath: string,
  niPolling: { start: () => void; stop: () => void },
): void {
  handlers["ni:getConfig"] = () => readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
  handlers["ni:setConfig"] = (config: NIConfig) => {
    writeJsonFile(niConfigPath, config);
    if (config.enabled) {
      niPolling.start();
    } else {
      niPolling.stop();
    }
  };
  handlers["ni:fetch"] = () => {
    const raw = readMacOSNotifications(100);
    const readIds = readJsonFile<string[]>(niReadIdsPath, []);
    const readSet = new Set(readIds);
    for (const n of raw) {
      n.read = readSet.has(n.id);
    }
    return raw;
  };
  handlers["ni:classify"] = async (notifs: MacNotification[]) => {
    const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
    return await classifyNotifications(notifs, providersPath, config.rules);
  };
  handlers["ni:start"] = () => {
    const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
    config.enabled = true;
    writeJsonFile(niConfigPath, config);
    niPolling.start();
  };
  handlers["ni:stop"] = () => {
    const config = readJsonFile<NIConfig>(niConfigPath, NI_DEFAULT_CONFIG);
    config.enabled = false;
    writeJsonFile(niConfigPath, config);
    niPolling.stop();
  };
  handlers["ni:markRead"] = (ids: string[]) => {
    const existing = readJsonFile<string[]>(niReadIdsPath, []);
    const set = new Set(existing);
    for (const id of ids) set.add(id);
    const arr = Array.from(set).slice(-500);
    writeJsonFile(niReadIdsPath, arr);
  };

  handlers["notifications:config"] = () => null;
}
