import { useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/slices/store";
import { createNewConversation, addUserMessage } from "@/slices/chatSlice";
import { openTab } from "@/slices/uiSlice";

interface SharedItem {
  type: "text" | "url" | "image" | "file";
  text?: string;
  url?: string;
  path?: string;
  name?: string;
}

interface ShareAction {
  timestamp: number;
  items: SharedItem[];
}

function getMimeType(name?: string): string {
  if (!name) return "image/png";
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

/**
 * Build a user message from shared items.
 * For images, reads the file and converts to base64 ContentPart.
 */
async function buildContentFromItems(
  items: SharedItem[],
): Promise<{ content: string | ContentPart[] }> {
  const textParts: string[] = [];
  const imageParts: ContentPart[] = [];

  for (const item of items) {
    switch (item.type) {
      case "text":
        if (item.text) textParts.push(item.text);
        break;
      case "url":
        if (item.url) textParts.push(item.url);
        break;
      case "image":
        if (item.path) {
          try {
            const result = await window.api.fs.readFileBase64(item.path);
            if (result) {
              imageParts.push({
                type: "image",
                data: result.data,
                mimeType: result.mimeType || getMimeType(item.name),
              });
            }
          } catch {
            // Fallback: mention the file path
            textParts.push(`[Image: ${item.path}]`);
          }
        }
        break;
      case "file":
        if (item.path) {
          textParts.push(`[File: ${item.path}]`);
        }
        break;
    }
  }

  if (textParts.length === 0 && imageParts.length === 0) {
    return { content: "I shared some content with you. Please take a look." };
  }

  const prompt = textParts.join("\n\n");

  // If we have images, build ContentPart array
  if (imageParts.length > 0) {
    const parts: ContentPart[] = [];
    if (prompt) parts.push({ type: "text", text: prompt });
    parts.push(...imageParts);
    return { content: parts };
  }

  return { content: prompt };
}

/**
 * Listens for shared content from the macOS Share Extension.
 * When content is shared, creates a new conversation and sends it to the agent.
 */
export function useShareAction() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const unlisten = window.api.share.onAction(async (payload) => {
      const items = payload.items as SharedItem[];
      if (!items || items.length === 0) return;

      try {
        const { content } = await buildContentFromItems(items);

        // Create a new conversation
        const conv = await dispatch(createNewConversation()).unwrap();
        dispatch(openTab(conv.id));

        // Add the user message
        dispatch(addUserMessage({ conversationId: conv.id, content }));

        // Send to agent
        await window.api.agent.send(conv.id, content);
        await window.api.agent.subscribe(conv.id);
      } catch (e) {
        console.error("[ShareAction] Failed to process shared content:", e);
      }
    });

    return unlisten;
  }, [dispatch]);
}
