import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "car-utils-theme";

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference) {
  const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0d1110" : "#f4f5f2");
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, [preference]);

  const update = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Theme persistence is optional.
    }
    setPreference(next);
  }, []);

  return { preference, setPreference: update };
}
