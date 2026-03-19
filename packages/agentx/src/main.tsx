import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "@/slices/store";
import { App } from "@/App";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { initBridge } from "@/lib/bridge";
import "@/lib/i18n";
import "@/styles/globals.css";

initBridge();

// Disable browser context menu (right-click reload, etc.)
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <TooltipProvider delayDuration={0}>
        <App />
      </TooltipProvider>
    </Provider>
  </React.StrictMode>,
);
