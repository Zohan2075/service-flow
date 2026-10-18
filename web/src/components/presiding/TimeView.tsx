"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import OptionChip from "@/components/ui/OptionChip";
import { SPRING_SNAPPY } from "@/components/ui/motion";

/* ---------- constants + helpers ---------- */

const COUNTDOWN_PRESETS_MIN = [1, 3, 5, 10, 15, 30, 45, 60];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Mexico_City",
  "America/Santo_Domingo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Bogota",
  "America/Lima",
  "America/Caracas",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const CARD_CLASS =
  "bg-surface rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card p-4 md:p-5";
const CARD_HEADER_CLASS =
  "flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400";
const TIME_TEXT_CLASS =
  "mt-4 text-center font-mono tabular-nums text-4xl font-black text-slate-800 dark:text-slate-100";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary";

function fmtHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function fmtZoneTime(now: Date, timeZone: string, hour12: boolean, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12,
      ...(timeZone ? { timeZone } : {}),
    }).format(now);
  } catch {
    return "--:--:--";
  }
}

function fmtZoneDate(now: Date, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      ...(timeZone ? { timeZone } : {}),
    }).format(now);
  } catch {
    return "";
  }
}

function tzOffsetLabel(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const value = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return value.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

function humanizeTimeZone(tz: string): string {
  const segment = tz.split("/").pop() ?? tz;
  return segment.replace(/_/g, " ");
}

function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

function getTimeZoneOptions(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("timeZone");
      if (values.length > 0) return values;
    }
  } catch {
    // Fall through to the curated list.
  }
  return FALLBACK_TIMEZONES;
}

/* ---------- shared pieces ---------- */

function ActionButton({
  onClick,
  active = false,
  icon,
  label,
  disabled = false,
}: {
  onClick: () => void;
  active?: boolean;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={SPRING_SNAPPY}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-black shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-amber-500 text-black" : "bg-primary text-white",
      )}
    >
      <span className="material-symbols-outlined text-lg leading-none">{icon}</span>
      {label}
    </motion.button>
  );
}

function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={SPRING_SNAPPY}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-surface px-5 text-sm font-semibold text-slate-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950/20"
    >
      <span className="material-symbols-outlined text-lg leading-none">restart_alt</span>
      {label}
    </motion.button>
  );
}

/* ---------- main component ---------- */

