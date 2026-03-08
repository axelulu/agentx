import { ipcMain, dialog } from "electron";
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
}
