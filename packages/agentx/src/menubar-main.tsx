import React from "react";
import ReactDOM from "react-dom/client";
import { MenuBarPanel } from "@/components/menubar/MenuBarPanel";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { initBridge } from "@/lib/bridge";
import "@/lib/i18n";
import "@/styles/globals.css";

initBridge();

// Disable browser context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={0}>
      <MenuBarPanel />
    </TooltipProvider>
  </React.StrictMode>,
);
