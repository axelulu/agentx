/**
 * Pixel-styled chat component for the Dynamic Island.
 *
 * Supports two modes:
 *   1. New chat — creates a fresh "Quick Ask" conversation
 *   2. Existing conversation — loads messages from a conversationId prop,
 *      shows history with simplified tool call indicators, and allows continuing
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { PixelAgent, PixelCheck, PixelError, PixelFile, PixelTerminal } from "./PixelArt";
import { playNotifySound } from "./sounds";
import { l10n } from "@agentx/l10n";

const EASE_FSF: [number, number, number, number] = [0.83, 0, 0.17, 1];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Simplified tool call indicators (name + status) */
  toolCalls?: { name: string; status?: string }[];
}

/** Raw message from conversation.messages() API */
interface RawMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  contentParts?: { type: string; text?: string }[];
  toolCalls?: {
    id: string;
    name: string;
    status?: string;
    result?: { content: string; isError?: boolean };
  }[];
  toolCallId?: string;
}

/** Convert raw API messages to simplified ChatMessages, skipping tool-role messages */
function convertMessages(raw: RawMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const msg of raw) {
    if (msg.role === "tool") continue; // skip tool result messages
    const content =
      msg.content ??
      msg.contentParts
        ?.filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("\n") ??
      "";
    const toolCalls = msg.toolCalls?.map((tc) => ({
      name: tc.name,
      status: tc.status || (tc.result ? "done" : undefined),
    }));
    result.push({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
    });
  }
  return result;
}

interface IslandChatProps {
  /** If set, loads this conversation's history. If null, starts fresh. */
  conversationId?: string | null;
  /** Title of the loaded conversation (shown in header) */
  conversationTitle?: string | null;
  /** Pre-accumulated streaming content from useIslandData (for running conversations) */
  initialStreamingContent?: string | null;
  /** Called when user wants to go back to new chat / clear */
  onBack?: () => void;
}

