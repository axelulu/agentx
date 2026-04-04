/**
 * Expanded state of the Dynamic Island.
 *
 * Two tabs:
 *   Recents — running agents + recent conversations (existing)
 *   Chat    — quick chat with pixel art style (new)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PixelAgent,
  PixelToolIcon,
  PixelThinkingDots,
  PixelApproval,
  PixelListIcon,
  PixelChatIcon,
} from "./PixelArt";
import { playApprovalSound, playErrorSound } from "./sounds";
import { useRecentConversations } from "./useRecentConversations";
import { IslandChat } from "./IslandChat";
import { l10n } from "@agentx/l10n";
import type { IslandAgent } from "./useIslandData";

const EASE_FSF: [number, number, number, number] = [0.83, 0, 0.17, 1];

type TabId = "recents" | "chat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listVariants: any = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const itemVariants: any = {
  hidden: { opacity: 0, y: 20, scale: 0.92, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: EASE_FSF },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const headerVariants: any = {
  hidden: { opacity: 0, y: -12, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: EASE_FSF },
  },
};

function formatElapsed(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return l10n.t("just now");
  if (mins < 60) return l10n.t("${count}m ago", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return l10n.t("${count}h ago", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return l10n.t("${count}d ago", { count: days });
  return `${Math.floor(days / 7)}w ago`;
}

function getStatusLabel(agent: IslandAgent): string {
  switch (agent.status) {
    case "tool":
      return agent.currentTool || l10n.t("Running tool");
    case "streaming":
      return l10n.t("Writing response");
    case "waiting_approval":
      return l10n.t("Approval needed");
    case "thinking":
      return l10n.t("Thinking");
    default:
      return l10n.t("Idle");
  }
}

interface IslandExpandedProps {
  agents: IslandAgent[];
  onCollapse: () => void;
}

export function IslandExpanded({ agents, onCollapse }: IslandExpandedProps) {
  const [activeTab, setActiveTab] = useState<TabId>("recents");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConvTitle, setSelectedConvTitle] = useState<string | null>(null);
  const [initialStreamingContent, setInitialStreamingContent] = useState<string | null>(null);

  const handleOpenInChat = useCallback(
    (convId: string, title: string, streamingContent?: string) => {
      setSelectedConvId(convId);
      setSelectedConvTitle(title);
      setInitialStreamingContent(streamingContent || null);
      setActiveTab("chat");
    },
    [],
  );

  const handleChatBack = useCallback(() => {
    setSelectedConvId(null);
    setSelectedConvTitle(null);
    setInitialStreamingContent(null);
  }, []);

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={listVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <motion.div
        variants={headerVariants}
        className="flex items-center gap-2 px-3.5 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <PixelAgent working={agents.length > 0} style={{ flexShrink: 0 }} />
        <span className="island-pixel-text flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          AgentX
        </span>
        <button onClick={onCollapse} className="island-collapse-btn" aria-label="Collapse">
          <span style={{ fontSize: 9, lineHeight: 1 }}>▲</span>
        </button>
      </motion.div>

      {/* ── Pixel Tab Bar ── */}
      <motion.div
        variants={headerVariants}
        className="flex items-center px-2 py-1 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}
      >
        <TabButton
          active={activeTab === "recents"}
          onClick={() => setActiveTab("recents")}
          icon={<PixelListIcon />}
          label={l10n.t("Recents")}
        />
        <TabButton
          active={activeTab === "chat"}
          onClick={() => setActiveTab("chat")}
          icon={<PixelChatIcon />}
          label={l10n.t("Chat")}
        />
      </motion.div>

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "recents" && (
            <motion.div
              key="recents"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: EASE_FSF }}
              className="absolute inset-0"
            >
              <RecentsContent agents={agents} onOpenInChat={handleOpenInChat} />
            </motion.div>
          )}
          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: EASE_FSF }}
              className="absolute inset-0"
            >
              <IslandChat
                conversationId={selectedConvId}
                conversationTitle={selectedConvTitle}
                initialStreamingContent={initialStreamingContent}
                onBack={handleChatBack}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Tab Button ──

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button onClick={onClick} className="island-tab-btn" data-active={active || undefined}>
      <span className="island-tab-icon">{icon}</span>
      <span className="island-pixel-text-sm">{label}</span>
    </button>
  );
}

// ── Recents Content (extracted from original IslandExpanded) ──

