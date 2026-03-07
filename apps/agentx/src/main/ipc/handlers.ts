import { initDesktopRuntime, registerDesktopHandlers } from "./desktop.handlers";
import { registerFSHandlers } from "./fs.handlers";

export async function initAndRegisterHandlers(): Promise<void> {
  try {
    await initDesktopRuntime();
  } catch (err) {
    console.error(
      "[Handlers] DesktopRuntime init failed, app will start with limited functionality:",
      err,
    );
  }
  // Always register IPC handlers and FS handlers even if runtime init failed,
  // so the window opens and can show an appropriate error state.
  registerDesktopHandlers();
  registerFSHandlers();
}
