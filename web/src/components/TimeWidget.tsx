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

const WIDGET_SCALE_MIN = 0.8;
const WIDGET_SCALE_MAX = 2.0;
const SCALE_DRAG_PX_PER_UNIT = 120;
const VIEWPORT_MARGIN_PX = 8;

function clampWidgetScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(WIDGET_SCALE_MAX, Math.max(WIDGET_SCALE_MIN, scale));
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
  "flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700/60 dark:hover:text-slate-300";

export default function TimeWidget() {
  const router = useRouter();
  const { t, language } = useT();

  const widgetVisible = useStore((s) => s.timeTools.widgetVisible);
  const widgetScale = useStore((s) => s.timeTools.widgetScale);
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
  const setWidgetScale = useStore((s) => s.setWidgetScale);
  const setWidgetOffset = useStore((s) => s.setWidgetOffset);

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

  /* ----- focus clock priority: countdown → stopwatch → country → local ----- */
  const focus: FocusClock =
    countdown.totalMs > 0
      ? "countdown"
      : stopwatch.running || stopwatch.accumulatedMs > 0
        ? "stopwatch"
        : countryTz
          ? "country"
          : "local";

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

  const toggleRunning = focus === "stopwatch" ? stopwatch.running : countdown.running;
  const canToggleCountdown =
    countdown.running || (countdown.finishedAtMs == null && countdown.remainingMs > 0);
  const showToggle = focus === "stopwatch" || (focus === "countdown" && canToggleCountdown);

  const toggleFocusTimer = () => {
    if (focus === "stopwatch") {
      if (stopwatch.running) stopwatchPause();
      else stopwatchStart();
      return;
    }
    if (focus === "countdown") {
      if (countdown.running) countdownPause();
      else countdownStart(countdown.remainingMs);
    }
  };

  /* ----- move (grip drag; live preview, persisted on release) ----- */
  type MoveDrag = {
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
    scaleAtStart: number;
    minDx: number;
    maxDx: number;
    minDy: number;
    maxDy: number;
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const moveDragRef = useRef<MoveDrag | null>(null);

  // Sanitized mirrors of the store values (never NaN/undefined).
  const safeOffset = {
    x: Number.isFinite(widgetOffset?.x) ? widgetOffset.x : 0,
    y: Number.isFinite(widgetOffset?.y) ? widgetOffset.y : 0,
  };
  const safeScale = Number.isFinite(widgetScale) ? widgetScale : 1;
  const safeOffsetRef = useRef(safeOffset);
  useEffect(() => {
    safeOffsetRef.current = safeOffset;
  });

  // Imperative preview during gestures: React state updates from native
  // window listeners proved unreliable here (observed live), so drags write
  // the transform straight to the DOM; the store commit on release re-renders
  // with the same final pose.
  const applyPreview = (offset: { x: number; y: number }, scale: number) => {
    const el = rootRef.current;
    if (el) el.style.transform = `translate(${-offset.x}px, ${-offset.y}px) scale(${scale})`;
  };

  // Device-adaptive resize cap: the widget may never exceed the viewport, so
  // the effective max scale depends on the current screen AND anchor position
  // (capped at 200%). offsetWidth/Height are layout sizes (transform-safe);
  // the rect's right/bottom edges are scale-invariant (origin: bottom right).
  const [viewportMaxScale, setViewportMaxScale] = useState(WIDGET_SCALE_MAX);
  const viewportMaxScaleRef = useRef(viewportMaxScale);
  useEffect(() => {
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fit = Math.min(
        (rect.right - VIEWPORT_MARGIN_PX) / Math.max(1, el.offsetWidth),
        (rect.bottom - VIEWPORT_MARGIN_PX) / Math.max(1, el.offsetHeight),
      );
      const rounded = Math.floor(fit * 20) / 20; // 5% steps, round down
      const next = Math.min(WIDGET_SCALE_MAX, Math.max(WIDGET_SCALE_MIN, rounded));
      viewportMaxScaleRef.current = next;
      setViewportMaxScale(next);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [widgetVisible, widgetOffset.x, widgetOffset.y]);

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
      scaleAtStart: safeScale,
      minDx: VIEWPORT_MARGIN_PX - rect.left,
      maxDx: window.innerWidth - VIEWPORT_MARGIN_PX - rect.right,
      minDy: VIEWPORT_MARGIN_PX - rect.top,
      maxDy: window.innerHeight - VIEWPORT_MARGIN_PX - rect.bottom,
    };
    moveDragRef.current = drag;

    const onDragMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      applyPreview(computeDragOffset(drag, ev.clientX - drag.startX, ev.clientY - drag.startY), drag.scaleAtStart);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      moveDragRef.current = null;
      const final = computeDragOffset(drag, ev.clientX - drag.startX, ev.clientY - drag.startY);
      applyPreview(final, drag.scaleAtStart);
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

  /* ----- resize (arc handle; live preview, persisted on release) ----- */
  const [previewScale, setPreviewScale] = useState<number | null>(null);
  const resizeDragRef = useRef<{ pointerId: number; startX: number; startScale: number } | null>(null);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || resizeDragRef.current) return;
    const drag = { pointerId: event.pointerId, startX: event.clientX, startScale: widgetScale };
    resizeDragRef.current = drag;
    setPreviewScale(widgetScale);

    const onDragMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      const next = Math.min(
        clampWidgetScale(drag.startScale + (ev.clientX - drag.startX) / SCALE_DRAG_PX_PER_UNIT),
        viewportMaxScaleRef.current,
      );
      applyPreview(safeOffsetRef.current, next);
      setPreviewScale(next);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      resizeDragRef.current = null;
      const final = Math.min(
        clampWidgetScale(drag.startScale + (ev.clientX - drag.startX) / SCALE_DRAG_PX_PER_UNIT),
        viewportMaxScaleRef.current,
      );
      applyPreview(safeOffsetRef.current, final);
      setPreviewScale(null);
      setWidgetScale(final);
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const resetScale = () => {
    resizeDragRef.current = null;
    setPreviewScale(null);
    setWidgetScale(1);
  };

  if (!widgetVisible) return null;

  // Defensive: never emit an invalid transform ("translate(-NaNpx …)" is
  // silently dropped by browsers, which made the pill unreachable).
  // Also clamp to the device-adaptive cap so it always fits the screen.
  const rawDisplayScale = Number.isFinite(previewScale ?? widgetScale) ? (previewScale ?? widgetScale) : 1;
  const displayScale = Math.min(Math.max(rawDisplayScale, WIDGET_SCALE_MIN), viewportMaxScale);
  const displayOffset = safeOffset;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={t("time.widget")}
      className="fixed z-40 right-20 bottom-[calc(env(safe-area-inset-bottom,_0px)+4.5rem)] md:right-4 md:bottom-4"
      style={{
        transform: `translate(${-displayOffset.x}px, ${-displayOffset.y}px) scale(${displayScale})`,
        transformOrigin: "bottom right",
      }}
    >
      {previewScale != null && (
        <div className="pointer-events-none absolute -top-7 right-0 rounded-full bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white dark:bg-slate-100/90 dark:text-slate-900">
          {Math.round(displayScale * 100)}%
        </div>
      )}
      <div className="relative flex items-center gap-0.5 rounded-full border border-slate-200 bg-surface/95 py-0.5 pl-1 pr-0.5 shadow-card backdrop-blur-md dark:border-slate-700">
        {/* Main time → open the Time tab */}
        <button
          type="button"
          onClick={() => router.push("/presiding?tab=time")}
          title={t("time.title")}
          className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
        >
          <span className="material-symbols-outlined text-base leading-none text-primary">
            {FOCUS_ICON[focus]}
          </span>
          <span className="font-mono text-sm font-bold leading-none tabular-nums" suppressHydrationWarning>
            {displayText}
          </span>
        </button>

        {showToggle && (
          <button
            type="button"
            onClick={toggleFocusTimer}
            aria-label={toggleRunning ? t("time.pause") : t("time.resume")}
            className={ICON_BUTTON_CLASS}
          >
            <span className="material-symbols-outlined text-base leading-none">
              {toggleRunning ? "pause" : "play_arrow"}
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
          onClick={() => setWidgetVisible(false)}
          aria-label={t("time.hide")}
          className={ICON_BUTTON_CLASS}
        >
          <span className="material-symbols-outlined text-base leading-none">close</span>
        </button>

        {/* Arc resize handle on the pill's bottom-right rounded edge */}
        <button
          type="button"
          aria-label={t("time.resize")}
          onPointerDown={startResize}
          onDoubleClick={resetScale}
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