function RecentsContent({
  agents,
  onOpenInChat,
}: {
  agents: IslandAgent[];
  onOpenInChat: (convId: string, title: string, streamingContent?: string) => void;
}) {
  const [, setTick] = useState(0);
  const conversations = useRecentConversations(6);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleApproval = useCallback((agent: IslandAgent, approved: boolean) => {
    if (!agent.pendingApproval) return;
    window.api.tool.respondApproval(
      agent.conversationId,
      agent.pendingApproval.approvalId,
      approved,
    );
    if (approved) playApprovalSound();
    else playErrorSound();
  }, []);

  const handleOpenConversation = useCallback(
    (convId: string, title: string, streamingContent?: string) => {
      onOpenInChat(convId, title, streamingContent);
    },
    [onOpenInChat],
  );

  const hasAgents = agents.length > 0;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden island-scroll">
      {hasAgents && (
        <>
          <div className="px-3.5 pt-2.5 pb-1">
            <span className="island-section-label">
              {l10n.t("Running")} · {agents.length}
            </span>
          </div>
          {agents.map((agent) => (
            <AgentRow
              key={agent.conversationId}
              agent={agent}
              onApproval={handleApproval}
              onOpen={() =>
                handleOpenConversation(agent.conversationId, agent.title, agent.streamingContent)
              }
            />
          ))}
          {conversations.length > 0 && (
            <div
              className="mx-3.5 my-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            />
          )}
        </>
      )}

      {conversations.length > 0 && (
        <>
          <div className="px-3.5 pt-2 pb-1">
            <span className="island-section-label">{l10n.t("Recent")}</span>
          </div>
          {conversations.map((conv) => (
            <motion.div
              key={conv.id}
              onClick={() => handleOpenConversation(conv.id, conv.title)}
              className="island-conv-item"
              whileHover={{
                backgroundColor: "rgba(255,255,255,0.04)",
                x: 3,
                transition: { duration: 0.2, ease: EASE_FSF },
              }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                className="island-conv-icon"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: EASE_FSF, delay: 0.06 }}
              >
                {conv.title.charAt(0).toUpperCase()}
              </motion.div>
              <div className="flex-1 min-w-0">
                <div
                  className="island-pixel-text truncate"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  {conv.title}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="island-pixel-text-sm"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {conv.messageCount} {l10n.t("msgs")}
                  </span>
                  <span
                    className="island-pixel-text-sm"
                    style={{ color: "rgba(255,255,255,0.15)" }}
                  >
                    ·
                  </span>
                  <span
                    className="island-pixel-text-sm"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {formatRelativeTime(conv.updatedAt)}
                  </span>
                </div>
              </div>
              {conv.isFavorite && (
                <span style={{ color: "#facc15", fontSize: 10, flexShrink: 0 }}>★</span>
              )}
            </motion.div>
          ))}
        </>
      )}

      {!hasAgents && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="pixel-breathe" style={{ width: 20, height: 20 }}>
            <PixelAgent />
          </div>
          <span className="island-pixel-text" style={{ color: "rgba(255,255,255,0.2)" }}>
            {l10n.t("No recent activity")}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Agent Row ──

function AgentRow({
  agent,
  onApproval,
  onOpen,
}: {
  agent: IslandAgent;
  onApproval: (agent: IslandAgent, approved: boolean) => void;
  onOpen: () => void;
}) {
  const isApproval = agent.status === "waiting_approval" && agent.pendingApproval;
  const toolArgs = agent.currentToolArgs;
  const toolDetail = toolArgs?.path
    ? String(toolArgs.path)
    : toolArgs?.command
      ? `$ ${String(toolArgs.command).slice(0, 36)}`
      : null;

  return (
    <motion.div
      className="island-agent-item"
      style={{ cursor: "pointer" }}
      onClick={onOpen}
      whileHover={{
        backgroundColor: "rgba(255,255,255,0.04)",
        x: 3,
        transition: { duration: 0.2, ease: EASE_FSF },
      }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0" style={{ width: 18, height: 18 }}>
          {agent.status === "tool" && agent.currentTool ? (
            <PixelToolIcon toolName={agent.currentTool} />
          ) : agent.status === "waiting_approval" ? (
            <PixelApproval />
          ) : (
            <PixelAgent working={agent.status !== "idle"} />
          )}
        </div>
        <span
          className="island-pixel-text flex-1 truncate"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          {agent.title}
        </span>
        <span
          className="island-pixel-text-sm flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          {formatElapsed(agent.startedAt)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-1 ml-[26px]">
        {agent.status === "thinking" ? (
          <PixelThinkingDots />
        ) : (
          <span
            className="island-pixel-text-sm"
            style={{
              color: agent.status === "waiting_approval" ? "#facc15" : "rgba(255,255,255,0.4)",
            }}
          >
            {getStatusLabel(agent)}
          </span>
        )}
      </div>

      {toolDetail && (
        <div className="mt-0.5 ml-[26px]">
          <span
            className="island-pixel-text-sm truncate block"
            style={{ color: "rgba(255,255,255,0.2)", maxWidth: 300 }}
          >
            {toolDetail}
          </span>
        </div>
      )}

      {isApproval && agent.pendingApproval && (
        <motion.div
          className="mt-2 ml-[26px] rounded-md p-2"
          style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.12)" }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 mb-2">
            <span className="island-pixel-text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {agent.pendingApproval.toolName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              className="island-btn island-btn-allow"
              onClick={() => onApproval(agent, true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {l10n.t("Allow")}
            </motion.button>
            <motion.button
              className="island-btn island-btn-deny"
              onClick={() => onApproval(agent, false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {l10n.t("Deny")}
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
