import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/l10n",
  "packages/toolkit",
  "packages/agent",
  "packages/context",
  "packages/desktop",
]);
