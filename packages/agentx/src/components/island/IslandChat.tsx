/**
 * Pixel-styled chat component for the Dynamic Island.
 * Adapted from MenuBarPanel's chat logic with pixel art aesthetics.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { PixelAgent, PixelCheck, PixelError } from "./PixelArt";
import { playNotifySound } from "./sounds";

const EASE_FSF: [number, number, number, number] = [0.83, 0, 0.17, 1];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function IslandChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef("");
  const cleanupRef = useRef<(() => void) | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
    }
  }, [input]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  // Focus textarea on mount
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 200);
  }, []);

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
    const cleanup = window.api.agent.onEvent((event: unknown) => {
      const e = event as {
        type: string;
        conversationId?: string;
        delta?: string;
        content?: string;
        error?: string;
        message?: string;
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
    cleanupRef.current = cleanup;

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

  const handleClear = useCallback(async () => {
    if (isStreaming) return;
    if (conversationId) {
      try {
        await window.api.conversation.delete(conversationId);
      } catch {
        /* */
      }
    }
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput("");
    streamingContentRef.current = "";
  }, [conversationId, isStreaming]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden island-scroll show-scrollbar px-3 py-2 space-y-2"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="pixel-breathe" style={{ width: 20, height: 20 }}>
              <PixelAgent />
            </div>
            <span className="island-pixel-text" style={{ color: "rgba(255,255,255,0.15)" }}>
              Ask anything...
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

            {/* Copy button */}
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
            onClick={handleClear}
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
            + NEW
          </button>
          <span className="island-pixel-text-sm" style={{ color: "rgba(255,255,255,0.1)" }}>
            {messages.length > 0 ? `${messages.length} msgs` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
