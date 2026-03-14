import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/slices/store";
import { createNewConversation, switchConversation } from "@/slices/chatSlice";
import { toggleSearch, toggleSettings, closeTabAndSwitch, openTab } from "@/slices/uiSlice";

export function useShortcuts() {
  const dispatch = useDispatch<AppDispatch>();
  const openTabs = useSelector((state: RootState) => state.ui.openTabs);
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);

  // IPC-based shortcuts from main process
  useEffect(() => {
    const unsubs = [
      window.api.shortcuts.onNewConversation(() => {
        dispatch(createNewConversation()).then((action) => {
          if (createNewConversation.fulfilled.match(action)) {
            dispatch(openTab(action.payload.id));
          }
        });
      }),
      window.api.shortcuts.onSearch(() => {
        dispatch(toggleSearch());
      }),
      window.api.shortcuts.onSettings(() => {
        dispatch(toggleSettings());
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [dispatch]);

  // Keyboard shortcuts for tab management
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl+W — close current tab
      if (e.key === "w" || e.key === "W") {
        if (currentConversationId && openTabs.includes(currentConversationId)) {
          e.preventDefault();
          dispatch(closeTabAndSwitch(currentConversationId));
        }
        return;
      }

      // Cmd/Ctrl+1-9 — switch to nth tab
      const digit = parseInt(e.key);
      if (digit >= 1 && digit <= 9 && openTabs.length > 1) {
        e.preventDefault();
        const idx = Math.min(digit - 1, openTabs.length - 1);
        const tabId = openTabs[idx];
        if (tabId) {
          dispatch(switchConversation(tabId));
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, openTabs, currentConversationId]);
}
