"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useStore } from "@/lib/store";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { COUNTDOWN_PRESETS_MIN } from "@/lib/timePresets";
import { useDisplayNow } from "@/lib/displayClock";
import {
  formatClock,
  formatClockDate,
  formatDuration,
  getDeviceTimeZone,
  getTimeZoneOptions,
  humanizeTimeZone,
} from "@/lib/timeFormat";
import OptionChip from "@/components/ui/OptionChip";
import { SPRING_SNAPPY } from "@/components/ui/motion";
import FullscreenClock, { type FullscreenMode } from "@/components/presiding/FullscreenClock";
import TimerRing from "@/components/presiding/TimerRing";
import TimerOptionsMenu, { type TimerMenuMode } from "@/components/presiding/TimerOptionsMenu";
import { useTimerShortcuts } from "@/components/presiding/useTimerShortcuts";

/* ---------- constants + helpers ---------- */

const CARD_CLASS =
  "bg-surface rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card p-4 md:p-5";
const CARD_HEADER_CLASS =
  "flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400";
const CARD_HEADER_ACTIONS_CLASS = "ml-auto -my-1 flex items-center gap-1";
const CARD_FULLSCREEN_BUTTON_CLASS =
  "flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700/60 dark:hover:text-slate-300";
const TIME_TEXT_CLASS =
  "mt-4 text-center font-mono tabular-nums font-black text-slate-800 dark:text-slate-100";
const STOPWATCH_TIME_CLASS =
  "mt-4 text-center font-mono tabular-nums font-black text-slate-800 dark:text-slate-100";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary";

type TimerState = "ready" | "running" | "paused" | "finished";

const STATE_CHIP_CLASS: Record<TimerState, string> = {
  ready: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  paused: "bg-primary/10 text-primary",
  finished: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

const STATE_LABEL_KEY: Record<TimerState, TranslationKey> = {
  ready: "time.stateReady",
  running: "time.stateRunning",
  paused: "time.statePaused",
  finished: "time.stateFinished",
};

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

/* ---------- shared pieces ---------- */

function ActionButton({
  onClick,
  active = false,
  icon,
  label,
  disabled = false,
  size = "md",
}: {
  onClick: () => void;
  active?: boolean;
  icon: string;
  label: string;
  disabled?: boolean;
  size?: "md" | "lg";
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
        "inline-flex items-center gap-2 rounded-xl px-5 text-sm font-black shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "lg" ? "min-h-12" : "min-h-11",
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
      className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-surface px-5 text-sm font-semibold text-slate-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950/20"
    >
      <span className="material-symbols-outlined text-lg leading-none">restart_alt</span>
      {label}
    </motion.button>
  );
}

function StateChip({ state, label }: { state: TimerState; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
        STATE_CHIP_CLASS[state],
      )}
    >
      {label}
    </span>
  );
}

