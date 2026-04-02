import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/i18n";
import { DynamicIslandPanel } from "@/components/island/DynamicIslandPanel";
import { initBridge } from "@/lib/bridge";
import "@/styles/globals.css";

initBridge();

// Disable browser context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DynamicIslandPanel />
  </React.StrictMode>,
);
