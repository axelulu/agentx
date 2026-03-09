import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import { readFile, writeFile, stat } from "fs/promises";

export function registerFSHandlers(): void {
  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    const content = await readFile(filePath, "utf-8");
    return content;
  });

  ipcMain.handle("fs:writeFile", async (_event, filePath: string, content: string) => {
    await writeFile(filePath, content, "utf-8");
    return true;
  });

  ipcMain.handle(
    "fs:selectFile",
    async (_event, options?: { filters?: Electron.FileFilter[]; multi?: boolean }) => {
      const result = await dialog.showOpenDialog({
        properties: [
          "openFile",
          "openDirectory",
          ...(options?.multi ? (["multiSelections"] as const) : []),
        ],
        filters: options?.filters,
      });

      if (result.canceled) return null;
      return result.filePaths;
    },
  );

  ipcMain.handle("fs:stat", async (_event, filePath: string) => {
    try {
      const info = await stat(filePath);
      return { size: info.size, isDirectory: info.isDirectory(), isFile: info.isFile() };
    } catch {
      return null;
    }
  });

  ipcMain.handle("fs:selectDirectory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("fs:openPath", async (_event, filePath: string) => {
    try {
      const errorMessage = await shell.openPath(filePath);
      return { success: !errorMessage, error: errorMessage || null };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("fs:showItemInFolder", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  // -------------------------------------------------------------------------
  // Export-related handlers
  // -------------------------------------------------------------------------

  ipcMain.handle(
    "fs:showSaveDialog",
    async (
      _event,
      options: { defaultPath?: string; filters?: Electron.FileFilter[]; title?: string },
    ) => {
      const result = await dialog.showSaveDialog({
        title: options.title,
        defaultPath: options.defaultPath,
        filters: options.filters,
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    },
  );

  ipcMain.handle("fs:writeFileBinary", async (_event, filePath: string, base64Data: string) => {
    await writeFile(filePath, Buffer.from(base64Data, "base64"));
    return true;
  });

  ipcMain.handle("export:printToPDF", async (_event, html: string) => {
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { offscreen: true },
    });

    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      // Small delay for rendering
      await new Promise((resolve) => setTimeout(resolve, 300));
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        margins: { marginType: "default" },
      });
      return Buffer.from(pdfBuffer).toString("base64");
    } finally {
      win.destroy();
    }
  });
}
