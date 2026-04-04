/**
 * Dynamic Island — persistent floating overlay pinned to top center.
 *
 * Bounce: native window resize overshoot + settle.
 *   Expand:   resize to 107% of target → 250ms later resize to 100%
 *   Collapse: resize to 94% of target  → 250ms later resize to 100%
 * Both steps use CoreAnimation (fast-slow-fast curve). The overlap between
 * the two animations creates a natural elastic feel — no CSS scale, no clipping.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStandaloneTheme } from "@/hooks/useStandaloneTheme";
import { useIslandData } from "./useIslandData";
import { IslandCollapsed } from "./IslandCollapsed";
import { IslandExpanded } from "./IslandExpanded";
import { PixelAgent, PixelCpuIcon, PixelMemIcon, PixelStatBar } from "./PixelArt";
import { useSystemStats } from "./useSystemStats";
import { playNotifySound } from "./sounds";
import "./island.css";

type IslandMode = "idle" | "collapsed" | "expanded";

const WIN = {
  idle: { width: 250, height: 40 },
  // On notch Macs, idle shows minimal wings flanking the real notch
  // 180px notch gap + 45px per wing = 270px total
  idleNotch: { width: 270, height: 40 },
  collapsed: { width: 350, height: 40 },
  expanded: { width: 420, height: 440 },
};
const HOVER_SPRING = { type: "spring" as const, stiffness: 500, damping: 32 };
const EASE_FSF: [number, number, number, number] = [0.83, 0, 0.17, 1];

function resizeNative(w: number, h: number, animated: boolean, duration?: number) {
  invoke("resize_island_panel", { width: w, height: h, animated, duration }).catch(() => {});
}

/**
 * Two-step native resize bounce:
 *   Step 1: snap past target FAST (120ms)
 *   Step 2: settle back to 100% smoothly (150ms)
 * The short durations + overlap = quick, punchy bounce.
 */
function resizeWithBounce(w: number, h: number, expand: boolean) {
  if (expand) {
    // Overshoot to 104% at original expand speed
    resizeNative(Math.round(w * 1.04), Math.round(h * 1.04), true, 0.25);
    // Settle back smoothly
    setTimeout(() => resizeNative(w, h, true, 0.2), 220);
  } else {
    // Collapse at original speed, undershoot to 96%
    resizeNative(Math.round(w * 0.96), Math.round(h * 0.96), true, 0.25);
    // Settle back smoothly
    setTimeout(() => resizeNative(w, h, true, 0.2), 220);
  }
}

