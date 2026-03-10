import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Menu,
  Tray,
  protocol,
  net,
  globalShortcut,
  dialog,
  nativeImage,
} from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { is } from "@electron-toolkit/utils";
import { initAndRegisterHandlers } from "./ipc/handlers";
import { shutdownDesktopRuntime } from "./ipc/desktop.handlers";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Custom protocol for serving local files to the renderer.
// In dev mode the renderer runs on http://localhost, so file:// URLs are
// cross-origin and blocked by Chromium.  "local-file://" goes through the
// main process which can read any file via net.fetch("file://…").
// Must be called before app.whenReady().
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  { scheme: "local-file", privileges: { stream: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isShowingQuitDialog = false;

// ---------------------------------------------------------------------------
// Tray icon – keeps the app accessible when the window is hidden.
// ---------------------------------------------------------------------------
function getTrayIconPath(): string {
  if (is.dev) {
    return join(__dirname, "../../resources/icon.png");
  }
  return join(process.resourcesPath, "icon.png");
}

function showAndFocus(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showAndSend(channel: string): void {
  showAndFocus();
  mainWindow?.webContents.send(channel);
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getTrayIconPath()).resize({ width: 18, height: 18 });
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip("AgentX");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示 AgentX",
      click: () => showAndFocus(),
    },
    { type: "separator" },
    {
      label: "新建对话",
      accelerator: "CmdOrCtrl+N",
      click: () => showAndSend("shortcut:new-conversation"),
    },
    {
      label: "搜索",
      accelerator: "CmdOrCtrl+K",
      click: () => showAndSend("shortcut:search"),
    },
    { type: "separator" },
    {
      label: "设置...",
      accelerator: "CmdOrCtrl+,",
      click: () => showAndSend("shortcut:settings"),
    },
    { type: "separator" },
    {
      label: "退出 AgentX",
      accelerator: "CmdOrCtrl+Q",
      click: () => confirmQuit(),
    },
  ]);
  tray.setContextMenu(contextMenu);

  // Double-click tray icon to show window (Windows/Linux)
  tray.on("double-click", () => showAndFocus());
}

// ---------------------------------------------------------------------------
// Quit confirmation – warns the user that scheduled tasks will stop.
// ---------------------------------------------------------------------------
async function confirmQuit(): Promise<void> {
  if (isShowingQuitDialog) return;
  isShowingQuitDialog = true;

  try {
    // Show window if hidden so the dialog is visible
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }

    const { response } = await dialog.showMessageBox(
      mainWindow ?? (undefined as unknown as BrowserWindow),
      {
        type: "warning",
        buttons: ["取消", "退出"],
        defaultId: 0,
        cancelId: 0,
        title: "确认退出",
        message: "确定要退出 AgentX 吗？",
        detail: "退出后，所有定时任务将会停止运行。",
      },
    );

    if (response === 1) {
      isQuitting = true;
      app.quit();
    }
  } finally {
    isShowingQuitDialog = false;
  }
}