function ExtendChip({ minutes, onClick }: { minutes: number; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={SPRING_SNAPPY}
      className="inline-flex min-h-9 items-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-black text-primary transition-colors hover:bg-primary/15"
    >
      +{minutes} min
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
  const countdownResume = useStore((s) => s.countdownResume);
  const countdownReset = useStore((s) => s.countdownReset);
  const countdownExtend = useStore((s) => s.countdownExtend);
  const setCountryClock = useStore((s) => s.setCountryClock);
  const stopwatchLap = useStore((s) => s.stopwatchLap);
  const timerPrefs = useStore((s) => s.timeTools.timerPrefs);

  // Shared display clock: every view repaints the same timestamp-derived value.
  const nowMs = useDisplayNow();
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  // Fullscreen display overlay, locked to one option at a time.
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode | null>(null);
  // Shared options menu + the card that keyboard shortcuts target.
  const [menuMode, setMenuMode] = useState<TimerMenuMode | null>(null);
  const [activeTimer, setActiveTimer] = useState<"stopwatch" | "countdown">("stopwatch");
  const [announcement, setAnnouncement] = useState("");

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

  // Display size shared by both views (compact / normal / large).
  const stopwatchTimeSize =
    timerPrefs.fontScale === "compact" ? "text-4xl" : timerPrefs.fontScale === "large" ? "text-6xl" : "text-5xl";
  const countdownTimeSize =
    timerPrefs.fontScale === "compact"
      ? "text-2xl md:text-3xl"
      : timerPrefs.fontScale === "large"
        ? "text-4xl md:text-5xl"
        : "text-3xl md:text-4xl";
  const clockTimeSize =
    timerPrefs.fontScale === "compact" ? "text-3xl" : timerPrefs.fontScale === "large" ? "text-5xl" : "text-4xl";

  /* ----- countdown ----- */
  const [presetMin, setPresetMin] = useState<number | null>(5);
  // True when the user picked a preset/custom time after a pause: the primary
  // action becomes Start with that time instead of Resume of the old run.
  const [selectionTouched, setSelectionTouched] = useState(false);
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
      : selectionTouched
        ? configuredMs
        : countdown.remainingMs > 0
          ? countdown.remainingMs
          : countdown.finishedAtMs != null
            ? 0
            : configuredMs;
  const countdownFinished = !countdown.running && countdown.finishedAtMs != null;
  const countdownActionLabel = countdown.running
    ? t("time.pause")
    : canResume && !selectionTouched
      ? t("time.resume")
      : t("time.start");
  const countdownCanStart = canResume || configuredMs > 0;
  const pausedStopwatch = !stopwatch.running && stopwatchElapsedMs > 0;

  // Ring reflects the remaining fraction of the last configured duration:
  // frozen while paused, empty when finished, full when idle/ready.
  const countdownProgress =
    countdown.totalMs > 0 && !selectionTouched
      ? Math.min(
          1,
          Math.max(
            0,
            (countdownFinished ? 0 : runningRemainingMs ?? countdown.remainingMs) / countdown.totalMs,
          ),
        )
      : 1;
  const stopwatchState: TimerState = stopwatch.running
    ? "running"
    : stopwatchElapsedMs > 0
      ? "paused"
      : "ready";
  const countdownState: TimerState = countdown.running
    ? "running"
    : selectionTouched
      ? "ready"
      : countdownFinished
        ? "finished"
        : canResume
          ? "paused"
          : "ready";

  // A new run (from any surface: card, pill or fullscreen) ends the pending selection.
  useEffect(() => {
    if (countdown.running) setSelectionTouched(false);
  }, [countdown.running]);

  // Throttled screen-reader announcements: state transitions only, never ticks.
  const a11yPrevRef = useRef({
    stopwatch: stopwatch.running,
    countdown: countdown.running,
    finished: countdown.finishedAtMs != null,
    laps: stopwatch.laps.length,
  });
  useEffect(() => {
    const prev = a11yPrevRef.current;
    let message = "";
    if (stopwatch.laps.length > prev.laps) message = t("time.a11yLap");
    else if (countdown.finishedAtMs != null && !prev.finished) message = t("time.a11yFinished");
    else if (stopwatch.running && !prev.stopwatch) message = t("time.a11yStarted");
    else if (!stopwatch.running && prev.stopwatch) message = t("time.a11yPaused");
    else if (countdown.running && !prev.countdown) message = t("time.a11yStarted");
    else if (!countdown.running && prev.countdown) message = t("time.a11yPaused");
    a11yPrevRef.current = {
      stopwatch: stopwatch.running,
      countdown: countdown.running,
      finished: countdown.finishedAtMs != null,
      laps: stopwatch.laps.length,
    };
    if (message) setAnnouncement(message);
  }, [stopwatch.running, countdown.running, stopwatch.laps.length, countdown.finishedAtMs, t]);

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

  // Runtime mutual exclusion: the two timers cannot run at the same time.
  // Only start/resume is blocked — the pause action of a running timer stays
  // enabled (its flag is false while that timer runs).
  const stopwatchBusy = !stopwatch.running && countdown.running;
  const countdownBusy = !countdown.running && stopwatch.running;

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
    if (canResume && !selectionTouched) countdownResume();
    else countdownStart(configuredMs);
  };
  const floatClock = () => {
    setWidgetMode("clock");
    setWidgetVisible(true);
  };
  const repeatCountdown = () => {
    if (countdown.totalMs > 0) countdownStart(countdown.totalMs);
  };
  const selectPreset = (min: number) => {
    setPresetMin(min);
    setCustomMin("");
    setCustomSec("");
    setSelectionTouched(true);
  };
  const resetCountdown = () => {
    countdownReset();
    setSelectionTouched(false);
  };

  useTimerShortcuts({
    mode: activeTimer,
    enabled: fullscreenMode === null && menuMode === null,
    onToggleTimer: activeTimer === "stopwatch" ? toggleStopwatch : toggleCountdown,
    onLap: stopwatchLap,
    onReset: activeTimer === "stopwatch" ? stopwatchReset : resetCountdown,
    onToggleFullscreen: () => setFullscreenMode(activeTimer),
    onToggleMenu: () => setMenuMode(activeTimer),
  });

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
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {/* ===== Cronómetro ===== */}
      <section
        className={CARD_CLASS}
        onPointerDownCapture={() => setActiveTimer("stopwatch")}
        onFocusCapture={() => setActiveTimer("stopwatch")}
      >
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">timer</span>
          {t("time.stopwatch")}
          <StateChip state={stopwatchState} label={t(STATE_LABEL_KEY[stopwatchState])} />
          <div className={CARD_HEADER_ACTIONS_CLASS}>
            <button
              type="button"
              onClick={() => setMenuMode("stopwatch")}
              aria-label={t("time.options")}
              className={CARD_FULLSCREEN_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">tune</span>
            </button>
            <button
              type="button"
              onClick={() => setFullscreenMode("stopwatch")}
              aria-label={t("time.fullscreen")}
              className={CARD_FULLSCREEN_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">fullscreen</span>
            </button>
          </div>
        </h3>
        <p className={cn(STOPWATCH_TIME_CLASS, stopwatchTimeSize)} suppressHydrationWarning>
          {formatDuration(stopwatchElapsedMs, timerPrefs.precision)}
        </p>
        {stopwatchBusy && (
          <p className="mt-1 text-center text-xs font-bold text-amber-500">{t("time.timerBusy")}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <ActionButton
            onClick={toggleStopwatch}
            active={stopwatch.running}
            icon={stopwatch.running ? "pause" : "play_arrow"}
            label={stopwatchActionLabel}
            disabled={stopwatchBlocked || stopwatchBusy}
            size="lg"
          />
          <ActionButton
            onClick={stopwatchLap}
            icon="flag"
            label={t("time.lap")}
            disabled={!stopwatch.running}
            size="lg"
          />
          <ResetButton onClick={stopwatchReset} label={t("time.reset")} />
        </div>
        {stopwatch.laps.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>{t("time.laps")}</span>
              <span>{stopwatch.laps.length}</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {stopwatch.laps
                .slice(-5)
                .reverse()
                .map((lapMs, index) => {
                  const number = stopwatch.laps.length - index;
                  const previous = stopwatch.laps[number - 2] ?? 0;
                  return (
                    <li
                      key={number}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300"
                    >
                      <span className="font-sans font-bold text-slate-400">#{number}</span>
                      <span>{formatDuration(lapMs, timerPrefs.precision)}</span>
                      <span className="text-primary">+{formatDuration(lapMs - previous, timerPrefs.precision)}</span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </section>

      {/* ===== Cuenta regresiva ===== */}
      <section
        className={CARD_CLASS}
        onPointerDownCapture={() => setActiveTimer("countdown")}
        onFocusCapture={() => setActiveTimer("countdown")}
      >
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">hourglass_bottom</span>
          {t("time.countdown")}
          <StateChip state={countdownState} label={t(STATE_LABEL_KEY[countdownState])} />
          <div className={CARD_HEADER_ACTIONS_CLASS}>
            <button
              type="button"
              onClick={() => setMenuMode("countdown")}
              aria-label={t("time.options")}
              className={CARD_FULLSCREEN_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">tune</span>
            </button>
            <button
              type="button"
              onClick={() => setFullscreenMode("countdown")}
              aria-label={t("time.fullscreen")}
              className={CARD_FULLSCREEN_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">fullscreen</span>
            </button>
          </div>
        </h3>
        <div className="mt-4 flex justify-center">
          <TimerRing progress={countdownProgress} className="w-48 h-48 md:w-52 md:h-52">
            <p
              className={cn(
                "font-mono tabular-nums font-black text-slate-800 dark:text-slate-100",
                countdownTimeSize,
                countdownFinished && "text-red-500 animate-pulse",
              )}
              suppressHydrationWarning
            >
              {formatDuration(displayMs)}
            </p>
          </TimerRing>
        </div>
        {countdownFinished && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-xs font-bold text-red-500">{t("time.done")}</p>
            <ActionButton
              onClick={repeatCountdown}
              icon="replay"
              label={t("time.repeat")}
              disabled={countdownBlocked || countdownBusy || countdown.totalMs <= 0}
              size="lg"
            />
          </div>
        )}
        {countdown.running && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <ExtendChip minutes={1} onClick={() => countdownExtend(60_000)} />
            <ExtendChip minutes={5} onClick={() => countdownExtend(300_000)} />
          </div>
        )}
        {countdownBusy && (
          <p className="mt-1 text-center text-xs font-bold text-amber-500">{t("time.timerBusy")}</p>
        )}
        {!countdown.running && (
          <>
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
                    setSelectionTouched(true);
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
                    setSelectionTouched(true);
                  }}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <ActionButton
            onClick={toggleCountdown}
            active={countdown.running}
            icon={countdown.running ? "pause" : "play_arrow"}
            label={countdownActionLabel}
            disabled={countdownBlocked || countdownBusy || (!countdown.running && !countdownCanStart)}
            size="lg"
          />
          <ResetButton onClick={resetCountdown} label={t("time.reset")} />
        </div>
      </section>

      {/* ===== Hora del país ===== */}
      <section className={CARD_CLASS}>
        <h3 className={CARD_HEADER_CLASS}>
          <span className="material-symbols-outlined text-base">public</span>
          {t("time.countryClock")}
          <div className={CARD_HEADER_ACTIONS_CLASS}>
            <button
              type="button"
              onClick={() => setMenuMode("clock")}
              aria-label={t("time.options")}
              className={CARD_FULLSCREEN_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">tune</span>
            </button>
            <button
              type="button"
              onClick={() => setFullscreenMode("country")}
              aria-label={t("time.fullscreen")}
              className={CARD_FULLSCREEN_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">fullscreen</span>
            </button>
          </div>
        </h3>
        <p className={cn(TIME_TEXT_CLASS, clockTimeSize)} suppressHydrationWarning>
          {formatClock(now, { timeZone: effectiveTz, hour12, locale, showSeconds: timerPrefs.showSeconds })}
        </p>
        {timerPrefs.showDate && (
          <p
            className="mt-1 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
            suppressHydrationWarning
          >
            {formatClockDate(now, { timeZone: effectiveTz, locale })}
          </p>
        )}
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

      <TimerOptionsMenu
        open={menuMode !== null}
        onClose={() => setMenuMode(null)}
        mode={menuMode ?? "stopwatch"}
        onOpenFullscreen={() => {
          if (menuMode) setFullscreenMode(menuMode === "clock" ? "country" : menuMode);
        }}
      />

      {/* Portal to <body>: a transformed ancestor would otherwise turn `fixed` into a
          box offset from the window top, leaving a strip of page visible above it. */}
      {fullscreenMode &&
        createPortal(
          <FullscreenClock
            mode={fullscreenMode}
            onClose={() => setFullscreenMode(null)}
            initialCountdownMs={configuredMs}
          />,
          document.body,
        )}
    </div>
  );
}