export default function TimeView() {
  const { t, language } = useT();
  const prefsTimeFormat = useStore((s) => s.presidingPrefs.timeFormat);
  const stopwatch = useStore((s) => s.timeTools.stopwatch);
  const countdown = useStore((s) => s.timeTools.countdown);
  const countryTz = useStore((s) => s.timeTools.countryTz);
  const countryLabel = useStore((s) => s.timeTools.countryLabel);
  const widgetMode = useStore((s) => s.timeTools.widgetMode);
  const setWidgetMode = useStore((s) => s.setWidgetMode);
  const widgetVisible = useStore((s) => s.timeTools.widgetVisible);
  const setWidgetVisible = useStore((s) => s.setWidgetVisible);
  const stopwatchStart = useStore((s) => s.stopwatchStart);
  const stopwatchPause = useStore((s) => s.stopwatchPause);
  const stopwatchReset = useStore((s) => s.stopwatchReset);
  const countdownStart = useStore((s) => s.countdownStart);
  const countdownPause = useStore((s) => s.countdownPause);
  const countdownReset = useStore((s) => s.countdownReset);
  const setCountryClock = useStore((s) => s.setCountryClock);

  // Single 1 s tick drives every display; all values derive from Date.now().
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  const locale = language === "es" ? "es-ES" : "en-US";
  const hour12 = prefsTimeFormat === "12h";
  const deviceTz = useMemo(() => getDeviceTimeZone(), []);
  const effectiveTz = countryTz ?? deviceTz;

  /* ----- stopwatch ----- */
  const stopwatchElapsedMs =
    stopwatch.accumulatedMs +
    (stopwatch.running && stopwatch.startedAtMs != null
      ? Math.max(0, nowMs - stopwatch.startedAtMs)
      : 0);
  const stopwatchActionLabel = stopwatch.running
    ? t("time.pause")
    : stopwatchElapsedMs > 0
      ? t("time.resume")
      : t("time.start");

  /* ----- countdown ----- */
  const [presetMin, setPresetMin] = useState<number | null>(5);
  const [customMin, setCustomMin] = useState("");
  const [customSec, setCustomSec] = useState("");
  const hasCustom = customMin.trim() !== "" || customSec.trim() !== "";
  const customMs =
    (Math.max(0, parseInt(customMin || "0", 10) || 0) * 60 +
      Math.min(59, Math.max(0, parseInt(customSec || "0", 10) || 0))) *
    1000;
  const presetMs = presetMin != null ? presetMin * 60_000 : 0;
  const configuredMs = hasCustom ? customMs : presetMs;
  const runningRemainingMs =
    countdown.running && countdown.endsAtMs != null
      ? Math.max(0, countdown.endsAtMs - nowMs)
      : null;
  const canResume =
    !countdown.running && countdown.finishedAtMs == null && countdown.remainingMs > 0;
  const displayMs =
    runningRemainingMs != null
      ? runningRemainingMs
      : countdown.remainingMs > 0
        ? countdown.remainingMs
        : countdown.finishedAtMs != null
          ? 0
          : configuredMs;
  const countdownFinished = !countdown.running && countdown.finishedAtMs != null;
  const countdownActionLabel = countdown.running
    ? t("time.pause")
    : canResume
      ? t("time.resume")
      : t("time.start");
  const countdownCanStart = canResume || configuredMs > 0;
  const pausedStopwatch = !stopwatch.running && stopwatchElapsedMs > 0;

  // Mutual exclusion: while the floating pill is open it "presents" one
  // clock — starting or floating a different one is blocked until it is
  // closed (×). Controlling the presented timer itself stays enabled.
  const floatedKind: "clock" | "stopwatch" | "countdown" | null = !widgetVisible
    ? null
    : widgetMode === "clock"
      ? "clock"
      : widgetMode === "stopwatch"
        ? "stopwatch"
        : widgetMode === "countdown"
          ? "countdown"
          : countdown.running
            ? "countdown"
            : stopwatch.running
              ? "stopwatch"
              : canResume
                ? "countdown"
                : pausedStopwatch
                  ? "stopwatch"
                  : "clock";
  const stopwatchBlocked = floatedKind !== null && floatedKind !== "stopwatch";
  const countdownBlocked = floatedKind !== null && floatedKind !== "countdown";

  const toggleStopwatch = () => {
    if (stopwatch.running) {
      stopwatchPause();
      return;
    }
    // The pill would otherwise keep showing the previously pinned clock.
    if (!widgetVisible && (widgetMode === "clock" || widgetMode === "countdown")) setWidgetMode("auto");
    stopwatchStart();
  };
  const toggleCountdown = () => {
    if (countdown.running) {
      countdownPause();
      return;
    }
    if (!widgetVisible && (widgetMode === "clock" || widgetMode === "stopwatch")) setWidgetMode("auto");
    countdownStart(canResume ? countdown.remainingMs : configuredMs);
  };
  const floatClock = () => {
    setWidgetMode("clock");
    setWidgetVisible(true);
  };
  const selectPreset = (min: number) => {
    setPresetMin(min);
    setCustomMin("");
    setCustomSec("");
  };

  /* ----- country clock ----- */
  const [detecting, setDetecting] = useState(false);
  const zoneOptions = useMemo(() => {
    const base = getTimeZoneOptions();
    if (countryTz && !base.includes(countryTz)) return [countryTz, ...base];
    return base;
  }, [countryTz]);

  const detectCountry = useCallback(() => {
    if (detecting) return;
    setDetecting(true);

    const failToDevice = (message: string) => {
      setCountryClock(null, null);
      toast(message);
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      failToDevice(t("time.failed"));
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const [geoResult, tzResult] = await Promise.allSettled([
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${language}`,
            ).then(async (response) => (response.ok ? ((await response.json()) as unknown) : null)),
            fetch(
              `https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`,
            ).then(async (response) => (response.ok ? ((await response.json()) as unknown) : null)),
          ]);

          const geo = geoResult.status === "fulfilled" ? (geoResult.value as { countryName?: unknown } | null) : null;
          const tzData = tzResult.status === "fulfilled" ? (tzResult.value as { timeZone?: unknown } | null) : null;
          const detectedTz =
            tzData && typeof tzData.timeZone === "string" && tzData.timeZone ? tzData.timeZone : null;
          const detectedLabel =
            geo && typeof geo.countryName === "string" && geo.countryName ? geo.countryName : null;

          if (!detectedTz) {
            failToDevice(t("time.failed"));
            return;
          }
          setCountryClock(detectedTz, detectedLabel);
          toast.success(t("time.detected"));
        } catch {
          failToDevice(t("time.failed"));
        } finally {
          setDetecting(false);
        }
      },
      () => {
        failToDevice(t("time.denied"));
        setDetecting(false);
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }, [detecting, language, setCountryClock, t]);

  return (
    <div
      role="region"
      aria-label={t("time.title")}
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain"
    >
      {/* ===== Floating widget display mode ===== */}
      <section className={CARD_CLASS}>
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">pip</span>
          {t("time.widgetMode")}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["auto", "clock", "stopwatch", "countdown"] as const).map((mode) => (
            <OptionChip key={mode} selected={widgetMode === mode} onClick={() => setWidgetMode(mode)}>
              {mode === "auto"
                ? t("time.modeAuto")
                : mode === "clock"
                  ? t("time.modeClock")
                  : mode === "stopwatch"
                    ? t("time.stopwatch")
                    : t("time.countdown")}
            </OptionChip>
          ))}
        </div>
        {widgetVisible && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined text-base leading-none">pip</span>
            {t("time.closeWidgetFirst")}
          </p>
        )}
      </section>

      {/* ===== Cronómetro ===== */}
      <section className={CARD_CLASS}>
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">timer</span>
          {t("time.stopwatch")}
        </h3>
        <p className={TIME_TEXT_CLASS} suppressHydrationWarning>
          {fmtHMS(stopwatchElapsedMs)}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <ActionButton
            onClick={toggleStopwatch}
            active={stopwatch.running}
            icon={stopwatch.running ? "pause" : "play_arrow"}
            label={stopwatchActionLabel}
            disabled={stopwatchBlocked}
          />
          <ResetButton onClick={stopwatchReset} label={t("time.reset")} />
        </div>
      </section>

      {/* ===== Cuenta regresiva ===== */}
      <section className={CARD_CLASS}>
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">hourglass_bottom</span>
          {t("time.countdown")}
        </h3>
        <p
          className={cn(TIME_TEXT_CLASS, countdownFinished && "text-red-500 animate-pulse")}
          suppressHydrationWarning
        >
          {fmtHMS(displayMs)}
        </p>
        {countdownFinished && (
          <p className="mt-1 text-center text-xs font-bold text-red-500">{t("time.done")}</p>
        )}
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {t("time.presets")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COUNTDOWN_PRESETS_MIN.map((min) => (
            <OptionChip key={min} selected={!hasCustom && presetMin === min} onClick={() => selectPreset(min)}>
              {min} min
            </OptionChip>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("time.minutes")}
            </span>
            <input
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              placeholder="0"
              value={customMin}
              onChange={(event) => {
                setCustomMin(event.target.value.replace(/\D/g, "").slice(0, 3));
                setPresetMin(null);
              }}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("time.seconds")}
            </span>
            <input
              type="number"
              min={0}
              max={59}
              inputMode="numeric"
              placeholder="0"
              value={customSec}
              onChange={(event) => {
                setCustomSec(event.target.value.replace(/\D/g, "").slice(0, 2));
                setPresetMin(null);
              }}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <ActionButton
            onClick={toggleCountdown}
            active={countdown.running}
            icon={countdown.running ? "pause" : "play_arrow"}
            label={countdownActionLabel}
            disabled={!countdownCanStart || countdownBlocked}
          />
          <ResetButton onClick={countdownReset} label={t("time.reset")} />
        </div>
      </section>

      {/* ===== Reloj local ===== */}
      <section className={CARD_CLASS}>
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">schedule</span>
          {t("time.localClock")}
        </h3>
        <p className={TIME_TEXT_CLASS} suppressHydrationWarning>
          {fmtZoneTime(now, deviceTz, hour12, locale)}
        </p>
        <p
          className="mt-1 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
          suppressHydrationWarning
        >
          {fmtZoneDate(now, deviceTz, locale)}
        </p>
        <div className="mt-4 flex items-center justify-center">
          <ActionButton
            onClick={floatClock}
            icon="pip"
            label={t("time.float")}
            disabled={widgetVisible}
          />
        </div>
      </section>

      {/* ===== Hora del país ===== */}
      <section className={CARD_CLASS}>
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">public</span>
          {t("time.countryClock")}
        </h3>
        <p className={TIME_TEXT_CLASS} suppressHydrationWarning>
          {fmtZoneTime(now, effectiveTz, hour12, locale)}
        </p>
        <p
          className="mt-1 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
          suppressHydrationWarning
        >
          {fmtZoneDate(now, effectiveTz, locale)}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
          <span className="text-slate-500 dark:text-slate-400">
            {countryLabel ?? (countryTz ? humanizeTimeZone(countryTz) : t("time.deviceZone"))}
          </span>
          <span>{effectiveTz || t("time.noZone")}</span>
          <span>
            {t("time.offset")}: {tzOffsetLabel(now, effectiveTz) || "—"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <ActionButton
            onClick={detectCountry}
            icon={detecting ? "progress_activity" : "my_location"}
            label={detecting ? t("time.detecting") : t("time.detect")}
            disabled={detecting}
          />
          <ActionButton
            onClick={floatClock}
            icon="pip"
            label={t("time.float")}
            disabled={widgetVisible}
          />
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t("time.changeTz")}
          </span>
          <select
            value={countryTz ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setCountryClock(value || null, value ? humanizeTimeZone(value) : null);
            }}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-surface px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t("time.deviceZone")}</option>
            {zoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}
