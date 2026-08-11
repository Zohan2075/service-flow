"use client";

import { useTranslation } from "react-i18next";
import { useApp } from "./AppProvider";
import { getDefaultConfig } from "@/lib/meeting";
import { saveConfig, loadPreferences, savePreferences } from "@/lib/storage";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { prefs, setLanguage, setTheme, setTimeFormat } = useApp();
  const isEs = prefs.language === "es";

  const toggleLanguage = () => {
    const next = prefs.language === "en" ? "es" : "en";
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  const toggleTheme = () => setTheme(prefs.theme === "light" ? "dark" : "light");

  const handleReset = () => {
    if (window.confirm(t("settings.resetConfirm"))) {
      saveConfig(getDefaultConfig());
      window.location.reload();
    }
  };

  const handleAutoAdvance = () => {
    const p = loadPreferences();
    p.autoAdvance = !p.autoAdvance;
    savePreferences(p);
    window.location.reload();
  };

  const setMeetingTime = (hour: number, minute: number) => {
    const p = loadPreferences();
    p.meetingStartHour = hour;
    p.meetingStartMinute = minute;
    savePreferences(p);
    window.location.reload();
  };

  const currentHour = prefs.meetingStartHour;
  const currentMinute = prefs.meetingStartMinute;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-bold px-1 mb-2">{t("settings.title")}</h2>

      {/* Meeting start time */}
      <div className="px-4 py-4">
        <p className="text-sm font-medium">{t("settings.meetingTime")}</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t("settings.meetingTimeDesc")}</p>
        <div className="flex items-center gap-2 mt-2">
          <select
            value={currentHour}
            onChange={e => setMeetingTime(parseInt(e.target.value), currentMinute)}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{h.toString().padStart(2, "0")}</option>
            ))}
          </select>
          <span className="text-lg font-bold">:</span>
          <select
            value={currentMinute}
            onChange={e => setMeetingTime(currentHour, parseInt(e.target.value))}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
              <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {currentHour.toString().padStart(2, "0")}:{currentMinute.toString().padStart(2, "0")}
        </p>
      </div>
      <div className="border-t border-border mx-4" />

      {/* Time format (24h / 12h) */}
      <div className="px-4 py-4">
        <p className="text-sm font-medium">{t("settings.timeFormat")}</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t("settings.timeFormatDesc")}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setTimeFormat("24h")}
            className={`flex-1 touch-target rounded-lg py-2 text-sm font-bold transition-colors ${
              prefs.timeFormat === "24h"
                ? "bg-[#2B579A] text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t("settings.format24h")}
          </button>
          <button
            onClick={() => setTimeFormat("12h")}
            className={`flex-1 touch-target rounded-lg py-2 text-sm font-bold transition-colors ${
              prefs.timeFormat === "12h"
                ? "bg-[#2B579A] text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t("settings.format12h")}
          </button>
        </div>
      </div>
      <div className="border-t border-border mx-4" />

      <button onClick={toggleLanguage} className="w-full flex items-center justify-between px-4 py-4 rounded-xl hover:bg-muted/50 transition-colors touch-target text-left">
        <div><p className="text-sm font-medium">{t("settings.language")}</p><p className="text-xs text-muted-foreground">{t("settings.languageDesc")}</p></div>
        <span className="text-sm font-bold text-[#2B579A]">{prefs.language === "en" ? "EN" : "ES"} <span className="text-xs font-normal text-muted-foreground">{isEs ? "Español" : "English"}</span></span>
      </button>
      <div className="border-t border-border mx-4" />

      <button onClick={toggleTheme} className="w-full flex items-center justify-between px-4 py-4 rounded-xl hover:bg-muted/50 transition-colors touch-target text-left">
        <div><p className="text-sm font-medium">{t("settings.theme")}</p><p className="text-xs text-muted-foreground">{t("settings.themeDesc")}</p></div>
        <span className="text-sm font-bold text-[#2B579A]">{prefs.theme === "dark" ? t("settings.dark") : t("settings.light")}</span>
      </button>
      <div className="border-t border-border mx-4" />

      <button onClick={handleAutoAdvance} className="w-full flex items-center justify-between px-4 py-4 rounded-xl hover:bg-muted/50 transition-colors touch-target text-left">
        <div><p className="text-sm font-medium">{t("settings.autoAdvance")}</p><p className="text-xs text-muted-foreground">{t("settings.autoAdvanceDesc")}</p></div>
        <span className={`text-sm font-bold ${prefs.autoAdvance ? "text-[#2B579A]" : "text-muted-foreground"}`}>{prefs.autoAdvance ? "ON" : "OFF"}</span>
      </button>
      <div className="border-t border-border mx-4" />

      <button onClick={handleReset} className="w-full flex items-center justify-between px-4 py-4 rounded-xl hover:bg-danger/5 transition-colors touch-target text-left">
        <div><p className="text-sm font-medium text-danger">{t("settings.reset")}</p><p className="text-xs text-muted-foreground">{t("settings.resetDesc")}</p></div>
      </button>
      <div className="border-t border-border mx-4" />

      <div className="flex items-center justify-between px-4 py-4">
        <div><p className="text-sm font-medium">{t("settings.about")}</p><p className="text-xs text-muted-foreground">{t("settings.aboutDesc")}</p></div>
      </div>
    </div>
  );
}