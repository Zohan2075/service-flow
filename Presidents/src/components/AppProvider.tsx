"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AppPreferences } from "@/types";
import { loadPreferences, savePreferences } from "@/lib/storage";

interface AppContextType {
  prefs: AppPreferences;
  setLanguage: (lang: "en" | "es") => void;
  setTheme: (theme: "light" | "dark") => void;
  setTimeFormat: (fmt: "24h" | "12h") => void;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT: AppPreferences = { language: "en", theme: "light", autoAdvance: false, meetingStartHour: 19, meetingStartMinute: 30, timeFormat: "24h" };

export function AppProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPreferences>(DEFAULT);

  useEffect(() => { setPrefs(loadPreferences()); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
  }, [prefs.theme]);

  useEffect(() => { savePreferences(prefs); }, [prefs]);

  const setLanguage = (lang: "en" | "es") => setPrefs(p => ({ ...p, language: lang }));
  const setTheme = (theme: "light" | "dark") => setPrefs(p => ({ ...p, theme }));
  const setTimeFormat = (fmt: "24h" | "12h") => setPrefs(p => ({ ...p, timeFormat: fmt }));

  return (
    <AppContext.Provider value={{ prefs, setLanguage, setTheme, setTimeFormat }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}