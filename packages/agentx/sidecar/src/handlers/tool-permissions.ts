import type { AgentRuntime, ToolPermissions } from "@agentx/runtime";
import { SingletonStore, type NotifyFn } from "../stores";
import type { HandlerMap } from "./register-handlers";

export const DEFAULT_TOOL_PERMS: ToolPermissions = {
  approvalMode: "smart",
  fileRead: true,
  fileWrite: true,
  shellExecute: true,
  mcpCall: true,
  allowedPaths: [],
};

export function createToolPermissionsStore(
  filePath: string,
  notify: NotifyFn,
  runtime: AgentRuntime,
): SingletonStore<ToolPermissions> {
  return new SingletonStore<ToolPermissions>(
    filePath,
    notify,
    "toolPermissions",
    DEFAULT_TOOL_PERMS,
    (value) => {
      try {
        runtime?.setToolPermissions(value);
      } catch (err) {
        console.error("[Sidecar] Failed to sync tool permissions:", err);
      }
    },
  );
}

export function registerToolPermissionsHandlers(
  handlers: HandlerMap,
  store: SingletonStore<ToolPermissions>,
): void {
  handlers["toolPermissions:get"] = () => store.get();
  handlers["toolPermissions:set"] = (permissions: ToolPermissions) => {
    store.set(permissions);
  };
}
