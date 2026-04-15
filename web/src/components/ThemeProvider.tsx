"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  const accentColor = useStore((s) => s.settings.accentColor);
  const customSurface = useStore((s) => s.settings.customSurface);
  const customBackground = useStore((s) => s.settings.customBackground);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    const isDark =
      t === "dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
    setResolved(isDark ? "dark" : "light");
  };

  const setTheme = (t: Theme) => {
    localStorage.setItem("sf-theme", t);
    setThemeState(t);
    applyTheme(t);
  };

  useEffect(() => {
    const saved = (localStorage.getItem("sf-theme") as Theme) || "system";
    setThemeState(saved);
    applyTheme(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const current = (localStorage.getItem("sf-theme") as Theme) || "system";
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Apply custom appearance CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sf-primary", hexToRgb(accentColor));

    if (customSurface) {
      root.style.setProperty("--sf-surface", hexToRgb(customSurface));
    } else {
      root.style.removeProperty("--sf-surface");
    }
    if (customBackground) {
      root.style.setProperty("--sf-bg", hexToRgb(customBackground));
    } else {
      root.style.removeProperty("--sf-bg");
    }
  }, [accentColor, customSurface, customBackground]);

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
