import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { setTheme } from "@/slices/settingsSlice";

export function useTheme() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.settings.theme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
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

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    dispatch(setTheme(next));
  }, [theme, dispatch]);

  const setThemeMode = useCallback(
    (mode: "light" | "dark" | "system") => {
      dispatch(setTheme(mode));
    },
    [dispatch]
  );

  return { theme, toggleTheme, setThemeMode };
}
