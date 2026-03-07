#!/usr/bin/env node

import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 动态导入TypeScript模块
async function runCLI() {
  try {
    // 使用tsx来执行TypeScript文件
    const { spawn } = await import("child_process");
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const args = process.argv.slice(2);

    const child = spawn("npx", ["tsx", cliPath, ...args], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      process.exit(code);
    });

    child.on("error", (error) => {
      console.error("Error: tsx is not available. Please install it:");
      console.error("npm install -g tsx");
      console.error("or");
      console.error("npm install --save-dev tsx");
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to run CLI:", error);
    process.exit(1);
  }
}

runCLI();