export function DynamicIslandPanel() {
  useStandaloneTheme();

  const { agents, hasApprovalPending } = useIslandData();
  const [mode, setMode] = useState<IslandMode>("idle");
  const [isHovered, setIsHovered] = useState(false);
  const [hasNotch, setHasNotch] = useState(false);
  // Only poll system stats when idle on non-notch Macs (notch idle hides stats)
  const { cpuPercent, memPercent } = useSystemStats(mode === "idle" && !hasNotch);
  const prevAgentCountRef = useRef(0);
  const prevModeRef = useRef<IslandMode>("idle");

  // Detect notch on mount
  useEffect(() => {
    invoke("island_has_notch")
      .then((v) => setHasNotch(v as boolean))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (agents.length === 0 && mode === "collapsed") {
      setMode("idle");
    } else if (agents.length > 0 && mode === "idle") {
      setMode("collapsed");
    }
  }, [agents.length, mode]);

  useEffect(() => {
    if (hasApprovalPending && mode !== "expanded") {
      setMode("expanded");
      playNotifySound();
    }
  }, [hasApprovalPending, mode]);

  useEffect(() => {
    if (agents.length > prevAgentCountRef.current && prevAgentCountRef.current >= 0) {
      playNotifySound();
    }
    prevAgentCountRef.current = agents.length;
  }, [agents.length]);

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    const size = mode === "idle" && hasNotch ? WIN.idleNotch : WIN[mode];

    if (mode === "expanded") {
      resizeWithBounce(size.width, size.height, true);
      invoke("island_set_expanded", { expanded: true }).catch(() => {});
    } else if (prev === "expanded") {
      resizeWithBounce(size.width, size.height, false);
      invoke("island_set_expanded", { expanded: false }).catch(() => {});
    } else {
      resizeNative(size.width, size.height, false);
    }
  }, [mode, hasNotch]);

  useEffect(() => {
    const unlisten = listen("island:click-outside", () => {
      if (mode === "expanded") {
        setMode(agents.length > 0 ? "collapsed" : "idle");
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [mode, agents.length]);

  const handleMouseEnter = useCallback(() => {
    if (mode !== "expanded") setIsHovered(true);
  }, [mode]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleExpand = useCallback(() => {
    setIsHovered(false);
    setMode("expanded");
  }, []);

  const handleCollapse = useCallback(() => {
    setMode(agents.length > 0 ? "collapsed" : "idle");
  }, [agents.length]);

  const isExpanded = mode === "expanded";
  const pulseClass = isExpanded
    ? ""
    : hasApprovalPending
      ? "island-pulse-approval"
      : agents.length > 0
        ? "island-pulse"
        : "";

  const isIdle = mode === "idle";

  return (
    <motion.div
      className={`island-container island-scanlines relative w-full h-full ${pulseClass}`}
      style={{
        borderRadius: isExpanded ? 16 : 22,
        transition: "border-radius 0.42s cubic-bezier(0.83, 0, 0.17, 1)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pixel scan sweep on hover */}
      {isIdle && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-20 rounded-[inherit]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(74,222,128,0.06) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
          }}
          animate={{
            backgroundPosition: isHovered ? ["200% 0%", "-200% 0%"] : "200% 0%",
            opacity: isHovered ? 1 : 0,
          }}
          transition={{
            backgroundPosition: { duration: 0.8, ease: "linear", repeat: Infinity },
            opacity: { duration: 0.15 },
          }}
        />
      )}

      <AnimatePresence mode="sync" initial={false}>
        {/* ── Idle: Notch Mac — minimal wings flanking the real notch ── */}
        {mode === "idle" && hasNotch && (
          <motion.div
            key="idle-notch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_FSF } }}
            transition={{ duration: 0.2, ease: EASE_FSF }}
            className="island-idle-content absolute inset-0 flex items-center justify-between z-10 cursor-pointer"
            style={{ paddingLeft: 10, paddingRight: 10 }}
            onClick={handleExpand}
          >
            {/* Left wing: agent icon */}
            <motion.div
              className="flex-shrink-0"
              style={{ width: 20, height: 20 }}
              animate={{
                scale: isHovered ? 1.15 : 1,
                rotate: isHovered ? [0, -8, 8, -4, 0] : 0,
              }}
              transition={{
                scale: HOVER_SPRING,
                rotate: { duration: 0.5, ease: "easeInOut" },
              }}
            >
              <PixelAgent working={isHovered} />
            </motion.div>

            {/* Center gap — matches real notch width */}
            <div style={{ width: 180, flexShrink: 0 }} />

            {/* Right wing: notification indicator */}
            <motion.div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 20, height: 20 }}
              animate={{ scale: isHovered ? 1.2 : 1 }}
              transition={HOVER_SPRING}
            >
              <motion.div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: hasApprovalPending
                    ? "#f59e0b"
                    : agents.length > 0
                      ? "#4ade80"
                      : "rgba(255,255,255,0.2)",
                }}
                animate={{
                  scale: hasApprovalPending ? [1, 1.4, 1] : 1,
                  opacity: hasApprovalPending ? [1, 0.6, 1] : 1,
                }}
                transition={
                  hasApprovalPending
                    ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
              />
            </motion.div>
          </motion.div>
        )}

        {/* ── Idle: Non-notch Mac — full stats display ── */}
        {mode === "idle" && !hasNotch && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_FSF } }}
            transition={{ duration: 0.2, ease: EASE_FSF }}
            className="island-idle-content absolute inset-0 flex items-center justify-center gap-2.5 px-4 z-10 cursor-pointer"
            onClick={handleExpand}
          >
            {/* Left side: Agent + CPU */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <motion.div
                className="flex-shrink-0"
                style={{ width: 20, height: 20 }}
                animate={{
                  y: isHovered ? -3 : 0,
                  rotate: isHovered ? [0, -8, 8, -4, 0] : 0,
                }}
                transition={{
                  y: HOVER_SPRING,
                  rotate: { duration: 0.5, ease: "easeInOut" },
                }}
              >
                <PixelAgent working={isHovered} />
              </motion.div>
              <motion.div
                className="flex items-center gap-1.5 flex-shrink-0"
                style={{ height: 14 }}
                animate={{ x: isHovered ? 2 : 0 }}
                transition={HOVER_SPRING}
              >
                <div className="flex items-center justify-center" style={{ width: 12, height: 14 }}>
                  <PixelCpuIcon />
                </div>
                <div className="flex items-center" style={{ width: 16, height: 14 }}>
                  <PixelStatBar percent={cpuPercent} />
                </div>
                <motion.span
                  className="island-pixel-text-sm"
                  animate={{
                    color: isHovered
                      ? "#fff"
                      : cpuPercent >= 80
                        ? "#f87171"
                        : cpuPercent >= 50
                          ? "#facc15"
                          : "rgba(255,255,255,0.35)",
                  }}
                  transition={{ duration: 0.15 }}
                  style={{ minWidth: 22, textAlign: "right", lineHeight: "14px" }}
                >
                  {cpuPercent}%
                </motion.span>
              </motion.div>
            </div>

            {/* Center separator dot */}
            <motion.span
              animate={{ scale: isHovered ? 1.5 : 1, opacity: isHovered ? 0.3 : 0.12 }}
              transition={HOVER_SPRING}
              style={{
                width: 2,
                height: 2,
                borderRadius: 1,
                background: "rgba(255,255,255,1)",
                flexShrink: 0,
              }}
            />

            {/* MEM stat */}
            <motion.div
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{ height: 14 }}
              animate={{ x: isHovered ? -2 : 0 }}
              transition={HOVER_SPRING}
            >
              <div className="flex items-center justify-center" style={{ width: 12, height: 14 }}>
                <PixelMemIcon />
              </div>
              <div className="flex items-center" style={{ width: 16, height: 14 }}>
                <PixelStatBar percent={memPercent} />
              </div>
              <motion.span
                className="island-pixel-text-sm"
                animate={{
                  color: isHovered
                    ? "#fff"
                    : memPercent >= 80
                      ? "#f87171"
                      : memPercent >= 50
                        ? "#facc15"
                        : "rgba(255,255,255,0.35)",
                }}
                transition={{ duration: 0.15 }}
                style={{ minWidth: 22, textAlign: "right", lineHeight: "14px" }}
              >
                {memPercent}%
              </motion.span>
            </motion.div>
          </motion.div>
        )}

        {mode === "collapsed" && (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_FSF } }}
            transition={{ duration: 0.2, ease: EASE_FSF }}
            className="absolute inset-0 z-10"
          >
            <IslandCollapsed agents={agents} isHovered={isHovered} onClick={handleExpand} />
          </motion.div>
        )}

        {mode === "expanded" && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_FSF } }}
            transition={{ duration: 0.2, delay: 0.05, ease: EASE_FSF }}
            className="absolute inset-0 z-10"
          >
            <IslandExpanded agents={agents} onCollapse={handleCollapse} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
