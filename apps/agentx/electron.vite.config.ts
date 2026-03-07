import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          "@workspace/l10n",
          "@workspace/desktop",
          "@workspace/agent",
          "@workspace/toolkit",
          "@workspace/context",
        ],
      }),
    ],
    resolve: {
      alias: {
        "@main": resolve("src/main"),
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@workspace/l10n"],
      }),
    ],
    resolve: {
      alias: {
        "@preload": resolve("src/preload"),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
      },
    },
  },
});
