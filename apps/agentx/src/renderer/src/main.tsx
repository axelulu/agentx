import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "@/slices/store";
import { App } from "@/App";
import { TooltipProvider } from "@/components/ui/Tooltip";
import "@/lib/i18n";
import "@/styles/globals.css";

// Detect Tauri environment and initialize bridge
if ((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
  import("@/lib/tauri-bridge").then(({ initTauriBridge }) => {
    initTauriBridge();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <TooltipProvider delayDuration={300}>
        <App />
      </TooltipProvider>
    </Provider>
  </React.StrictMode>,
);
