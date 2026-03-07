import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginNode from "eslint-plugin-node";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for Node.js backend projects.
 *
 * @type {import("eslint").Linter.Config}
 */
export const backendConfig = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
  },
  {
    plugins: {
      node: pluginNode,
      "unused-imports": unusedImports,
    },
    rules: {
      // Node.js specific rules
      "node/no-unsupported-features/es-syntax": "off", // Allow ES modules
      "node/no-missing-import": "off", // TypeScript handles this
      "node/no-unpublished-import": "off", // Allow workspace imports
      "node/no-extraneous-import": "off", // Allow workspace imports

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": "off", // 关闭原有的未使用变量规则
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off", // Allow non-null assertions

      // Import/export rules
      "unused-imports/no-unused-imports": "error", // 改为 error 级别
      "unused-imports/no-unused-vars": [
        "off",
        {
          vars: "all",
          varsIgnorePattern: "^_", // 🔥 新增：忽略 _ 开头的变量
          args: "after-used",
          argsIgnorePattern: "^_", // 保留：忽略 _ 开头的参数
        },
      ],

      // General code quality
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "warn",
      "no-debugger": "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "*.js", "*.mjs", "*.cjs"],
  },
];
