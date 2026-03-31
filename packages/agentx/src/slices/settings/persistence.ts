/**
 * Shared persistence helpers for settings data.
 *
 * Provides localStorage backup/fallback utilities and fire-and-forget
 * IPC persistence functions used by the settingsSlice reducers.
 */

import type {
  ProviderConfig,
  KnowledgeBaseItem,
  MCPServerConfig,
  ChannelConfig,
  SkillDefinition,
  ToolPermissionsState,
} from "./types";

// ---------------------------------------------------------------------------
// localStorage backup keys
// ---------------------------------------------------------------------------

export const LS_PROVIDERS = "agentx-providers";
export const LS_PREFERENCES = "agentx-preferences";
export const LS_KB = "agentx-knowledgebase";
export const LS_MCP = "agentx-mcpservers";
export const LS_SKILLS = "agentx-skills";
export const LS_CHANNELS = "agentx-channels";
export const LS_SCHEDULED = "agentx-scheduled-tasks";
export const LS_TOOL_PERMS = "agentx-tool-permissions";

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* corrupted — ignore */
  }
  return fallback;
}

export function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function lsUpsert<T extends { id: string }>(key: string, item: T): void {
  const list = lsGet<T[]>(key, []);
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  lsSet(key, list);
}

export function lsRemove(key: string, id: string): void {
  const list = lsGet<{ id: string }[]>(key, []);
  lsSet(
    key,
    list.filter((x) => x.id !== id),
  );
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

/** Simple retry wrapper: retries once after a short delay on failure. */
export function withRetry(fn: () => Promise<unknown>, label: string): void {
  fn().catch((err: unknown) => {
    console.warn(`[${label}] Persist failed, retrying...`, err);
    setTimeout(() => {
      fn().catch((retryErr: unknown) => {
        console.error(`[${label}] Persist retry failed:`, retryErr);
      });
    }, 500);
  });
}

// ---------------------------------------------------------------------------
// Domain persistence functions
// ---------------------------------------------------------------------------

export function persistPreferences(prefs: Record<string, unknown>): void {
  const existing = lsGet<Record<string, unknown>>(LS_PREFERENCES, {});
  lsSet(LS_PREFERENCES, { ...existing, ...prefs });
  withRetry(() => window.api.preferences.set(prefs), "Preferences");
}

export function persistKBItem(item: KnowledgeBaseItem): void {
  lsUpsert(LS_KB, item);
  withRetry(() => window.api.knowledgeBase.set(item), "KB");
}

export function persistKBRemove(id: string): void {
  lsRemove(LS_KB, id);
  withRetry(() => window.api.knowledgeBase.remove(id), "KB");
}

export function persistMCPServer(config: MCPServerConfig): void {
  lsUpsert(LS_MCP, config);
  withRetry(() => window.api.mcp.set(config), "MCP");
}

export function persistMCPRemove(id: string): void {
  lsRemove(LS_MCP, id);
  withRetry(() => window.api.mcp.remove(id), "MCP");
}

export function persistProvider(config: ProviderConfig): void {
  lsUpsert(LS_PROVIDERS, config);
  withRetry(() => window.api.provider.set(config), "Provider");
}

export function persistProviderRemove(id: string): void {
  lsRemove(LS_PROVIDERS, id);
  withRetry(() => window.api.provider.remove(id), "Provider");
}

export function persistProviderSetActive(id: string): void {
  const list = lsGet<ProviderConfig[]>(LS_PROVIDERS, []);
  for (const p of list) p.isActive = p.id === id;
  lsSet(LS_PROVIDERS, list);
  withRetry(() => window.api.provider.setActive(id), "Provider");
}

export function persistSkillInstall(skill: SkillDefinition): void {
  lsUpsert(LS_SKILLS, skill);
  withRetry(() => window.api.skills.install(skill), "Skills");
}

export function persistSkillUninstall(id: string): void {
  lsRemove(LS_SKILLS, id);
  withRetry(() => window.api.skills.uninstall(id), "Skills");
}

export function persistChannel(config: ChannelConfig): void {
  lsUpsert(LS_CHANNELS, config);
  withRetry(() => window.api.channel.set(config as ChannelConfigData), "Channel");
}

export function persistChannelRemove(id: string): void {
  lsRemove(LS_CHANNELS, id);
  withRetry(() => window.api.channel.remove(id), "Channel");
}

export function persistScheduledTask(task: ScheduledTaskConfig): void {
  lsUpsert(LS_SCHEDULED, task);
  withRetry(() => window.api.scheduler.set(task), "Scheduler");
}

export function persistScheduledTaskRemove(id: string): void {
  lsRemove(LS_SCHEDULED, id);
  withRetry(() => window.api.scheduler.remove(id), "Scheduler");
}

export function persistToolPermissions(perms: ToolPermissionsState): void {
  lsSet(LS_TOOL_PERMS, perms);
  withRetry(() => window.api.toolPermissions.set(perms), "ToolPermissions");
}