export function IslandChat({
  conversationId: initialConvId,
  conversationTitle,
  initialStreamingContent,
  onBack,
}: IslandChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConvId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);
  const loadedConvRef = useRef<string | null>(null);

  /** Create a streaming event listener for a conversation + assistant message ID.
   *  Shared by both handleSend (new message) and load-existing (in-progress agent). */
  const createStreamListener = useCallback((convId: string, assistantMsgId: string) => {
    return window.api.agent.onEvent((event: unknown) => {
      const e = event as {
        type: string;
        conversationId?: string;
        delta?: string;
        content?: string;
        error?: string;
        message?: string;
        toolName?: string;
      };
      if (e.conversationId !== convId) return;

      switch (e.type) {
        case "message_delta":
          if (e.delta) {
            streamingContentRef.current += e.delta;
            const newContent = streamingContentRef.current;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: newContent } : m)),
            );
          }
          break;
        case "tool_start":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              const existing = m.toolCalls || [];
              return {
                ...m,
                toolCalls: [...existing, { name: e.toolName || "tool", status: "running" }],
              };
            }),
          );
          break;
        case "tool_end":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              const calls = (m.toolCalls || []).map((tc) =>
                tc.status === "running" && tc.name === (e.toolName || "tool")
                  ? { ...tc, status: "done" }
                  : tc,
              );
              return { ...m, toolCalls: calls };
            }),
          );
          break;
        case "message_end":
          if (e.content) {
            streamingContentRef.current = e.content;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: e.content! } : m)),
            );
          }
          break;
        case "agent_end":
          setIsStreaming(false);
          playNotifySound();
          if (!streamingContentRef.current) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          }
          break;
        case "error":
          setIsStreaming(false);
          setError(e.error || e.message || "Unknown error");
          if (!streamingContentRef.current) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          }
          break;
      }
    });
  }, []);

  // Load existing conversation when conversationId prop changes
  useEffect(() => {
    const convId = initialConvId ?? null;
    if (convId === loadedConvRef.current) return;
    loadedConvRef.current = convId;

    if (!convId) {
      // Reset to new chat
      setMessages([]);
      setConversationId(null);
      setError(null);
      setInput("");
      streamingContentRef.current = "";
      cleanupRef.current?.();
      cleanupRef.current = null;
      return;
    }

    setConversationId(convId);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const raw = (await window.api.conversation.messages(convId)) as unknown;
        const msgs = convertMessages(Array.isArray(raw) ? (raw as RawMessage[]) : []);
        setMessages(msgs);

        // Check if this conversation has a running agent
        const status = (await window.api.agent.status(convId).catch(() => null)) as {
          status?: string;
          streamingContent?: string;
        } | null;

        const isRunning = status?.status === "running" || status?.status === "awaiting_approval";

        if (isRunning) {
          // Agent is actively running — use content accumulated by useIslandData,
          // fall back to status API (requires sidecar rebuild)
          const streamingContent = initialStreamingContent || status?.streamingContent || "";

          setIsStreaming(true);

          // Reuse existing assistant message or create placeholder, seeded with live content
          const lastMsg = msgs[msgs.length - 1];
          let streamMsgId: string;
          if (lastMsg?.role === "assistant") {
            streamMsgId = lastMsg.id;
            // Prefer live streaming content over persisted (which may be empty)
            const content = streamingContent || lastMsg.content || "";
            streamingContentRef.current = content;
            setMessages((prev) => prev.map((m) => (m.id === streamMsgId ? { ...m, content } : m)));
          } else {
            streamMsgId = uuidv4();
            streamingContentRef.current = streamingContent;
            setMessages((prev) => [
              ...prev,
              { id: streamMsgId, role: "assistant", content: streamingContent },
            ]);
          }

          // Listen for future events
          cleanupRef.current?.();
          const cleanup = createStreamListener(convId, streamMsgId);
          cleanupRef.current = cleanup;
          // Only subscribe if we have no content yet — subscribe replay could
          // duplicate content already provided by initialStreamingContent
          if (!streamingContent) {
            await window.api.agent.subscribe(convId).catch(() => {});
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [initialConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
    }
  }, [input]);

  // Scroll to bottom — on new messages AND during streaming (content changes)
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Scroll on message list changes
  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // During streaming, poll scroll position to keep at bottom
  // (message_delta updates content in-place without changing array length)
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(scrollToBottom, 100);
    return () => clearInterval(interval);
  }, [isStreaming, scrollToBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  // Focus textarea
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 200);
  }, [initialConvId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInput("");

    const userMsg: ChatMessage = { id: uuidv4(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    let convId = conversationId;
    if (!convId) {
      try {
        const conv = (await window.api.conversation.create("Quick Ask")) as { id: string };
        convId = conv.id;
        setConversationId(convId);
        loadedConvRef.current = convId;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    const assistantMsgId = uuidv4();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);
    setIsStreaming(true);
    streamingContentRef.current = "";

    cleanupRef.current?.();
    cleanupRef.current = createStreamListener(convId, assistantMsgId);

    try {
      await window.api.agent.send(convId, text);
      await window.api.agent.subscribe(convId);
    } catch (e) {
      setIsStreaming(false);
      setError(e instanceof Error ? e.message : String(e));
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    }
  }, [input, isStreaming, conversationId]);

  const handleAbort = useCallback(() => {
    if (conversationId) window.api.agent.abort(conversationId);
  }, [conversationId]);

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput("");
    streamingContentRef.current = "";
    loadedConvRef.current = null;
    onBack?.();
  }, [isStreaming, onBack]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const canSend = input.trim().length > 0;
  const showTitle = conversationTitle && initialConvId;

  return (
    <div className="flex flex-col h-full">
      {/* Conversation title bar (when viewing existing conversation) */}
      {showTitle && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          <button
            onClick={handleNewChat}
            className="island-pixel-text-sm flex-shrink-0"
            style={{
              color: "rgba(255,255,255,0.3)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            ◀
          </button>
          <span
            className="island-pixel-text truncate flex-1"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {conversationTitle}
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden island-scroll px-3 py-2 space-y-2"
      >
        {loading && (
          <div className="flex items-center justify-center py-4 gap-2">
            <span className="island-typing-dot" />
            <span className="island-typing-dot" style={{ animationDelay: "0.15s" }} />
            <span className="island-typing-dot" style={{ animationDelay: "0.3s" }} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="pixel-breathe" style={{ width: 20, height: 20 }}>
              <PixelAgent />
            </div>
            <span className="island-pixel-text" style={{ color: "rgba(255,255,255,0.15)" }}>
              {l10n.t("Ask anything...")}
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE_FSF }}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {/* Tool call indicators (compact pixel style) */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {msg.toolCalls.map((tc, idx) => (
                  <ToolCallBadge key={idx} name={tc.name} status={tc.status} />
                ))}
              </div>
            )}

            <div
              className={
                msg.role === "user" ? "island-chat-bubble-user" : "island-chat-bubble-assistant"
              }
            >
              {msg.role === "assistant" && msg.content ? (
                <div className="island-chat-markdown">
                  <Streamdown
                    mode={isStreaming && i === messages.length - 1 ? "streaming" : "static"}
                    animated={
                      isStreaming && i === messages.length - 1
                        ? { animation: "fadeIn" as const, duration: 200, stagger: 15 }
                        : undefined
                    }
                    controls={false}
                    lineNumbers={false}
                  >
                    {msg.content}
                  </Streamdown>
                </div>
              ) : msg.role === "assistant" && !msg.content && isStreaming ? (
                <span className="inline-flex gap-1 items-center h-3">
                  <span className="island-typing-dot" />
                  <span className="island-typing-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="island-typing-dot" style={{ animationDelay: "0.3s" }} />
                </span>
              ) : (
                <span className="island-pixel-text" style={{ whiteSpace: "pre-wrap" }}>
                  {msg.content}
                </span>
              )}
            </div>

            {msg.content && (
              <button
                onClick={() => handleCopy(msg)}
                className="mt-0.5 p-0.5"
                style={{ opacity: 0.2, transition: "opacity 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.5")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.2")}
              >
                <div style={{ width: 12, height: 12 }}>
                  {copiedId === msg.id ? <PixelCheck /> : <PixelAgent />}
                </div>
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-3 mb-1 px-2 py-1 island-pixel-text-sm"
          style={{
            color: "#f87171",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 2,
          }}
        >
          <div style={{ width: 10, height: 10, display: "inline-block", marginRight: 4 }}>
            <PixelError />
          </div>
          {error}
        </div>
      )}

      {/* Input */}
      <div
        className="px-3 py-2 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-end gap-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=">"
            rows={1}
            disabled={isStreaming}
            className="island-chat-input"
          />
          {isStreaming ? (
            <button
              onClick={handleAbort}
              className="island-chat-send-btn island-chat-stop-btn"
              aria-label="Stop"
            >
              <span className="island-pixel-text-sm">■</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="island-chat-send-btn"
              aria-label="Send"
            >
              <span className="island-pixel-text-sm" style={{ opacity: canSend ? 1 : 0.3 }}>
                ▶
              </span>
            </button>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex items-center mt-1.5 gap-2">
          <button
            onClick={handleNewChat}
            disabled={isStreaming}
            className="island-pixel-text-sm"
            style={{
              color: "rgba(255,255,255,0.2)",
              cursor: isStreaming ? "default" : "pointer",
              transition: "color 0.15s",
              background: "none",
              border: "none",
              padding: 0,
            }}
            onMouseEnter={(e) =>
              !isStreaming && (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
          >
            + {l10n.t("New")}
          </button>
          <span className="island-pixel-text-sm" style={{ color: "rgba(255,255,255,0.1)" }}>
            {messages.length > 0 ? `${messages.length} ${l10n.t("msgs")}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Compact pixel-style tool call badge */
function ToolCallBadge({ name, status }: { name: string; status?: string }) {
  const isRunning = status === "running";
  const shortName = name.replace(/^(file_|fs_|shell_)/, "").slice(0, 12);

  const icon =
    name.includes("file") || name.includes("read") || name.includes("write") ? (
      <PixelFile />
    ) : name.includes("shell") || name.includes("exec") || name.includes("terminal") ? (
      <PixelTerminal />
    ) : (
      <PixelAgent working />
    );

  return (
    <span className="island-tool-badge" data-running={isRunning || undefined}>
      <span style={{ width: 10, height: 10, display: "inline-flex" }}>{icon}</span>
      <span className="island-pixel-text-sm">{shortName}</span>
      {isRunning && <span className="island-typing-dot" style={{ width: 3, height: 3 }} />}
    </span>
  );
}
