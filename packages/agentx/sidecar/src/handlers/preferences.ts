import type { AgentRuntime } from "@agentx/runtime";
import { SingletonStore, type NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

const DEFAULT_PREFS = { theme: "system", language: "en", sidebarOpen: true } as Record<
  string,
  unknown
>;

export function createPreferencesStore(
  filePath: string,
  notify: NotifyFn,
): SingletonStore<Record<string, unknown>> {
  return new SingletonStore<Record<string, unknown>>(
    filePath,
    notify,
    "preferences",
    DEFAULT_PREFS,
  );
}

export function registerPreferencesHandlers(
  handlers: HandlerMap,
  store: SingletonStore<Record<string, unknown>>,
  runtime: AgentRuntime,
  applyProxy: (url: string | null) => void,
): void {
  handlers["preferences:get"] = () => store.get();
  handlers["preferences:set"] = (prefs: Record<string, unknown>) => {
    store.merge(prefs);
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
  };
}
