import type { Message } from "@/slices/chatSlice";
import {
  messagesToMarkdown,
  messagesToJSON,
  messagesToHTML,
  singleMessageToMarkdown,
  singleMessageToJSON,
} from "./exportConversation";

export type ExportFormat = "markdown" | "json" | "pdf" | "agentx";

async function saveTextFile(content: string, defaultName: string, ext: string): Promise<boolean> {
  const filters: Record<string, { name: string; extensions: string[] }[]> = {
    md: [{ name: "Markdown", extensions: ["md"] }],
    json: [{ name: "JSON", extensions: ["json"] }],
    agentx: [{ name: "AgentX Conversation", extensions: ["agentx"] }],
  };

  const filePath = await window.api.fs.showSaveDialog({
    defaultPath: defaultName,
    filters: filters[ext] ?? [{ name: "All Files", extensions: ["*"] }],
  });

  if (!filePath) return false;
  await window.api.fs.writeFile(filePath, content);
  return true;
}

async function savePDF(html: string, defaultName: string): Promise<boolean> {
  const filePath = await window.api.fs.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!filePath) return false;
  const base64 = await window.api.export.printToPDF(html);
  await window.api.fs.writeFileBinary(filePath, base64);
  return true;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80);
}

export async function exportConversation(
  messages: Message[],
  title: string,
  format: ExportFormat,
): Promise<boolean> {
  const safeName = sanitizeFilename(title);

  switch (format) {
    case "markdown": {
      const md = messagesToMarkdown(messages, title);
      return saveTextFile(md, `${safeName}.md`, "md");
    }
    case "json": {
      const json = messagesToJSON(messages, title);
      return saveTextFile(json, `${safeName}.json`, "json");
    }
    case "pdf": {
      const html = messagesToHTML(messages, title);
      return savePDF(html, `${safeName}.pdf`);
    }
    case "agentx": {
      const json = messagesToJSON(messages, title);
      return saveTextFile(json, `${safeName}.agentx`, "agentx");
    }
  }
}

export async function exportSingleMessage(
  message: Message,
  format: "markdown" | "json",
): Promise<boolean> {
  const role = message.role === "user" ? "user" : "assistant";
  const ts = new Date(message.timestamp).toISOString().slice(0, 10);
  const defaultName = `message-${role}-${ts}`;

  switch (format) {
    case "markdown": {
      const md = singleMessageToMarkdown(message);
      return saveTextFile(md, `${defaultName}.md`, "md");
    }
    case "json": {
      const json = singleMessageToJSON(message);
      return saveTextFile(json, `${defaultName}.json`, "json");
    }
  }
}
