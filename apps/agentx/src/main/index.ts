import { app, BrowserWindow, shell, ipcMain, Menu } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { initAndRegisterHandlers } from "./ipc/handlers";

let mainWindow: BrowserWindow | null = null;

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
              { role: "quit" as const },
            ],
          },
        ]
      : []),
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
  // Initialize runtime + register IPC handlers. Errors are caught internally
  // so createWindow() always runs.
  await initAndRegisterHandlers();

  createAppMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
