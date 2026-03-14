import { config } from "@agentx/eslint-config/react-internal";

export default [
  ...config,
  {
    ignores: ["out/", "dist/", "release/"],
  },
];
