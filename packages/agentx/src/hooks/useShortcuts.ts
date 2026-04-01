import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/slices/store";
import {
  createNewConversation,
  switchConversation,
  resetToWelcome,
  setEnabledSkills,
} from "@/slices/chatSlice";
import { toggleSettings, openTab, openSettingsSection } from "@/slices/uiSlice";

export function useShortcuts() {
  const dispatch = useDispatch<AppDispatch>();
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);

  // IPC-based shortcuts from main process
  useEffect(() => {
    // Cmd+K search is now handled natively by menu.rs → QuickChat search mode
    const unsubs = [
      window.api.shortcuts.onNewConversation(() => {
        dispatch(createNewConversation()).then((action) => {
          if (createNewConversation.fulfilled.match(action)) {
            dispatch(openTab(action.payload.id));
          }
        });
      }),
      window.api.shortcuts.onSettings(() => {
        dispatch(toggleSettings());
      }),
    ];

    // Handler for quickchat cross-window actions (called via eval from Rust)
    (window as unknown as Record<string, unknown>).__QUICKCHAT_ACTION__ = (event: string) => {
      if (event === "shortcut:settings") {
        dispatch(toggleSettings());
      } else if (event === "shortcut:new-conversation") {
        dispatch(createNewConversation()).then((action) => {
          if (createNewConversation.fulfilled.match(action)) {
            dispatch(openTab(action.payload.id));
          }
        });
      } else if (event.startsWith("skill:new:")) {
        const skillId = event.slice("skill:new:".length);
        dispatch(createNewConversation()).then((action) => {
          if (createNewConversation.fulfilled.match(action)) {
            const convId = action.payload.id;
            dispatch(openTab(convId));
            dispatch(setEnabledSkills([skillId]));
            window.api.skills.setEnabled(convId, [skillId]).catch(console.error);
          }
        });
      } else if (event.startsWith("navigate:")) {
        const conversationId = event.slice("navigate:".length);
        dispatch(openTab(conversationId));
        dispatch(switchConversation(conversationId));
      }
    };

    return () => {
      unsubs.forEach((unsub) => unsub());
      delete (window as unknown as Record<string, unknown>).__QUICKCHAT_ACTION__;
    };
  }, [dispatch]);

  // Keyboard shortcut: Cmd/Ctrl+W — close current conversation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "w" || e.key === "W") {
        if (currentConversationId) {
          e.preventDefault();
          dispatch(resetToWelcome());
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, currentConversationId]);
}
