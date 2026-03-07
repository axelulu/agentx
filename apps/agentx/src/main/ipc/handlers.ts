import { registerAIHandlers } from "./ai.handlers";
import { registerStoreHandlers } from "./store.handlers";
import { registerFSHandlers } from "./fs.handlers";

export function registerAllHandlers(): void {
  registerAIHandlers();
  registerStoreHandlers();
  registerFSHandlers();
}
