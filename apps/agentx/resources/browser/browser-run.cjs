#!/usr/bin/env node
"use strict";

/**
 * browser-run.cjs — Browser automation CLI for AgentX
 *
 * Architecture:
 * Each `shell_run` invocation is a separate short-lived Node.js process.
 * A persistent background server process holds the Playwright browser alive.
 *
 * - `launch`: Spawns a detached server process that calls chromium.launch()
 *   and starts an HTTP server on a random port. Saves port + PIDs to a session
 *   file. The server process stays alive, keeping the browser open.
 *
 * - Other commands (goto, click, type, ...): Read port from session file,
 *   send HTTP POST to the server. The server executes the Playwright command
 *   on its persistent page object and returns the JSON result.
 *
 * - `close`: Sends HTTP close command to the server. The server closes the
 *   browser via Playwright and exits. Falls back to SIGTERM if HTTP fails.
 */

// In packaged Electron apps running with ELECTRON_RUN_AS_NODE=1, NODE_PATH
// is not always respected by the module system. Explicitly inject the app's
// node_modules into this module's search paths so require() can resolve
// dependencies like playwright-core that are bundled inside the asar.
if (process.env.AGENTX_NODE_MODULES) {
  module.paths.unshift(process.env.AGENTX_NODE_MODULES);
}

const { chromium } = require("playwright-core");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------------------------------------------------------------------------
// Session state file
// ---------------------------------------------------------------------------

const SESSION_FILE = path.join(os.tmpdir(), "agentx-browser-session.json");

function readSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    }
  } catch {
    // corrupted — ignore
  }
  return null;
}

function writeSession(data) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function deleteSession() {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {
    // already gone
  }
}

// ---------------------------------------------------------------------------
// Browser detection — find system Chrome/Edge/Chromium
// ---------------------------------------------------------------------------

function findBrowser() {
  const platform = process.platform;
  const paths = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ],
  };

  const candidates = paths[platform] || [];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Output helpers — always JSON to stdout
// ---------------------------------------------------------------------------

function ok(data) {
  console.log(JSON.stringify({ ok: true, ...data }));
  process.exit(0);
}

function fail(error) {
  console.log(JSON.stringify({ ok: false, error: String(error) }));
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// HTTP client — send command to the persistent server
// ---------------------------------------------------------------------------

function sendCommand(port, cmd, params) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ cmd, ...params });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 55000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid response from browser server"));
          }
        });
      },
    );
    req.on("error", (err) => {
      reject(new Error("Browser server not reachable. Run 'launch' first. (" + err.message + ")"));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Command timed out"));
    });
    req.write(postData);
    req.end();
  });
}

/** Poll session file until the server writes it (or timeout). */
async function waitForSession(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = readSession();
    if (session) {
      if (session.error) {
        throw new Error("Browser launch failed: " + session.error);
      }
      if (session.port) {
        return session;
      }
    }
    await sleep(150);
  }
  throw new Error("Timeout waiting for browser server to start");
}

