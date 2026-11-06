"use client";

import { useEffect } from "react";

export type ShortcutMode = "stopwatch" | "countdown" | "clock";

export interface TimerShortcutHandlers {
  mode: ShortcutMode;
  enabled?: boolean;
  onToggleTimer?: () => void;
  onLap?: () => void;
  onReset?: () => void;
  onToggleFullscreen?: () => void;
  onToggleMenu?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

/**
 * Shared keyboard shortcuts (Space, L, R, F, M) for the card and fullscreen
 * views. Ignored while typing in a field or when another handler consumed the
 * key; the menu owns Escape itself.
 */
export function useTimerShortcuts({
  mode,
  enabled = true,
  onToggleTimer,
  onLap,
  onReset,
  onToggleFullscreen,
  onToggleMenu,
}: TimerShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      switch (event.key.toLowerCase()) {
        case " ":
          if (mode === "clock" || !onToggleTimer) return;
          event.preventDefault();
          onToggleTimer();
          return;
        case "l":
          if (mode !== "stopwatch" || !onLap) return;
          event.preventDefault();
          onLap();
          return;
        case "r":
          if (mode === "clock" || !onReset) return;
          event.preventDefault();
          onReset();
          return;
        case "f":
          if (!onToggleFullscreen) return;
          event.preventDefault();
          onToggleFullscreen();
          return;
        case "m":
          if (!onToggleMenu) return;
          event.preventDefault();
          onToggleMenu();
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, enabled, onToggleTimer, onLap, onReset, onToggleFullscreen, onToggleMenu]);
}