// ---------------------------------------------------------------------------
// Application menu – replaces Electron's default menu to remove browser-
// specific items (Reload, Force Reload, DevTools, View Source, etc.) and
// their associated keyboard shortcuts.
// ---------------------------------------------------------------------------
function createAppMenu(): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              {
                label: "Quit AgentX",
                accelerator: "CmdOrCtrl+Q",
                click: () => confirmQuit(),
              },
            ],
          },
        ]
      : []),
    // File – app actions
    {
      label: "File",
      submenu: [
        {
          label: "New Conversation",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("shortcut:new-conversation"),
        },
        {
          label: "Search",
          accelerator: "CmdOrCtrl+K",
          click: () => mainWindow?.webContents.send("shortcut:search"),
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => mainWindow?.webContents.send("shortcut:settings"),
        },
      ],
    },
    // Edit – keep standard text-editing shortcuts
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "selectAll" },
      ],
    },
    // View – zoom & fullscreen only; NO reload / devtools (except in dev)
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(is.dev ? [{ type: "separator" as const }, { role: "toggleDevTools" as const }] : []),
      ],
    },
    // Window
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0b0f1a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Hide to tray instead of closing – the app keeps running in the background.
  // Only actually close when the user confirms quit via Ctrl+Q / Cmd+Q.
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // -----------------------------------------------------------------------
  // Prevent the renderer from navigating away from the app (e.g. by
  // dragging a link into the window or a script triggering location change).
  // External URLs are opened in the default browser instead.
  // -----------------------------------------------------------------------
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (
      is.dev &&
      process.env.ELECTRON_RENDERER_URL &&
      url.startsWith(process.env.ELECTRON_RENDERER_URL)
    ) {
      return; // allow HMR / dev server navigation
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  // -----------------------------------------------------------------------
  // Block Chromium built-in keyboard shortcuts that bypass the app menu.
  // The custom menu already removes Reload / Force-Reload / DevTools
  // shortcuts, but Chromium still responds to F5, Ctrl+Shift+I, etc.
  // -----------------------------------------------------------------------
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // Only care about keyDown
    if (input.type !== "keyDown") return;

    const mod = process.platform === "darwin" ? input.meta : input.control;
    const key = input.key.toLowerCase();

    // --- Modifier + key combos ---
    if (mod) {
      // Refresh: Cmd/Ctrl+R, Cmd/Ctrl+Shift+R
      if (key === "r") return event.preventDefault();
      // Print: Cmd/Ctrl+P
      if (key === "p") return event.preventDefault();
      // Save page: Cmd/Ctrl+S
      if (key === "s") return event.preventDefault();
      // Find: Cmd/Ctrl+F  (browser find-bar looks out of place)
      if (key === "f") return event.preventDefault();
      // Find next/prev: Cmd/Ctrl+G, Cmd/Ctrl+Shift+G
      if (key === "g") return event.preventDefault();
      // View source: Cmd/Ctrl+U
      if (key === "u") return event.preventDefault();
      // Downloads: Cmd/Ctrl+J (Windows/Linux)
      if (key === "j" && !is.dev) return event.preventDefault();
      // DevTools: Cmd/Ctrl+Shift+I  (allow in dev)
      if (key === "i" && input.shift && !is.dev) return event.preventDefault();
    }

    // --- Function keys ---
    // F5 / Ctrl+F5 / Shift+F5: Refresh
    if (input.key === "F5") return event.preventDefault();
    // F7: Caret browsing
    if (input.key === "F7") return event.preventDefault();
    // F12: DevTools (allow in dev)
    if (input.key === "F12" && !is.dev) return event.preventDefault();
  });

  // -----------------------------------------------------------------------
  // Disable the default Chromium right-click context menu in production.
  // In dev mode we keep it so "Inspect Element" remains accessible.
  // -----------------------------------------------------------------------
  if (!is.dev) {
    mainWindow.webContents.on("context-menu", (event) => {
      event.preventDefault();
    });
  }

  // Load renderer
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Window controls
ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});
ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

app.whenReady().then(async () => {
  // Serve local files via custom protocol (see registerSchemesAsPrivileged above)
  protocol.handle("local-file", (request) => {
    // Convert local-file://… → file://… and let Chromium serve it with correct MIME
    return net.fetch(request.url.replace("local-file://", "file://"));
  });

  // Initialize runtime + register IPC handlers. Errors are caught internally
  // so createWindow() always runs.
  await initAndRegisterHandlers();

  createAppMenu();
  createTray();
  createWindow();

  // Global shortcut: Option+Space (macOS) / Alt+Space (others) to show/focus window
  const globalKey = process.platform === "darwin" ? "Alt+Space" : "Alt+Space";
  globalShortcut.register(globalKey, () => showAndFocus());

  // Show existing hidden window on macOS dock click
  app.on("activate", () => {
    if (mainWindow) {
      showAndFocus();
    } else {
      createWindow();
    }
  });
});

// Intercept quit from external sources (e.g. dock right-click → Quit on macOS)
app.on("before-quit", (event) => {
  if (!isQuitting) {
    event.preventDefault();
    confirmQuit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  shutdownDesktopRuntime().catch((err) => {
    console.error("[App] Shutdown error:", err);
  });
});

// App lives in the tray – never quit on window close.
app.on("window-all-closed", () => {
  // no-op: keep the app running in the background
});
