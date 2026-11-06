"use client";

import { useEffect, useState } from "react";

/**
 * One display clock for the whole app.
 *
 * Views never own a timer: they read the timestamp-based state from the store
 * and subscribe here only to repaint. A single rAF loop notifies every
 * subscriber with the same `Date.now()` value, so the card, the fullscreen
 * overlay and the floating pill always render the exact same instant (they
 * used to run three independent 1 s intervals with different phases, which
 * made the same timer show different seconds in each view).
 *
 * Dropped frames cannot change the time: every value is derived from the
 * store's timestamps, and visibility/focus wake the loop immediately.
 */

type Listener = (nowMs: number) => void;

const TICK_MS = 50;
const listeners = new Set<Listener>();
let frame: number | null = null;
let lastNotify = 0;

function notify(nowMs: number): void {
  lastNotify = nowMs;
  for (const listener of listeners) listener(nowMs);
}

function schedule(): void {
  if (frame != null || listeners.size === 0 || typeof window === "undefined") return;
  frame = window.requestAnimationFrame(tick);
}

function tick(): void {
  frame = null;
  const nowMs = Date.now();
  if (nowMs - lastNotify >= TICK_MS) notify(nowMs);
  schedule();
}

function wake(): void {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  notify(Date.now());
  schedule();
}

export function subscribeDisplayClock(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
  }
  listener(Date.now());
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      if (frame != null) window.cancelAnimationFrame(frame);
      frame = null;
    }
  };
}

/** Repaints the caller with the shared clock value (~20 fps, timestamp-based). */
export function useDisplayNow(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => subscribeDisplayClock(setNowMs), []);
  return nowMs;
}
