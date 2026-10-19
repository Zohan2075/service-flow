"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { playAlertBeep } from "@/lib/alertSound";

/* ---------- constants + helpers ---------- */

// Kept local (duplicated from TimeView): the widget is mounted by the
// dashboard layout, so it must not pull TimeView's module graph into every
// dashboard page bundle.

const VIEWPORT_MARGIN_PX = 8;
// Mirrors the store's widgetSize clamps (px) for the window-resize re-clamp.
const WIDGET_SIZE_MIN = 40;
const WIDGET_SIZE_MAX = 4000;
// Resize minimums: content-row measurements plus padding, with fallbacks.
const RESIZE_MIN_W = 140;
const RESIZE_MIN_H = 44;
const RESIZE_CONTENT_PAD_X = 16;
const RESIZE_CONTENT_PAD_Y = 8;

function clampResizeAxis(value: number, min: number, max: number): number {
  // Degenerate ranges (min > max) keep the minimum so the box never inverts.
  return Math.min(Math.max(value, min), Math.max(min, max));
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

function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/* ---------- global countdown completion alert ---------- */

/**
 * Owns the app-wide countdown completion alert (beep + toast). Mounted with
 * the widget in the dashboard layout, so it fires on every dashboard page —
 * even while the pill itself is hidden (this hook runs before the
 * `!widgetVisible` early return). Phase 3: the widget supersedes TimeView's
 * page-level `useCountdownCompletion` as the single alert owner.
 */
function useCountdownAlert(): void {
  const running = useStore((s) => s.timeTools.countdown.running);
  const endsAtMs = useStore((s) => s.timeTools.countdown.endsAtMs);
  const finishCountdown = useStore((s) => s.finishCountdown);
  const { t } = useT();

  useEffect(() => {
    if (!running || endsAtMs == null) return;
    const check = () => {
      if (Date.now() < endsAtMs) return;
      // Read the fresh store state: skip the alert when another watcher
      // already completed this countdown, and skip when the user
      // reset/paused before this check ran.
      const { countdown } = useStore.getState().timeTools;
      const alreadyFinished = countdown.finishedAtMs != null;
      finishCountdown();
      if (alreadyFinished || !countdown.running) return;
      playAlertBeep();
      toast.success(t("time.done"));
    };
    check();
    const interval = window.setInterval(check, 1000);
    return () => window.clearInterval(interval);
  }, [running, endsAtMs, finishCountdown, t]);
}

/* ---------- main component ---------- */

type FocusClock = "countdown" | "stopwatch" | "country" | "local";

const FOCUS_ICON: Record<FocusClock, string> = {
  countdown: "hourglass_bottom",
  stopwatch: "timer",
  country: "public",
  local: "schedule",
};

const ICON_BUTTON_CLASS =
  "flex size-8 md:size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700/60 dark:hover:text-slate-300";

export default function TimeWidget() {
  const router = useRouter();
  const { t, language } = useT();

  const widgetVisible = useStore((s) => s.timeTools.widgetVisible);
  const widgetSize = useStore((s) => s.timeTools.widgetSize);
  const widgetOffset = useStore((s) => s.timeTools.widgetOffset);
  const stopwatch = useStore((s) => s.timeTools.stopwatch);
  const countdown = useStore((s) => s.timeTools.countdown);
  const countryTz = useStore((s) => s.timeTools.countryTz);
  const timeFormat = useStore((s) => s.presidingPrefs.timeFormat);
  const stopwatchStart = useStore((s) => s.stopwatchStart);
  const stopwatchPause = useStore((s) => s.stopwatchPause);
  const countdownStart = useStore((s) => s.countdownStart);
  const countdownPause = useStore((s) => s.countdownPause);
  const setWidgetVisible = useStore((s) => s.setWidgetVisible);
  const setWidgetSize = useStore((s) => s.setWidgetSize);
  const setWidgetOffset = useStore((s) => s.setWidgetOffset);
  const widgetMode = useStore((s) => s.timeTools.widgetMode);

  // Global countdown alert: must tick even while the pill is hidden.
  useCountdownAlert();

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

  /* ----- focus resolution: widgetMode forces a clock; "auto" prefers live ----- */
  // Auto: a running timer wins, then a paused timer with a kept value (frozen
  // time + resume), and only otherwise does the ticking clock show.
  const pausedStopwatch = !stopwatch.running && stopwatch.accumulatedMs > 0;
  const pausedCountdown = !countdown.running && countdown.remainingMs > 0 && countdown.finishedAtMs == null;

  const clockFocus: FocusClock = countryTz ? "country" : "local";
  const focus: FocusClock =
    widgetMode === "clock"
      ? clockFocus
      : widgetMode === "stopwatch"
        ? "stopwatch"
        : widgetMode === "countdown"
          ? countdown.running || countdown.remainingMs > 0
            ? "countdown"
            : clockFocus
          : countdown.running
            ? "countdown"
            : stopwatch.running
              ? "stopwatch"
              : pausedCountdown
                ? "countdown"
                : pausedStopwatch
                  ? "stopwatch"
                  : clockFocus;

  const stopwatchElapsedMs =
    stopwatch.accumulatedMs +
    (stopwatch.running && stopwatch.startedAtMs != null
      ? Math.max(0, nowMs - stopwatch.startedAtMs)
      : 0);

  const countdownRemainingMs =
    countdown.running && countdown.endsAtMs != null
      ? Math.max(0, countdown.endsAtMs - nowMs)
      : countdown.remainingMs;

  const displayText =
    focus === "countdown"
      ? fmtHMS(countdownRemainingMs)
      : focus === "stopwatch"
        ? fmtHMS(stopwatchElapsedMs)
        : fmtClock(now, focus === "country" ? (countryTz ?? deviceTz) : deviceTz, hour12, locale);

  // Toggle button: "pause" while the focused timer runs; otherwise a play
  // button to resume/start. A clock focus (forced or auto) shows no toggle.
  const focusRunning =
    (focus === "stopwatch" && stopwatch.running) || (focus === "countdown" && countdown.running);
  const focusResumable =
    (focus === "stopwatch" && !stopwatch.running) ||
    (focus === "countdown" && !countdown.running && countdown.remainingMs > 0 && countdown.finishedAtMs == null);
  const toggleTarget: "pause" | "resume" | null = focusRunning
    ? "pause"
    : focusResumable
      ? "resume"
      : null;

  const handleToggle = () => {
    if (toggleTarget === "pause") {
      if (focus === "stopwatch") stopwatchPause();
      else if (focus === "countdown") countdownPause();
      return;
    }
    if (toggleTarget !== "resume") return;
    if (focus === "stopwatch") stopwatchStart();
    else if (focus === "countdown") countdownStart(countdown.remainingMs);
    else if (pausedStopwatch) stopwatchStart();
    else if (pausedCountdown) countdownStart(countdown.remainingMs);
  };

  // X = close + pause the shown timer (value kept; resumable later with ▶).
  const handleHide = () => {
    if (focus === "stopwatch" && stopwatch.running) stopwatchPause();
    else if (focus === "countdown" && countdown.running) countdownPause();
    setWidgetVisible(false);
  };

  /* ----- move (grip drag; live preview, persisted on release) ----- */
  type MoveDrag = {
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
    minDx: number;
    maxDx: number;
    minDy: number;
    maxDy: number;
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const moveDragRef = useRef<MoveDrag | null>(null);

  // Sanitized mirrors of the store values (never NaN/undefined).
  const safeOffset = {
    x: Number.isFinite(widgetOffset?.x) ? widgetOffset.x : 0,
    y: Number.isFinite(widgetOffset?.y) ? widgetOffset.y : 0,
  };
  const safeSize = {
    w: typeof widgetSize?.w === "number" && Number.isFinite(widgetSize.w) ? widgetSize.w : null,
    h: typeof widgetSize?.h === "number" && Number.isFinite(widgetSize.h) ? widgetSize.h : null,
  };

  // Imperative preview during gestures: React state updates from native
  // window listeners proved unreliable here (observed live), so drags write
  // the transform straight to the DOM; the store commit on release re-renders
  // with the same final pose.
  const applyPreview = (offset: { x: number; y: number }) => {
    const el = rootRef.current;
    if (el) el.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
  };

  // Window resize: a persisted crop size is re-clamped to the viewport so the
  // top-left corner can never be pushed off screen (16px total breathing
  // room). The store clamp is mirrored here so both ends agree and the effect
  // converges instead of looping.
  useEffect(() => {
    const update = () => {
      const nextW =
        safeSize.w == null
          ? null
          : Math.min(WIDGET_SIZE_MAX, Math.max(WIDGET_SIZE_MIN, Math.min(safeSize.w, window.innerWidth - 16)));
      const nextH =
        safeSize.h == null
          ? null
          : Math.min(WIDGET_SIZE_MAX, Math.max(WIDGET_SIZE_MIN, Math.min(safeSize.h, window.innerHeight - 16)));
      if (nextW !== safeSize.w || nextH !== safeSize.h) setWidgetSize(nextW, nextH);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [safeSize.w, safeSize.h, setWidgetSize, widgetVisible]);

  const computeDragOffset = (drag: MoveDrag, dx: number, dy: number): { x: number; y: number } => {
    // Clamp the delta into the allowed movement range. When the widget is
    // larger than the viewport (min > max), let it move freely instead of
    // forcing a shift — this keeps plain clicks (delta 0) inert and lets the
    // user drag an oversized widget back into view.
    const clampDelta = (delta: number, min: number, max: number) =>
      min > max ? delta : Math.min(max, Math.max(min, delta));
    const clampedDx = clampDelta(dx, drag.minDx, drag.maxDx);
    const clampedDy = clampDelta(dy, drag.minDy, drag.maxDy);
    // The widget is translated by (-x, -y), so the pointer delta maps inversely.
    return { x: drag.startOffset.x - clampedDx, y: drag.startOffset.y - clampedDy };
  };

  // Native window listeners (not pointer capture + React delegation): captured
  // pointer move/up events are not reliably delivered through React's root
  // delegation (observed live), while window listeners always receive them.
  const startMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || moveDragRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const drag: MoveDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: safeOffset,
      minDx: VIEWPORT_MARGIN_PX - rect.left,
      maxDx: window.innerWidth - VIEWPORT_MARGIN_PX - rect.right,
      minDy: VIEWPORT_MARGIN_PX - rect.top,
      maxDy: window.innerHeight - VIEWPORT_MARGIN_PX - rect.bottom,
    };
    moveDragRef.current = drag;

    const onDragMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      applyPreview(computeDragOffset(drag, ev.clientX - drag.startX, ev.clientY - drag.startY));
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      moveDragRef.current = null;
      const final = computeDragOffset(drag, ev.clientX - drag.startX, ev.clientY - drag.startY);
      applyPreview(final);
      setWidgetOffset(final.x, final.y);
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const resetOffset = () => {
    moveDragRef.current = null;
    setWidgetOffset(0, 0);
  };

  /* ----- crop-style resize (BR handle; the TL corner stays fixed) ----- */
  const [resizeBadge, setResizeBadge] = useState<{ w: number; h: number } | null>(null);
  const resizeActiveRef = useRef<{ pointerId: number } | null>(null);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || resizeActiveRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    const pill = pillRef.current;
    if (!rect || !pill) return;
    const drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startW: rect.width,
      startH: rect.height,
      // Hard caps: the bottom-right corner stops 8px from the viewport edges.
      maxW: window.innerWidth - VIEWPORT_MARGIN_PX - rect.left,
      maxH: window.innerHeight - VIEWPORT_MARGIN_PX - rect.top,
      // Content minimums: never shrink below the natural row size.
      minW: Math.max(RESIZE_MIN_W, (contentRef.current?.offsetWidth ?? 0) + RESIZE_CONTENT_PAD_X),
      minH: Math.max(RESIZE_MIN_H, (contentRef.current?.offsetHeight ?? 0) + RESIZE_CONTENT_PAD_Y),
    };
    resizeActiveRef.current = { pointerId: drag.pointerId };
    setResizeBadge({ w: drag.startW, h: drag.startH });

    // Dragging the BR corner: right grows width, down grows height.
    const compute = (ev: PointerEvent): { w: number; h: number } => ({
      w: clampResizeAxis(drag.startW + (ev.clientX - drag.startX), drag.minW, drag.maxW),
      h: clampResizeAxis(drag.startH + (ev.clientY - drag.startY), drag.minH, drag.maxH),
    });
    const writePreview = (size: { w: number; h: number }) => {
      pill.style.width = `${size.w}px`;
      pill.style.height = `${size.h}px`;
    };

    const onDragMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      const next = compute(ev);
      writePreview(next);
      setResizeBadge(next);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      resizeActiveRef.current = null;
      const final = compute(ev);
      writePreview(final);
      setResizeBadge(null);
      // Persisting re-renders with the same px size, so the pill never jumps.
      setWidgetSize(final.w, final.h);
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  // Double-click the handle → back to automatic (natural) sizing.
  const resetSize = () => {
    resizeActiveRef.current = null;
    const pill = pillRef.current;
    if (pill) {
      pill.style.width = "";
      pill.style.height = "";
    }
    setWidgetSize(null, null);
  };

  // Natural (auto) pill size baseline so the time number scales with the window.
  // Captured only while auto-sized (font unscaled then), so there is no feedback loop.
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (safeSize.w == null && safeSize.h == null && pillRef.current) {
      const pill = pillRef.current;
      if (pill.offsetWidth > 0 && pill.offsetHeight > 0) {
        naturalSizeRef.current = { w: pill.offsetWidth, h: pill.offsetHeight };
      }
    }
  });
  const customSized = safeSize.w != null || safeSize.h != null;
  const timeFontSize = (() => {
    if (!customSized) return undefined;
    const natural = naturalSizeRef.current ?? { w: 200, h: 36 };
    const ratioW = safeSize.w != null ? safeSize.w / natural.w : Number.POSITIVE_INFINITY;
    const ratioH = safeSize.h != null ? safeSize.h / natural.h : Number.POSITIVE_INFINITY;
    const scale = Math.min(5, Math.max(1, Math.min(ratioW, ratioH)));
    return Math.min(64, Math.round(14 * scale));
  })();

  if (!widgetVisible) return null;

  // Defensive: never emit an invalid transform ("translate(-NaNpx …)" is
  // silently dropped by browsers, which made the pill unreachable).
  const displayOffset = safeOffset;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={t("time.widget")}
      className="fixed z-40 right-20 bottom-[calc(env(safe-area-inset-bottom,_0px)+4.5rem)] md:right-4 md:bottom-4"
      style={{ transform: `translate(${-displayOffset.x}px, ${-displayOffset.y}px)` }}
    >
      {resizeBadge != null && (
        <div className="pointer-events-none absolute -top-7 right-0 rounded-full bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white dark:bg-slate-100/90 dark:text-slate-900">
          {Math.round(resizeBadge.w)}×{Math.round(resizeBadge.h)} px
        </div>
      )}
      <div
        ref={pillRef}
        className="relative flex min-h-fit min-w-fit items-center justify-center rounded-3xl border border-slate-200 bg-surface/95 py-0.5 md:py-1 pl-1 md:pl-1.5 pr-0.5 md:pr-1 shadow-card backdrop-blur-md dark:border-slate-700"
        style={{
          width: safeSize.w ?? undefined,
          height: safeSize.h ?? undefined,
        }}
      >
        <div ref={contentRef} className="flex min-w-fit shrink-0 items-center gap-0.5">
          {/* Main time → open the Time tab */}
          <button
            type="button"
            onClick={() => router.push("/presiding?tab=time")}
            title={t("time.title")}
            className="flex items-center gap-1.5 md:gap-2 rounded-full px-2 md:px-3 py-1.5 md:py-2 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
          >
            <span className="material-symbols-outlined text-base md:text-xl leading-none text-primary">
              {FOCUS_ICON[focus]}
            </span>
            <span className="font-mono text-sm md:text-base font-bold leading-none tabular-nums" style={timeFontSize == null ? undefined : { fontSize: timeFontSize }} suppressHydrationWarning>
              {displayText}
            </span>
          </button>

          {toggleTarget && (
            <button
              type="button"
              onClick={handleToggle}
              aria-label={toggleTarget === "pause" ? t("time.pause") : t("time.resume")}
              className={ICON_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-base leading-none">
                {toggleTarget === "pause" ? "pause" : "play_arrow"}
              </span>
            </button>
          )}

          {/* Move grip: drag moves the widget; double-click resets to the default corner */}
          <button
            type="button"
            aria-label={t("time.move")}
            onPointerDown={startMove}
            onDoubleClick={resetOffset}
            className={`${ICON_BUTTON_CLASS} cursor-move touch-none`}
          >
            <span className="material-symbols-outlined text-base leading-none">drag_indicator</span>
          </button>

          <button
            type="button"
            onClick={handleHide}
            aria-label={t("time.hide")}
            className={ICON_BUTTON_CLASS}
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>

        {/* Crop-style resize handle on the pill's bottom-right rounded edge; the TL corner stays fixed */}
        <button
          type="button"
          aria-label={t("time.resize")}
          onPointerDown={startResize}
          onDoubleClick={resetSize}
          className="group absolute -bottom-0.5 -right-0.5 flex size-6 touch-none cursor-nwse-resize items-end justify-end bg-transparent"
        >
          <span
            aria-hidden
            className="pointer-events-none mb-px mr-px size-4 rounded-br-[12px] border-b-2 border-r-2 border-slate-300/80 transition-colors group-hover:border-primary dark:border-slate-500/80"
          />
        </button>
      </div>
    </div>
  );
}
