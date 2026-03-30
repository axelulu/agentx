import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  loadConversations,
  setInputValue,
  switchBranch,
  regenerateMessage,
} from "@/slices/chatSlice";
import {
  loadPreferences,
  loadProviders,
  loadKnowledgeBase,
  loadMCPServers,
  loadToolPermissions,
  loadInstalledSkills,
  loadChannels,
  loadScheduledTasks,
} from "@/slices/settingsSlice";
import { waitForSidecar, onSidecarReady } from "@/lib/bridge";
import { useAgentEventListener } from "@/hooks/useAgent";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { l10n } from "@agentx/l10n";
import { MessageList } from "./MessageList";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ToolApprovalBanner } from "./ToolApprovalBanner";
import { WelcomePage } from "./WelcomePage";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { ResizeHandle } from "@/components/terminal/ResizeHandle";

export function ChatPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentConversationId, messages, isStreaming, streamingMessageId, branchInfo } =
    useSelector((state: RootState) => state.chat);

  const autoReadReplies = useSelector((s: RootState) => s.settings.voice.autoReadReplies);
  const terminalOpen = useSelector((s: RootState) => s.ui.terminalOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Register the IPC event listener exactly once here
  useAgentEventListener();

  const { speak, stop: stopSpeaking, speakingMessageId } = useTextToSpeech();

  // Load all persisted data from the sidecar. Shared loader function so it
  // can be invoked both on initial mount and on sidecar restart.
  const loadAllData = useCallback(() => {
    dispatch(loadPreferences());
    dispatch(loadConversations());
    dispatch(loadProviders());
    dispatch(loadKnowledgeBase());
    dispatch(loadMCPServers());
    dispatch(loadToolPermissions());
    dispatch(loadInstalledSkills());
    dispatch(loadChannels());
    dispatch(loadScheduledTasks());
  }, [dispatch]);

  // Wait for the sidecar process to be ready before loading persisted data.
  // Without this, the frontend would attempt to load settings before the
  // sidecar is initialized, resulting in empty/default values.
  // Also re-load on sidecar restart (crash recovery).
  useEffect(() => {
    let cancelled = false;
    waitForSidecar().then(() => {
      if (!cancelled) loadAllData();
    });
    const unsub = onSidecarReady(() => {
      if (!cancelled) loadAllData();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [loadAllData]);

  // Refresh conversation list when a channel creates/recreates a conversation
  useEffect(() => {
    const unsub = window.api.channel.onConversationsChanged(() => {
      dispatch(loadConversations());
    });
    return unsub;
  }, [dispatch]);

  // Edit: populate input with the user message content + attachments
  const handleEdit = useCallback(
    (content: string, filePaths?: string[]) => {
      dispatch(setInputValue(content));
      if (filePaths && filePaths.length > 0) {
        chatInputRef.current?.addFiles(filePaths);
      }
    },
    [dispatch],
  );

  // Regenerate: dispatch the regenerateMessage thunk to create a new branch
  const handleRegenerate = useCallback(
    (assistantMessageId: string) => {
      if (!currentConversationId) return;
      dispatch(regenerateMessage({ conversationId: currentConversationId, assistantMessageId }));
    },
    [currentConversationId, dispatch],
  );

  // Switch branch: dispatch the switchBranch thunk
  const handleSwitchBranch = useCallback(
    (targetMessageId: string) => {
      if (!currentConversationId) return;
      dispatch(switchBranch({ conversationId: currentConversationId, targetMessageId }));
    },
    [currentConversationId, dispatch],
  );

  const handleSpeak = useCallback(
    (text: string, messageId?: string) => speak(text, messageId),
    [speak],
  );

  // Auto-read new assistant replies when streaming ends
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (!autoReadReplies || isStreaming || messages.length <= prevCount) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.content) {
      speak(lastMsg.content, lastMsg.id);
    }
  }, [messages.length, isStreaming, autoReadReplies, speak, messages]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ scrollbarGutter: "stable" }}>
      {/* Chat area — shrinks when terminal is open */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {currentConversationId ? (
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto"
            style={{ scrollbarGutter: "stable" }}
          >
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingMessageId={streamingMessageId}
              scrollContainerRef={scrollContainerRef}
              onEditMessage={handleEdit}
              onRegenerateMessage={handleRegenerate}
              onSpeak={handleSpeak}
              onStopSpeaking={stopSpeaking}
              speakingMessageId={speakingMessageId}
              branchInfo={branchInfo}
              onSwitchBranch={handleSwitchBranch}
            />
          </div>
        ) : (
          <WelcomePage
            onSelectPrompt={(text) => {
              dispatch(setInputValue(text));
              // Allow Redux state to flush so the textarea renders the new value,
              // then move the cursor to the end and focus.
              requestAnimationFrame(() => chatInputRef.current?.focus());
            }}
          />
        )}
        {currentConversationId && <ToolApprovalBanner />}
        <ChatInput ref={chatInputRef} />
      </div>

      {/* Terminal panel */}
      {terminalOpen && (
        <>
          <ResizeHandle />
          <TerminalPanel />
        </>
      )}
    </div>
  );
}
