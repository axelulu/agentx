import { ipcMain } from "electron";
import Store from "electron-store";

const store = new Store({
  name: "agentx-config",
  defaults: {
    settings: {
      theme: "dark",
      language: "en",
    },
    providers: {},
    conversations: [],
  },
});

export function registerStoreHandlers(): void {
  ipcMain.handle("store:get", (_event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle("store:set", (_event, key: string, value: unknown) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle("store:delete", (_event, key: string) => {
    store.delete(key as any);
    return true;
  });

  ipcMain.handle("store:clear", () => {
    store.clear();
    return true;
  });
}
