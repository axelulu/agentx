import { initDesktopRuntime, registerDesktopHandlers } from "./desktop.handlers";
import { registerFSHandlers } from "./fs.handlers";
import { registerPermissionsHandlers } from "./permissions.handlers";

export async function initAndRegisterHandlers(): Promise<void> {
  try {
    await initDesktopRuntime();
  } catch (err) {
    console.error(
      "[Handlers] DesktopRuntime init failed, app will start with limited functionality:",
      err,
    );
  }
  // Register each handler group independently so one failure doesn't block the others
  try {
    registerDesktopHandlers();
  } catch (err) {
    console.error("[Handlers] registerDesktopHandlers failed:", err);
  }
  try {
    registerFSHandlers();
  } catch (err) {
    console.error("[Handlers] registerFSHandlers failed:", err);
  }
  try {
    registerPermissionsHandlers();
    console.log("[Handlers] Permissions handlers registered successfully");
  } catch (err) {
    console.error("[Handlers] registerPermissionsHandlers failed:", err);
  }
}
