/**
 * Lightweight theme hook for standalone Tauri windows (ContextBar, MenuBar, CommandPalette).
 *
 * These windows don't have a Redux Provider, so they can't use useTheme().
 * Instead, they read theme settings directly from localStorage (shared across
 * all Tauri windows on the same origin) and listen for `storage` events to
 * stay in sync when the main window changes settings.
 */
import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

type Theme = "light" | "dark" | "system";
type AccentColor = "cyan" | "blue" | "violet" | "rose" | "orange" | "green" | "teal";
type FontSize = "small" | "default" | "large";
type LayoutDensity = "compact" | "comfortable" | "spacious";

const ACCENT_HUES: Record<AccentColor, number> = {
  cyan: 220,
  blue: 250,
  violet: 280,
  rose: 10,
  orange: 55,
  green: 155,
  teal: 185,
};

const FONT_SIZE_ZOOM: Record<FontSize, number> = {
  small: 0.9,
  default: 1,
  large: 1.1,
};

function readTheme(): Theme {
  return (localStorage.getItem("agentx-theme") as Theme) || "system";
}

function readAccentColor(): AccentColor {
  return (localStorage.getItem("agentx-accent-color") as AccentColor) || "cyan";
}

function readFontSize(): FontSize {
  return (localStorage.getItem("agentx-font-size") as FontSize) || "default";
}

function readLayoutDensity(): LayoutDensity {
  return (localStorage.getItem("agentx-layout-density") as LayoutDensity) || "comfortable";
}

/** Resolve whether dark mode is active (considering "system" preference). */
function isDarkMode(theme: Theme): boolean {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return theme === "dark";
}

/** Sync the native NSWindow appearance so vibrancy material matches dark/light. */
function syncNativeAppearance(dark: boolean) {
  invoke("set_native_appearance", { dark }).catch(() => {});
  // Also sync the quickchat NSPanel (no-op if panel doesn't exist yet)
  invoke("sync_quickchat_panel_appearance", { dark }).catch(() => {});
  // Sync the Dynamic Island panel appearance
  invoke("sync_island_panel_appearance", { dark }).catch(() => {});
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark = isDarkMode(theme);
  root.classList.toggle("dark", dark);
  syncNativeAppearance(dark);
}

function applyAccentColor(color: AccentColor) {
  const hue = ACCENT_HUES[color] ?? 220;
  document.documentElement.style.setProperty("--accent-hue", String(hue));
}

function applyFontSize(size: FontSize) {
  const zoom = FONT_SIZE_ZOOM[size] ?? 1;
  document.documentElement.style.zoom = zoom === 1 ? "" : String(zoom);
}

function applyLayoutDensity(density: LayoutDensity) {
  const root = document.documentElement;
  if (density === "comfortable") {
    delete root.dataset.density;
  } else {
    root.dataset.density = density;
  }
}

function applyAll() {
  applyTheme(readTheme());
  applyAccentColor(readAccentColor());
  applyFontSize(readFontSize());
  applyLayoutDensity(readLayoutDensity());
}

/**
 * Call this hook once at the top level of a standalone window component.
 * It applies and keeps in sync: dark mode, accent color, font size, layout density.
 */
export function useStandaloneTheme() {
  const mediaRef = useRef<MediaQueryList | null>(null);
  const mediaListenerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);

  const setupMediaListener = useCallback(() => {
    // Clean up previous listener
    if (mediaRef.current && mediaListenerRef.current) {
      mediaRef.current.removeEventListener("change", mediaListenerRef.current);
    }

    const theme = readTheme();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle("dark", e.matches);
        syncNativeAppearance(e.matches);
      };
      mq.addEventListener("change", listener);
      mediaRef.current = mq;
      mediaListenerRef.current = listener;
    } else {
      mediaRef.current = null;
      mediaListenerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Apply all settings on mount
    applyAll();
    setupMediaListener();

    // Listen for localStorage changes from other windows
    const onStorage = (e: StorageEvent) => {
      switch (e.key) {
        case "agentx-theme":
          applyTheme(readTheme());
          setupMediaListener();
          break;
        case "agentx-accent-color":
          applyAccentColor(readAccentColor());
          break;
        case "agentx-font-size":
          applyFontSize(readFontSize());
          break;
        case "agentx-layout-density":
          applyLayoutDensity(readLayoutDensity());
          break;
      }
    };
    window.addEventListener("storage", onStorage);

    // Also re-apply when window gains focus (covers edge cases where
    // storage event was missed, e.g. window was hidden)
    const onFocus = () => applyAll();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      if (mediaRef.current && mediaListenerRef.current) {
        mediaRef.current.removeEventListener("change", mediaListenerRef.current);
      }
    };
  }, [setupMediaListener]);
}