/** Send command, output result, exit. */
async function execCommand(cmd, params) {
  const session = readSession();
  if (!session || !session.port) {
    fail("No browser session. Run 'launch' first.");
    return;
  }
  let result;
  try {
    result = await sendCommand(session.port, cmd, params);
  } catch (err) {
    // Server unreachable — clean up stale session
    deleteSession();
    fail(err.message);
    return;
  }
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

// ===================================================================
// CLIENT-SIDE COMMANDS — parse CLI args, forward to server via HTTP
// ===================================================================

async function cmdLaunch(args) {
  // Check for existing live session
  const existing = readSession();
  if (existing && existing.port) {
    try {
      const status = await sendCommand(existing.port, "status", {});
      if (status.ok && status.alive) {
        // Navigate if URL provided
        const url = args.find((a) => !a.startsWith("--"));
        if (url) {
          const nav = await sendCommand(existing.port, "goto", { url });
          ok({
            message: "Reconnected to existing browser",
            title: nav.title,
            url: nav.url,
          });
        } else {
          ok({
            message: "Reconnected to existing browser",
            title: status.title,
            url: status.url,
          });
        }
        return;
      }
    } catch {
      deleteSession();
    }
  }

  const executablePath = findBrowser();
  if (!executablePath) {
    fail("No Chrome/Edge/Chromium found. Please install a Chromium-based browser.");
    return;
  }

  // Clean any stale session before launching
  deleteSession();

  // Build server args
  const serverArgs = ["--server", executablePath];
  if (args.includes("--headless")) serverArgs.push("--headless");

  // Spawn detached server process — it will call chromium.launch() and
  // start an HTTP server, then write the session file when ready.
  // ELECTRON_RUN_AS_NODE=1 ensures the Electron binary acts as plain
  // Node.js for this child process (must NOT be set globally).
  const child = spawn(process.execPath, [__filename, ...serverArgs], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  child.unref();

  // Wait for server to be ready (polls session file)
  let session;
  try {
    session = await waitForSession(20000);
  } catch (err) {
    fail(err.message);
    return;
  }

  // Navigate if URL provided
  const url = args.find((a) => !a.startsWith("--"));
  if (url) {
    try {
      await sendCommand(session.port, "goto", { url });
    } catch {
      // navigation failed, but browser is launched
    }
  }

  // Get current status
  let status;
  try {
    status = await sendCommand(session.port, "status", {});
  } catch {
    status = { title: "", url: "about:blank" };
  }

  ok({
    message: "Browser launched",
    title: status.title || "",
    url: status.url || "about:blank",
    pid: session.pid,
  });
}

async function cmdGoto(args) {
  const url = args[0];
  if (!url) fail("Usage: goto <url>");
  await execCommand("goto", { url });
}

async function cmdClick(args) {
  const selector = args[0];
  if (!selector) fail("Usage: click <selector>");
  await execCommand("click", { selector });
}

async function cmdType(args) {
  const selector = args[0];
  const text = args.slice(1).join(" ");
  if (!selector || !text) fail("Usage: type <selector> <text>");
  await execCommand("type", { selector, text });
}

async function cmdScreenshot(args) {
  const p = args[0] || "";
  await execCommand("screenshot", { path: p });
}

async function cmdContent(args) {
  const selector = args[0] || "";
  await execCommand("content", { selector });
}

async function cmdEvaluate(args) {
  const code = args.join(" ");
  if (!code) fail("Usage: evaluate <javascript>");
  await execCommand("evaluate", { code });
}

async function cmdWait(args) {
  const target = args[0];
  if (!target) fail("Usage: wait <selector|milliseconds>");
  await execCommand("wait", { target });
}

async function cmdSelect(args) {
  const selector = args[0];
  const value = args[1];
  if (!selector || value === undefined) fail("Usage: select <selector> <value>");
  await execCommand("select", { selector, value });
}

async function cmdScroll(args) {
  const direction = args[0];
  const amount = parseInt(args[1], 10) || 500;
  if (!direction || !["up", "down"].includes(direction)) {
    fail("Usage: scroll <up|down> [amount]");
  }
  await execCommand("scroll", { direction, amount });
}

async function cmdClose() {
  const session = readSession();
  if (!session) {
    ok({ message: "No active session" });
    return;
  }

  // Try graceful close via HTTP
  if (session.port) {
    try {
      const result = await sendCommand(session.port, "close", {});
      deleteSession();
      if (result.ok) {
        ok(result);
        return;
      }
    } catch {
      // Server not responding — force kill
    }
  }

  // Force kill server process
  if (session.pid) {
    try {
      process.kill(session.pid, "SIGTERM");
    } catch {
      // already dead
    }
  }
  // Force kill Chrome process if still running
  if (session.chromePid) {
    try {
      process.kill(session.chromePid, "SIGTERM");
    } catch {
      // already dead
    }
  }

  deleteSession();
  ok({ message: "Browser closed (forced)" });
}

async function cmdStatus() {
  const session = readSession();
  if (!session || !session.port) {
    ok({ alive: false, message: "No active session" });
    return;
  }
  try {
    const result = await sendCommand(session.port, "status", {});
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch {
    deleteSession();
    ok({ alive: false, message: "Session expired" });
  }
}

// ===================================================================
// SERVER MODE — persistent background process with Playwright browser
// ===================================================================

async function serverMode(args) {
  const executablePath = args[0];
  if (!executablePath) {
    writeSession({ error: "No browser executable path provided" });
    process.exit(1);
  }

  const headless = args.includes("--headless");

  // Launch browser using Playwright's full API
  let browser;
  try {
    browser = await chromium.launch({
      executablePath,
      headless,
    });
  } catch (err) {
    writeSession({ error: "Failed to launch browser: " + err.message });
    process.exit(1);
  }

  // Create default context and page
  const context = await browser.newContext();
  let activePage = await context.newPage();

  // Track new pages (e.g. target="_blank" links) — auto-switch to newest
  context.on("page", (newPage) => {
    activePage = newPage;
    // If the new page is closed, revert to last remaining page
    newPage.on("close", () => {
      const pages = context.pages();
      if (pages.length > 0) {
        activePage = pages[pages.length - 1];
      }
    });
  });

  // If the browser disconnects (user closed all windows), clean up
  browser.on("disconnected", () => {
    deleteSession();
    try {
      server.close();
    } catch {}
    process.exit(0);
  });

  // ----- HTTP server for receiving commands -----

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      let params;
      try {
        params = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
        return;
      }

      // Handle close command specially — respond first, then shut down
      if (params.cmd === "close") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: "Browser closed" }));
        try {
          await browser.close();
        } catch {}
        deleteSession();
        server.close();
        setTimeout(() => process.exit(0), 200);
        return;
      }

      try {
        const result = await handleCommand(params, browser, context, activePage);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  });

  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    writeSession({
      port,
      pid: process.pid,
      chromePid: null,
      launchedAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// Server-side command handler — executes Playwright operations
// ---------------------------------------------------------------------------

async function handleCommand(params, browser, context, page) {
  switch (params.cmd) {
    case "goto": {
      if (!params.url) return { ok: false, error: "Usage: goto <url>" };
      const response = await page.goto(params.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      return {
        ok: true,
        title: await page.title(),
        url: page.url(),
        status: response ? response.status() : null,
      };
    }

    case "click": {
      if (!params.selector) return { ok: false, error: "Usage: click <selector>" };
      await page.click(params.selector, { timeout: 10000 });
      return {
        ok: true,
        message: "Clicked: " + params.selector,
        title: await page.title(),
        url: page.url(),
      };
    }

    case "type": {
      if (!params.selector || params.text === undefined)
        return { ok: false, error: "Usage: type <selector> <text>" };
      await page.fill(params.selector, params.text, { timeout: 10000 });
      return { ok: true, message: "Typed into " + params.selector };
    }

    case "screenshot": {
      const outputPath =
        params.path || path.join(os.tmpdir(), "agentx-screenshot-" + Date.now() + ".png");
      await page.screenshot({ path: outputPath, fullPage: false });
      return { ok: true, path: outputPath };
    }

    case "content": {
      let text;
      if (params.selector) {
        const el = await page.$(params.selector);
        if (!el)
          return {
            ok: false,
            error: "Element not found: " + params.selector,
          };
        text = await el.innerText();
      } else {
        text = await page.innerText("body");
      }
      if (text.length > 50000) {
        text = text.slice(0, 50000) + "\n...(truncated)";
      }
      return { ok: true, title: await page.title(), url: page.url(), text };
    }

    case "evaluate": {
      if (!params.code) return { ok: false, error: "Usage: evaluate <javascript>" };
      const result = await page.evaluate(params.code);
      return { ok: true, result };
    }

    case "wait": {
      if (!params.target) return { ok: false, error: "Usage: wait <selector|milliseconds>" };
      const ms = parseInt(params.target, 10);
      if (!isNaN(ms) && String(ms) === params.target) {
        await page.waitForTimeout(ms);
        return { ok: true, message: "Waited " + ms + "ms" };
      } else {
        await page.waitForSelector(params.target, { timeout: 30000 });
        return { ok: true, message: "Element appeared: " + params.target };
      }
    }

    case "select": {
      if (!params.selector || params.value === undefined)
        return { ok: false, error: "Usage: select <selector> <value>" };
      await page.selectOption(params.selector, params.value, {
        timeout: 10000,
      });
      return {
        ok: true,
        message: 'Selected "' + params.value + '" in ' + params.selector,
      };
    }

    case "scroll": {
      if (!params.direction || !["up", "down"].includes(params.direction)) {
        return { ok: false, error: "Usage: scroll <up|down> [amount]" };
      }
      const amount = params.amount || 500;
      const delta = params.direction === "down" ? amount : -amount;
      await page.mouse.wheel(0, delta);
      return {
        ok: true,
        message: "Scrolled " + params.direction + " by " + Math.abs(delta) + "px",
      };
    }

    case "status": {
      return {
        ok: true,
        alive: true,
        title: await page.title(),
        url: page.url(),
        pages: context.pages().length,
      };
    }

    default:
      return { ok: false, error: "Unknown command: " + params.cmd };
  }
}

// ===================================================================
// Main dispatcher
// ===================================================================

async function main() {
  const [command, ...args] = process.argv.slice(2);

  // Server mode — launched as a detached background process by `launch`
  if (command === "--server") {
    await serverMode(args);
    return;
  }

  if (!command) {
    fail(
      "Usage: browser-run.cjs <command> [args]\n" +
        "Commands: launch, goto, click, type, screenshot, content, evaluate, wait, select, scroll, close, status",
    );
    return;
  }

  try {
    switch (command) {
      case "launch":
        await cmdLaunch(args);
        break;
      case "goto":
        await cmdGoto(args);
        break;
      case "click":
        await cmdClick(args);
        break;
      case "type":
        await cmdType(args);
        break;
      case "screenshot":
        await cmdScreenshot(args);
        break;
      case "content":
        await cmdContent(args);
        break;
      case "evaluate":
        await cmdEvaluate(args);
        break;
      case "wait":
        await cmdWait(args);
        break;
      case "select":
        await cmdSelect(args);
        break;
      case "scroll":
        await cmdScroll(args);
        break;
      case "close":
        await cmdClose();
        break;
      case "status":
        await cmdStatus();
        break;
      default:
        fail("Unknown command: " + command);
    }
  } catch (err) {
    fail(err.message || String(err));
  }
}

main();
