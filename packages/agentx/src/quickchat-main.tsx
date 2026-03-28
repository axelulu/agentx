import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/i18n";
import { CommandPalette } from "@/components/quickchat/CommandPalette";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { initBridge } from "@/lib/bridge";
import "@/styles/globals.css";

initBridge();

// Disable browser context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={0}>
      <CommandPalette />
    </TooltipProvider>
  </React.StrictMode>,
);
