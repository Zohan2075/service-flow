"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "@/lib/store";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeSetting = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sf-theme") as Theme) || "system";
    }
    return "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  const accentColor = useStore((s) => s.settings.accentColor);
  const customSurfaceLight = useStore((s) => s.settings.customSurfaceLight);
  const customSurfaceDark = useStore((s) => s.settings.customSurfaceDark);
  const customBackgroundLight = useStore((s) => s.settings.customBackgroundLight);
  const customBackgroundDark = useStore((s) => s.settings.customBackgroundDark);

  const resolveTheme = useCallback((t: Theme): "light" | "dark" => {
    return t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark"
      : "light";
  }, []);

  const applyAppearance = useCallback((nextResolved: "light" | "dark") => {
    const root = document.documentElement;
    const activeSurface = nextResolved === "dark" ? customSurfaceDark : customSurfaceLight;
    const activeBackground = nextResolved === "dark" ? customBackgroundDark : customBackgroundLight;

    root.style.setProperty("--sf-primary", hexToRgb(accentColor));
    if (activeSurface) {
      root.style.setProperty("--sf-surface", hexToRgb(activeSurface));
    } else {
      root.style.removeProperty("--sf-surface");
    }
    if (activeBackground) {
      root.style.setProperty("--sf-bg", hexToRgb(activeBackground));
    } else {
      root.style.removeProperty("--sf-bg");
    }
  }, [accentColor, customBackgroundDark, customBackgroundLight, customSurfaceDark, customSurfaceLight]);

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    const nextResolved = resolveTheme(t);
    root.classList.toggle("dark", nextResolved === "dark");
    setResolved(nextResolved);
  }, [resolveTheme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem("sf-theme", t);
    setThemeState(t);
    updateSettings({ theme: t });
    applyTheme(t);
  };

  useEffect(() => {
    const saved = (localStorage.getItem("sf-theme") as Theme) || "system";
    const activeTheme = themeSetting || saved;
    setThemeState(activeTheme);
    applyTheme(activeTheme);
    localStorage.setItem("sf-theme", activeTheme);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const current = (localStorage.getItem("sf-theme") as Theme) || "system";
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [applyTheme, themeSetting]);

  useLayoutEffect(() => {
    applyAppearance(resolved);
  }, [applyAppearance, resolved]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
