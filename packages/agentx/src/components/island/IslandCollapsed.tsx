/**
 * Collapsed state of the Dynamic Island — compact pill showing agent summary.
 *
 * On hover:
 *   - Pixel icon does a little bounce
 *   - Status text brightens
 *   - A subtle "expand" hint arrow fades in
 *   - Content shifts slightly to make room
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PixelAgent, PixelThinkingDots, PixelToolIcon } from "./PixelArt";
import type { IslandAgent } from "./useIslandData";

const HOVER_SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };

function formatElapsed(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusText(agent: IslandAgent): string {
  switch (agent.status) {
    case "tool":
      if (agent.currentTool) {
        const args = agent.currentToolArgs;
        if (args?.path) return `${agent.currentTool} ${String(args.path).split("/").pop()}`;
        if (args?.command) return `$ ${String(args.command).slice(0, 24)}`;
        return agent.currentTool;
      }
      return "running tool...";
    case "streaming":
      return "writing...";
    case "waiting_approval":
      return "needs approval";
    case "thinking":
      return "thinking...";
    default:
      return "idle";
  }
}

interface IslandCollapsedProps {
  agents: IslandAgent[];
  isHovered: boolean;
  onClick: () => void;
}

export function IslandCollapsed({ agents, isHovered, onClick }: IslandCollapsedProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const primary = agents[0];
  if (!primary) return null;

  const hasApproval = agents.some((a) => a.status === "waiting_approval");
  const isWorking = primary.status === "tool" || primary.status === "streaming";

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 px-3 h-full cursor-pointer select-none"
    >
      {/* Pixel Agent Icon — bounces on hover */}
      <motion.div
        className="pixel-breathe flex-shrink-0"
        style={{ width: 20, height: 20 }}
        animate={isHovered ? { y: -3, scale: 1.1 } : { y: 0, scale: 1 }}
        transition={HOVER_SPRING}
      >
        {primary.status === "tool" && primary.currentTool ? (
          <PixelToolIcon toolName={primary.currentTool} />
        ) : (
          <PixelAgent working={isWorking} />
        )}
      </motion.div>

      {/* Agent count badge */}
      {agents.length > 1 && (
        <motion.span
          className="island-badge flex-shrink-0"
          style={{
            backgroundColor: hasApproval ? "rgba(250, 204, 21, 0.2)" : "rgba(74, 222, 128, 0.15)",
            color: hasApproval ? "#facc15" : "#4ade80",
          }}
          animate={isHovered ? { scale: 1.15 } : { scale: 1 }}
          transition={HOVER_SPRING}
        >
          {agents.length}
        </motion.span>
      )}

      {/* Status text — brightens on hover */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {primary.status === "thinking" ? (
          <PixelThinkingDots />
        ) : (
          <motion.span
            className="island-pixel-text truncate"
            animate={{
              color: isHovered
                ? hasApproval
                  ? "#fde047"
                  : "rgba(255, 255, 255, 0.9)"
                : hasApproval
                  ? "#facc15"
                  : "rgba(255, 255, 255, 0.7)",
            }}
            transition={{ duration: 0.15 }}
          >
            {getStatusText(primary)}
          </motion.span>
        )}
      </div>

      {/* Elapsed timer */}
      <motion.span
        className="island-pixel-text-sm flex-shrink-0"
        animate={{
          color: isHovered ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.3)",
        }}
        transition={{ duration: 0.15 }}
      >
        {formatElapsed(primary.startedAt)}
      </motion.span>

      {/* Hover expand hint */}
      <motion.span
        className="island-pixel-text-sm flex-shrink-0"
        initial={{ opacity: 0, x: -4 }}
        animate={isHovered ? { opacity: 0.5, x: 0 } : { opacity: 0, x: -4 }}
        transition={{ ...HOVER_SPRING, opacity: { duration: 0.12 } }}
        style={{ color: "rgba(255, 255, 255, 0.5)" }}
      >
        ▼
      </motion.span>
    </div>
  );
}
