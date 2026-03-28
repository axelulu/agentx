import { useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/slices/store";
import { createNewConversation, addUserMessage } from "@/slices/chatSlice";
import { openTab } from "@/slices/uiSlice";

const actionPrompts: Record<string, (files: string[]) => string> = {
  analyze: (files) => {
    const fileList = files.map((f) => `- ${f}`).join("\n");
    return `Please analyze the following file(s) in detail. Provide insights on structure, quality, potential issues, and suggestions for improvement:\n\n${fileList}`;
  },
  summarize: (files) => {
    const fileList = files.map((f) => `- ${f}`).join("\n");
    return `Please read and summarize the following file(s). Provide a concise overview of the content, key points, and purpose:\n\n${fileList}`;
  },
  rename: (files) => {
    const fileList = files.map((f) => `- ${f}`).join("\n");
    return `Please suggest better file names for the following file(s) based on their content. Explain your reasoning and provide rename commands:\n\n${fileList}`;
  },
};

/**
 * Listens for Finder context menu actions and creates conversations with pre-built prompts.
 */
export function useFinderAction() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const unlisten = window.api.finder.onAction(async (payload) => {
      const { action, files } = payload;
      if (!files || files.length === 0) return;

      const promptBuilder = actionPrompts[action];
      if (!promptBuilder) {
        console.warn("[FinderAction] Unknown action:", action);
        return;
      }

      const prompt = promptBuilder(files);

      try {
        // Create a new conversation
        const conv = await dispatch(createNewConversation()).unwrap();
        dispatch(openTab(conv.id));

        // Add the user message
        dispatch(addUserMessage({ conversationId: conv.id, content: prompt }));

        // Send to agent
        await window.api.agent.send(conv.id, prompt);
        await window.api.agent.subscribe(conv.id);
      } catch (e) {
        console.error("[FinderAction] Failed to process action:", e);
      }
    });

    return unlisten;
  }, [dispatch]);
}
