import { config } from "@agentx/eslint-config/base";

export default [
  ...config,
  {
    ignores: ["dist/", "bin/"],
  },
];
