"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useWakeLock } from "@/lib/wakeLock";
import { COUNTDOWN_PRESETS_MIN } from "@/lib/timePresets";
import TimerRing from "@/components/presiding/TimerRing";

/* ---------- constants + helpers ---------- */

const AUTO_HIDE_MS = 4000;

export type FullscreenMode = "stopwatch" | "countdown" | "local" | "country";

/* Local API shapes: optional so the app still compiles (and runs) on DOM
 * libs / browsers without the Screen Orientation lock API (iOS Safari ships
 * it late). No `any`. */

interface OrientationLockLike {
  lock?: (orientation: "landscape") => Promise<void>;
}

function getOrientationLock(): OrientationLockLike | null {
  if (typeof screen === "undefined" || !screen.orientation) return null;
  return screen.orientation as ScreenOrientation & OrientationLockLike;
}

function fmtHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function fmtClock(now: Date, timeZone: string, hour12: boolean, locale: string): string {
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

function fmtDate(now: Date, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(timeZone ? { timeZone } : {}),
    }).format(now);
  } catch {
    return "";
  }
}

function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/* ---------- big fullscreen controls ---------- */

const BIG_BUTTON_BASE =
  "inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-2xl px-8 text-lg font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/* ---------- main component ---------- */

export default function FullscreenClock({ mode, onClose }: { mode: FullscreenMode; onClose: () => void }) {
  const { t, language } = useT();

  const stopwatch = useStore((s) => s.timeTools.stopwatch);
  const countdown = useStore((s) => s.timeTools.countdown);
  const countryTz = useStore((s) => s.timeTools.countryTz);
  const timeFormat = useStore((s) => s.presidingPrefs.timeFormat);
  const stopwatchStart = useStore((s) => s.stopwatchStart);
  const stopwatchPause = useStore((s) => s.stopwatchPause);
  const stopwatchReset = useStore((s) => s.stopwatchReset);
  const countdownStart = useStore((s) => s.countdownStart);
  const countdownPause = useStore((s) => s.countdownPause);
  const countdownResume = useStore((s) => s.countdownResume);
  const countdownReset = useStore((s) => s.countdownReset);
  const setWidgetVisible = useStore((s) => s.setWidgetVisible);

  // Single 1 s tick drives every displayed value (same pattern as TimeView).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  // Fullscreen countdown selection (set-only; Start runs the configured time).
  const [presetMin, setPresetMin] = useState<number | null>(null);
  const [customMin, setCustomMin] = useState("");
  const [customSec, setCustomSec] = useState("");

  const locale = language === "es" ? "es-ES" : "en-US";
  const hour12 = timeFormat === "12h";
  const deviceTz = useMemo(() => getDeviceTimeZone(), []);

  const stopwatchElapsedMs =
    stopwatch.accumulatedMs +
    (stopwatch.running && stopwatch.startedAtMs != null
      ? Math.max(0, nowMs - stopwatch.startedAtMs)
      : 0);
  const countdownRemainingMs =
    countdown.running && countdown.endsAtMs != null
      ? Math.max(0, countdown.endsAtMs - nowMs)
      : countdown.remainingMs;

  // Runtime mutual exclusion (mirrors the TimeView flags — pause stays enabled).
  const stopwatchBlocked = !stopwatch.running && countdown.running;
  const countdownBlocked = !countdown.running && stopwatch.running;
  const anyTimerRunning = stopwatch.running || countdown.running;

  const countdownResumable =
    !countdown.running && countdown.remainingMs > 0 && countdown.finishedAtMs == null;
  const hasCustom = customMin !== "" || customSec !== "";
  const customMinNum = Math.min(999, Math.max(0, parseInt(customMin || "0", 10) || 0));
  const customSecNum = Math.min(59, Math.max(0, parseInt(customSec || "0", 10) || 0));
  const customMs = (customMinNum * 60 + customSecNum) * 1000;
  const configuredMs = hasCustom ? customMs : presetMin != null ? presetMin * 60_000 : countdown.totalMs;
  const countdownIdle =
    !countdown.running && countdown.remainingMs === 0 && countdown.finishedAtMs == null;
  const countdownFinished = !countdown.running && countdown.finishedAtMs != null;

  /* ----- exit handling (single close owner; closes via onClose) ----- */

  const closingRef = useRef(false);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    // Leaving fullscreen pauses the running timer (value kept) — same as the
    // pill's X. Single exit owner covers X, Escape and any other path.
    if (stopwatch.running) stopwatchPause();
    else if (countdown.running) countdownPause();
    // Fullscreen never leaves a floating clock behind.
    setWidgetVisible(false);
    onClose();
  }, [onClose, stopwatch.running, countdown.running, stopwatchPause, countdownPause, setWidgetVisible]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  /* ----- orientation lock (best-effort; silently no-ops without native fullscreen) ----- */

  useEffect(() => {
    const orientation = getOrientationLock();
    try {
      if (orientation?.lock) void orientation.lock("landscape").catch(() => {});
    } catch {
      // Orientation lock unsupported — the UI works in portrait.
    }
    return () => {
      try {
        if (typeof screen.orientation?.unlock === "function") screen.orientation.unlock();
      } catch {
        // Already unlocked / not supported.
      }
    };
  }, []);

  /* ----- wake lock (shared hook: re-acquired when the tab becomes visible) ----- */

  useWakeLock(true);

  /* ----- controls auto-hide while a timer runs ----- */

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    clearHideTimer();
    if (anyTimerRunning) {
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        setControlsVisible(false);
      }, AUTO_HIDE_MS);
    }
  }, [anyTimerRunning, clearHideTimer]);

  useEffect(() => {
    wakeControls();
    return clearHideTimer;
  }, [wakeControls, clearHideTimer]);

  /* ----- actions ----- */

  const selectPreset = (min: number) => {
    setPresetMin(min);
    setCustomMin("");
    setCustomSec("");
  };

  const startConfigured = () => {
    if (configuredMs <= 0 || countdownBlocked) return;
    countdownStart(configuredMs);
    // The card's start action reveals the pill; fullscreen keeps it hidden.
    setWidgetVisible(false);
  };

  const toggleStopwatch = () => {
    if (stopwatch.running) {
      stopwatchPause();
      return;
    }
    if (stopwatchBlocked) return;
    stopwatchStart();
    setWidgetVisible(false);
  };

  const toggleCountdown = () => {
    if (countdown.running) {
      countdownPause();
      return;
    }
    if (countdownBlocked || countdown.finishedAtMs != null) return;
    if (countdownResumable) countdownResume();
    else countdownStart(countdown.totalMs);
    setWidgetVisible(false);
  };

  const displayTz = mode === "country" ? (countryTz ?? deviceTz) : deviceTz;
  const countdownDisplayMs = countdown.running
    ? countdownRemainingMs
    : countdownIdle
      ? configuredMs
      : countdown.remainingMs;
  const displayText =
    mode === "stopwatch"
      ? fmtHMS(stopwatchElapsedMs)
      : mode === "countdown"
        ? fmtHMS(countdownDisplayMs)
        : fmtClock(now, displayTz, hour12, locale);

  // Idle shows the configured selection with a full ring; paused keeps the
  // remaining fraction; finished empties the ring.
  const countdownProgress = countdownFinished
    ? 0
    : countdownIdle
      ? 1
      : countdown.totalMs > 0
        ? Math.min(1, Math.max(0, countdownRemainingMs / countdown.totalMs))
        : 1;

  const modeLabel =
    mode === "stopwatch"
      ? t("time.stopwatch")
      : mode === "countdown"
        ? t("time.countdown")
        : mode === "country"
          ? t("time.countryClock")
          : t("time.localClock");

  const showStopwatchControls = mode === "stopwatch";
  const showCountdownControls = mode === "countdown";
  const busyHint = showStopwatchControls
    ? stopwatchBlocked
    : showCountdownControls
      ? countdownBlocked
      : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex select-none flex-col bg-slate-950 text-white"
      onClick={wakeControls}
    >
      <button
        type="button"
        onClick={requestClose}
        aria-label={t("time.exitFullscreen")}
        className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-10 inline-flex min-h-12 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span className="material-symbols-outlined text-xl leading-none">close</span>
        {t("time.exitFullscreen")}
      </button>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-white/45">{modeLabel}</p>
        {mode === "countdown" ? (
          <TimerRing
            progress={countdownProgress}
            className="w-[min(88vw,64dvh)] h-[min(88vw,64dvh)] landscape:w-[min(60vw,36dvh)] landscape:h-[min(60vw,36dvh)]"
            trackClassName="stroke-white/10"
          >
            <div className="font-mono text-[clamp(2rem,min(10vw,6.5dvh),8rem)] landscape:text-[clamp(1rem,min(7vw,5dvh),8rem)] font-black leading-none tabular-nums">
              <span suppressHydrationWarning>{displayText}</span>
            </div>
          </TimerRing>
        ) : (
          <div className="max-w-full font-mono text-[clamp(3.5rem,16vw,12rem)] font-black leading-none tabular-nums">
            <span suppressHydrationWarning>{displayText}</span>
          </div>
        )}
        {(mode === "local" || mode === "country") && (
          <p className="text-sm font-semibold text-white/60" suppressHydrationWarning>
            {fmtDate(now, displayTz, locale)}
          </p>
        )}
        {busyHint && (
          <p className="text-sm font-bold text-amber-400">{t("time.timerBusy")}</p>
        )}
      </div>

      {(showStopwatchControls || showCountdownControls) && (
        <div
          className={`shrink-0 flex flex-wrap items-center justify-center gap-4 p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] transition-opacity ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {showStopwatchControls && (
            <>
              <button
                type="button"
                onClick={toggleStopwatch}
                disabled={stopwatchBlocked}
                className={
                  stopwatch.running
                    ? `${BIG_BUTTON_BASE} bg-amber-500 text-black`
                    : `${BIG_BUTTON_BASE} bg-primary text-white`
                }
              >
                <span className="material-symbols-outlined text-2xl leading-none">
                  {stopwatch.running ? "pause" : "play_arrow"}
                </span>
                {stopwatch.running
                  ? t("time.pause")
                  : stopwatchElapsedMs > 0
                    ? t("time.resume")
                    : t("time.start")}
              </button>
              <button
                type="button"
                onClick={stopwatchReset}
                className={`${BIG_BUTTON_BASE} border border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
              >
                <span className="material-symbols-outlined text-2xl leading-none">restart_alt</span>
                {t("time.reset")}
              </button>
            </>
          )}

          {showCountdownControls && countdown.running && (
            <button
              type="button"
              onClick={toggleCountdown}
              className={`${BIG_BUTTON_BASE} bg-amber-500 text-black`}
            >
              <span className="material-symbols-outlined text-2xl leading-none">pause</span>
              {t("time.pause")}
            </button>
          )}

          {showCountdownControls && !countdown.running && (
            <div className="flex w-full max-w-2xl flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {countdownResumable && (
                  <button
                    type="button"
                    onClick={toggleCountdown}
                    disabled={countdownBlocked}
                    className={`${BIG_BUTTON_BASE} bg-primary text-white`}
                  >
                    <span className="material-symbols-outlined text-2xl leading-none">play_arrow</span>
                    {t("time.resume")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={startConfigured}
                  disabled={configuredMs <= 0 || countdownBlocked}
                  className={`${BIG_BUTTON_BASE} bg-primary text-white`}
                >
                  <span className="material-symbols-outlined text-2xl leading-none">play_arrow</span>
                  {t("time.start")}
                </button>
                {countdown.totalMs > 0 && (
                  <button
                    type="button"
                    onClick={countdownReset}
                    className={`${BIG_BUTTON_BASE} border border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
                  >
                    <span className="material-symbols-outlined text-2xl leading-none">restart_alt</span>
                    {t("time.reset")}
                  </button>
                )}
              </div>

              <div
                role="group"
                aria-label={t("time.presets")}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {COUNTDOWN_PRESETS_MIN.map((min) => {
                  const selected = presetMin === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectPreset(min)}
                      className={`min-h-9 rounded-xl border px-3 text-sm font-bold transition-colors ${
                        selected
                          ? "border-primary bg-primary/20 text-white"
                          : "border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
                      }`}
                    >
                      {min} min
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  maxLength={3}
                  aria-label={t("time.minutes")}
                  value={customMin}
                  onChange={(event) => {
                    setCustomMin(event.target.value.replace(/\D/g, "").slice(0, 3));
                    setPresetMin(null);
                  }}
                  className="h-11 w-16 rounded-xl border border-white/15 bg-white/5 text-center font-mono text-lg font-bold text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="font-mono text-lg font-black text-white/60">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  maxLength={2}
                  aria-label={t("time.seconds")}
                  value={customSec}
                  onChange={(event) => {
                    setCustomSec(event.target.value.replace(/\D/g, "").slice(0, 2));
                    setPresetMin(null);
                  }}
                  className="h-11 w-16 rounded-xl border border-white/15 bg-white/5 text-center font-mono text-lg font-bold text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
