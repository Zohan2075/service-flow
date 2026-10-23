"use client";

import { useEffect, useRef } from "react";

// Local API shapes: optional so the app still compiles (and runs) on DOM libs
// / browsers without the Wake Lock API (iOS Safari ships none). No `any`.

interface WakeLockSentinelLike {
  readonly released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockApiLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

function getWakeLockApi(): WakeLockApiLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { wakeLock?: WakeLockApiLike };
  return nav.wakeLock ?? null;
}

/**
 * Keeps the screen awake while `active` is true (best effort). Releases the
 * sentinel when the flag turns off or the component unmounts, and re-acquires
 * it when the tab becomes visible again (the browser drops locks when hidden).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    const api = getWakeLockApi();
    if (!api) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinelRef.current != null) return;
      try {
        const sentinel = await api.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Wake lock denied (e.g. low battery) — the UI still works.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && sentinelRef.current == null) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [active]);
}
