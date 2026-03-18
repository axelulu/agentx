#!/usr/bin/env node

/**
 * Download the agent-browser binary for the current platform and place it
 * in src-tauri/binaries/ with the correct Tauri target triple suffix.
 *
 * Usage: node scripts/download-agent-browser.mjs
 *
 * Environment variables:
 *   AGENT_BROWSER_VERSION — version to download (default: "latest")
 *   AGENT_BROWSER_SKIP    — set to "1" to skip download (CI without browser)
 */

import { execFileSync } from "node:child_process";
import { existsSync, chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binariesDir = join(__dirname, "..", "src-tauri", "binaries");

if (process.env.AGENT_BROWSER_SKIP === "1") {
  console.log("[agent-browser] Skipping download (AGENT_BROWSER_SKIP=1)");
  process.exit(0);
}

// Map Node.js platform/arch to Rust target triples (Tauri convention)
const TARGET_MAP = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-x64": "x86_64-unknown-linux-gnu",
  "linux-arm64": "aarch64-unknown-linux-gnu",
  "win32-x64": "x86_64-pc-windows-msvc",
};

const platformKey = `${process.platform}-${process.arch}`;
const targetTriple = TARGET_MAP[platformKey];

if (!targetTriple) {
  console.error(`[agent-browser] Unsupported platform: ${platformKey}`);
  process.exit(1);
}

const ext = process.platform === "win32" ? ".exe" : "";
const outputPath = join(binariesDir, `agent-browser-${targetTriple}${ext}`);

// Ensure binaries directory exists
mkdirSync(binariesDir, { recursive: true });

// Skip if binary already exists and is not a placeholder (>100 bytes)
if (existsSync(outputPath)) {
  const { size } = await import("node:fs").then((fs) => fs.promises.stat(outputPath));
  if (size > 100) {
    console.log(`[agent-browser] Binary already exists: ${outputPath}`);
    process.exit(0);
  }
}

// Strategy 1: Try cargo-binstall (fastest if available)
function tryBinstall() {
  try {
    execFileSync("cargo", ["binstall", "--help"], { stdio: "ignore" });
    console.log("[agent-browser] Installing via cargo-binstall...");
    execFileSync("cargo", ["binstall", "-y", "--no-confirm", "agent-browser"], {
      stdio: "inherit",
    });

    // Find the installed binary
    const which = process.platform === "win32" ? "where" : "which";
    const installedPath = execFileSync(which, ["agent-browser"], {
      encoding: "utf8",
    }).trim();

    if (installedPath && existsSync(installedPath)) {
      execFileSync("cp", [installedPath, outputPath]);
      chmodSync(outputPath, 0o755);
      console.log(`[agent-browser] Installed to ${outputPath}`);
      return true;
    }
  } catch {
    // Fall through
  }
  return false;
}

// Strategy 2: Try cargo install
function tryCargoInstall() {
  try {
    console.log("[agent-browser] Installing via cargo install...");
    execFileSync("cargo", ["install", "agent-browser"], { stdio: "inherit" });

    const which = process.platform === "win32" ? "where" : "which";
    const installedPath = execFileSync(which, ["agent-browser"], {
      encoding: "utf8",
    }).trim();

    if (installedPath && existsSync(installedPath)) {
      execFileSync("cp", [installedPath, outputPath]);
      chmodSync(outputPath, 0o755);
      console.log(`[agent-browser] Installed to ${outputPath}`);
      return true;
    }
  } catch {
    // Fall through
  }
  return false;
}

// Strategy 3: Check if already in PATH
function trySystemPath() {
  try {
    const which = process.platform === "win32" ? "where" : "which";
    const installedPath = execFileSync(which, ["agent-browser"], {
      encoding: "utf8",
    }).trim();

    if (installedPath && existsSync(installedPath)) {
      execFileSync("cp", [installedPath, outputPath]);
      chmodSync(outputPath, 0o755);
      console.log(`[agent-browser] Copied from system PATH: ${installedPath} -> ${outputPath}`);
      return true;
    }
  } catch {
    // Fall through
  }
  return false;
}

// Try each strategy
if (!trySystemPath() && !tryBinstall() && !tryCargoInstall()) {
  // Create a placeholder so Tauri's externalBin check passes in dev mode.
  // The actual binary is resolved at runtime via AGENTX_BROWSER_BIN env var.
  console.warn(
    "[agent-browser] Could not obtain agent-browser binary.\n" +
      "Creating placeholder for dev builds. Install it manually:\n" +
      "  cargo install agent-browser",
  );
  writeFileSync(outputPath, "#!/bin/sh\necho 'agent-browser not installed' >&2\nexit 1\n");
  chmodSync(outputPath, 0o755);
}
