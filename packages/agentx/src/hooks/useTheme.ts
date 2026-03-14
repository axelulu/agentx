import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import {
  setTheme,
  setAccentColor,
  setFontSize,
  setLayoutDensity,
  type AccentColor,
  type FontSize,
  type LayoutDensity,
} from "@/slices/settingsSlice";

const ACCENT_HUES: Record<AccentColor, number> = {
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

export function useTheme() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.settings.theme);
  const accentColor = useSelector((state: RootState) => state.settings.accentColor);
  const fontSize = useSelector((state: RootState) => state.settings.fontSize);
  const layoutDensity = useSelector((state: RootState) => state.settings.layoutDensity);

  // Apply dark/light theme class
  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);

      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  // Apply accent color
  useEffect(() => {
    const hue = ACCENT_HUES[accentColor] ?? 250;
    document.documentElement.style.setProperty("--accent-hue", String(hue));
  }, [accentColor]);

  // Apply font size via zoom
  useEffect(() => {
    const zoom = FONT_SIZE_ZOOM[fontSize] ?? 1;
    document.documentElement.style.zoom = zoom === 1 ? "" : String(zoom);
  }, [fontSize]);

  // Apply layout density
  useEffect(() => {
    const root = document.documentElement;
    if (layoutDensity === "comfortable") {
      delete root.dataset.density;
    } else {
      root.dataset.density = layoutDensity;
    }
  }, [layoutDensity]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    dispatch(setTheme(next));
  }, [theme, dispatch]);

  const setThemeMode = useCallback(
    (mode: "light" | "dark" | "system") => {
      dispatch(setTheme(mode));
    },
    [dispatch],
  );

  const setAccent = useCallback(
    (color: AccentColor) => {
      dispatch(setAccentColor(color));
    },
    [dispatch],
  );

  const setFontSizeMode = useCallback(
    (size: FontSize) => {
      dispatch(setFontSize(size));
    },
    [dispatch],
  );

  const setDensity = useCallback(
    (density: LayoutDensity) => {
      dispatch(setLayoutDensity(density));
    },
    [dispatch],
  );

  return {
    theme,
    accentColor,
    fontSize,
    layoutDensity,
    toggleTheme,
    setThemeMode,
    setAccent,
    setFontSizeMode,
    setDensity,
  };
}
