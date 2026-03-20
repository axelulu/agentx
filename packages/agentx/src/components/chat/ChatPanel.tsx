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
} from "@/slices/settingsSlice";
import { useAgentEventListener } from "@/hooks/useAgent";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { l10n } from "@agentx/l10n";
import { MessageList } from "./MessageList";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ToolApprovalBanner } from "./ToolApprovalBanner";
import { WelcomePage } from "./WelcomePage";

export function ChatPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentConversationId, messages, isStreaming, streamingMessageId, branchInfo } =
    useSelector((state: RootState) => state.chat);

  const autoReadReplies = useSelector((s: RootState) => s.settings.voice.autoReadReplies);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Register the IPC event listener exactly once here
  useAgentEventListener();

  const { speak, stop: stopSpeaking, speakingMessageId } = useTextToSpeech();

  useEffect(() => {
    dispatch(loadPreferences());
    dispatch(loadConversations());
    dispatch(loadProviders());
    dispatch(loadKnowledgeBase());
    dispatch(loadMCPServers());
    dispatch(loadToolPermissions());
    dispatch(loadInstalledSkills());
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
  );
}
