/**
 * Dynamic Island — persistent floating overlay pinned to top center.
 *
 * Animation architecture:
 *   Native window morph: macOS NSAnimationContext (CoreAnimation, 60fps, system compositor)
 *   Content transitions: framer-motion (opacity, y, stagger)
 *   These animate DIFFERENT things so they never conflict.
 *
 * Expand: native window morphs open (350ms ease-out) + content fades in (staggered, 120ms delay)
 * Collapse: content fades out (80ms) → native window morphs closed (350ms ease-out)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStandaloneTheme } from "@/hooks/useStandaloneTheme";
import { useIslandData } from "./useIslandData";
import { IslandCollapsed } from "./IslandCollapsed";
import { IslandExpanded } from "./IslandExpanded";
import { PixelAgent } from "./PixelArt";
import { playNotifySound } from "./sounds";
import "./island.css";

type IslandMode = "idle" | "collapsed" | "expanded";

const WIN = {
  idle: { width: 200, height: 40 },
  collapsed: { width: 350, height: 40 },
  expanded: { width: 420, height: 440 },
};

const HOVER_SPRING = { type: "spring" as const, stiffness: 500, damping: 32 };

// fast-slow-fast cubic bezier — matches the native CoreAnimation curve
// fast-slow-fast: aggressive curve — snaps at both ends, glides in middle
const EASE_FSF: [number, number, number, number] = [0.83, 0, 0.17, 1];

/** Resize native window. animated=true uses macOS CoreAnimation (smooth 60fps morph). */
function resizeNative(w: number, h: number, animated: boolean) {
  invoke("resize_island_panel", { width: w, height: h, animated }).catch(() => {});
}

export function DynamicIslandPanel() {
  useStandaloneTheme();

  const { agents, hasApprovalPending } = useIslandData();
  const [mode, setMode] = useState<IslandMode>("idle");
  const [isHovered, setIsHovered] = useState(false);
  const prevAgentCountRef = useRef(0);
  const prevModeRef = useRef<IslandMode>("idle");

  // ── Auto-transition idle ↔ collapsed ──
  useEffect(() => {
    if (agents.length === 0 && mode === "collapsed") {
      setMode("idle");
    } else if (agents.length > 0 && mode === "idle") {
      setMode("collapsed");
    }
  }, [agents.length, mode]);

  // Auto-expand on approval
  useEffect(() => {
    if (hasApprovalPending && mode !== "expanded") {
      setMode("expanded");
      playNotifySound();
    }
  }, [hasApprovalPending, mode]);

  // Sound on new agent
  useEffect(() => {
    if (agents.length > prevAgentCountRef.current && prevAgentCountRef.current >= 0) {
      playNotifySound();
    }
    prevAgentCountRef.current = agents.length;
  }, [agents.length]);

  // ── Native window resize + click monitor on mode change ──
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    const size = WIN[mode];

    if (mode === "expanded") {
      resizeNative(size.width, size.height, true);
      // Install global click monitor — clicks outside the island will collapse it
      invoke("island_set_expanded", { expanded: true }).catch(() => {});
    } else if (prev === "expanded") {
      resizeNative(size.width, size.height, true);
      // Remove global click monitor
      invoke("island_set_expanded", { expanded: false }).catch(() => {});
    } else {
      resizeNative(size.width, size.height, false);
    }
  }, [mode]);

  // ── Listen for click-outside event from native monitor ──
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

  return (
    <motion.div
      className={`island-container island-scanlines relative w-full h-full ${pulseClass}`}
      style={{
        borderRadius: isExpanded ? 16 : 22,
        transition: "border-radius 0.42s cubic-bezier(0.83, 0, 0.17, 1)",
      }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        scale: isHovered && !isExpanded ? 1.04 : 1,
      }}
      transition={HOVER_SPRING}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-[inherit]"
        animate={{ opacity: isHovered && !isExpanded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 100%)",
        }}
      />

      {/* mode="sync" lets new content enter WHILE old exits — no waiting */}
      <AnimatePresence mode="sync" initial={false}>
        {mode === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.25, ease: EASE_FSF } }}
            transition={{ duration: 0.35, ease: EASE_FSF }}
            className="absolute inset-0 flex items-center justify-center gap-2.5 px-4 z-10 cursor-pointer"
            onClick={handleExpand}
          >
            <motion.div
              className="pixel-breathe flex-shrink-0"
              style={{ width: 20, height: 20 }}
              animate={{ y: isHovered ? -2 : 0 }}
              transition={HOVER_SPRING}
            >
              <PixelAgent />
            </motion.div>
            <motion.span
              className="island-pixel-text"
              animate={{ color: isHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}
              transition={{ duration: 0.15 }}
            >
              AgentX
            </motion.span>
            <motion.span
              className="island-pixel-text-sm"
              animate={{ opacity: isHovered ? 0.4 : 0 }}
              transition={{ duration: 0.12 }}
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ▼
            </motion.span>
          </motion.div>
        )}

        {mode === "collapsed" && (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.25, ease: EASE_FSF } }}
            transition={{ duration: 0.35, ease: EASE_FSF }}
            className="absolute inset-0 z-10"
          >
            <IslandCollapsed agents={agents} isHovered={isHovered} onClick={handleExpand} />
          </motion.div>
        )}

        {mode === "expanded" && (
          <motion.div
            key="expanded"
            // NO delay — content enters immediately as window expands
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE_FSF } }}
            transition={{ duration: 0.18, ease: EASE_FSF }}
            className="absolute inset-0 z-10"
          >
            <IslandExpanded agents={agents} onCollapse={handleCollapse} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
