import React from "react";
import ReactDOM from "react-dom/client";
import { ClipboardPanel } from "@/components/clipboard/ClipboardPanel";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClipboardPanel />
  </React.StrictMode>,
);
