import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/i18n";
import { ContextBarPanel } from "@/components/contextbar/ContextBarPanel";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContextBarPanel />
  </React.StrictMode>,
);
