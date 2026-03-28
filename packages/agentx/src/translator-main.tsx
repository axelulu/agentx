import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/i18n";
import { TranslatorPanel } from "@/components/translator/TranslatorPanel";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TranslatorPanel />
  </React.StrictMode>,
);
