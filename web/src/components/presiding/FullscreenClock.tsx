"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

/* ---------- constants + helpers ---------- */

const QUICK_START_MIN = [5, 10, 15];
const AUTO_HIDE_MS = 4000;

type FullscreenMode = "clock" | "stopwatch" | "countdown";

/* Local API shapes: optional so the app still compiles (and runs) on DOM
 * libs / browsers without the Screen Orientation lock or Wake Lock APIs
 * (iOS Safari ships neither). No `any`. */

interface OrientationLockLike {
  lock?: (orientation: "landscape") => Promise<void>;
}

interface WakeLockSentinelLike {
  readonly released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockApiLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

function getOrientationLock(): OrientationLockLike | null {
  if (typeof screen === "undefined" || !screen.orientation) return null;
  return screen.orientation as ScreenOrientation & OrientationLockLike;
}

function getWakeLockApi(): WakeLockApiLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { wakeLock?: WakeLockApiLike };
  return nav.wakeLock ?? null;
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

export default function FullscreenClock({ onClose }: { onClose: () => void }) {
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
  const countdownReset = useStore((s) => s.countdownReset);

  // Initial mode follows whatever is already running; the time itself cycles.
  const [mode, setMode] = useState<FullscreenMode>(() => {
    const tools = useStore.getState().timeTools;
    return tools.countdown.running ? "countdown" : tools.stopwatch.running ? "stopwatch" : "clock";
  });

  // Single 1 s tick drives every displayed value (same pattern as TimeView).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);

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
  const countdownQuickStart = !countdown.running && countdown.totalMs === 0;
  const countdownStartDisabled =
    countdown.running ||
    countdownBlocked ||
    countdown.finishedAtMs != null ||
    (!countdownResumable && countdown.totalMs === 0);

  /* ----- exit handling (single close owner: TimeView does exitFullscreen) ----- */

  const closingRef = useRef(false);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose();
  }, [onClose]);

  // System/browser fullscreen exit (Esc, gesture) closes the overlay too.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) requestClose();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [requestClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  /* ----- orientation lock (Android fullscreen; unsupported on iOS) ----- */

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

  /* ----- wake lock (re-acquired when the tab becomes visible again) ----- */

  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    let cancelled = false;
    const api = getWakeLockApi();
    if (!api) return;

    const acquire = async () => {
      try {
        const sentinel = await api.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        });
      } catch {
        // Wake lock denied (e.g. low battery) — the display still works.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wakeLockRef.current == null) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, []);

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

  const cycleMode = () =>
    setMode((current) =>
      current === "clock" ? "stopwatch" : current === "stopwatch" ? "countdown" : "clock",
    );

  const handleTimeTap = () => {
    // While the controls are hidden, a tap only reveals them — switching the
    // clock should be deliberate (controls visible).
    if (!controlsVisible) {
      wakeControls();
      return;
    }
    cycleMode();
  };

  const toggleStopwatch = () => {
    if (stopwatch.running) stopwatchPause();
    else if (!stopwatchBlocked) stopwatchStart();
  };

  const toggleCountdown = () => {
    if (countdown.running) {
      countdownPause();
      return;
    }
    if (countdownBlocked || countdown.finishedAtMs != null) return;
    const ms = countdownResumable ? countdown.remainingMs : countdown.totalMs;
    countdownStart(ms);
  };

  const displayText =
    mode === "stopwatch"
      ? fmtHMS(stopwatchElapsedMs)
      : mode === "countdown"
        ? fmtHMS(countdownRemainingMs)
        : fmtClock(now, countryTz ?? deviceTz, hour12, locale);

  const modeLabel =
    mode === "stopwatch"
      ? t("time.stopwatch")
      : mode === "countdown"
        ? t("time.countdown")
        : countryTz
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

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-white/45">{modeLabel}</p>
        <button
          type="button"
          onClick={handleTimeTap}
          aria-label={t("time.tapToCycle")}
          title={t("time.tapToCycle")}
          className="max-w-full font-mono text-[clamp(3.5rem,16vw,12rem)] font-black leading-none tabular-nums"
        >
          <span suppressHydrationWarning>{displayText}</span>
        </button>
        {mode === "clock" && (
          <p className="text-sm font-semibold text-white/60" suppressHydrationWarning>
            {fmtDate(now, countryTz ?? deviceTz, locale)}
          </p>
        )}
        {busyHint && (
          <p className="text-sm font-bold text-amber-400">{t("time.timerBusy")}</p>
        )}
        <p className="text-xs font-semibold text-white/30">{t("time.tapToCycle")}</p>
      </div>

      {controlsVisible && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-4 p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
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

          {showCountdownControls && countdownQuickStart && (
            <>
              {QUICK_START_MIN.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => countdownStart(min * 60_000)}
                  disabled={countdownBlocked}
                  className={`${BIG_BUTTON_BASE} border border-white/15 bg-white/5 text-white/90 hover:bg-white/10`}
                >
                  {min} min
                </button>
              ))}
            </>
          )}

          {showCountdownControls && !countdownQuickStart && (
            <>
              <button
                type="button"
                onClick={toggleCountdown}
                disabled={countdownStartDisabled}
                className={
                  countdown.running
                    ? `${BIG_BUTTON_BASE} bg-amber-500 text-black`
                    : `${BIG_BUTTON_BASE} bg-primary text-white`
                }
              >
                <span className="material-symbols-outlined text-2xl leading-none">
                  {countdown.running ? "pause" : "play_arrow"}
                </span>
                {countdown.running
                  ? t("time.pause")
                  : countdownResumable
                    ? t("time.resume")
                    : t("time.start")}
              </button>
              <button
                type="button"
                onClick={countdownReset}
                className={`${BIG_BUTTON_BASE} border border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
              >
                <span className="material-symbols-outlined text-2xl leading-none">restart_alt</span>
                {t("time.reset")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
