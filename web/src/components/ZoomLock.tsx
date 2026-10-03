"use client";

import { useEffect } from "react";

declare global {
  interface DocumentEventMap {
    gesturestart: Event;
    gesturechange: Event;
    gestureend: Event;
  }
}

const ZOOM_KEYS = ["+", "-", "=", "_", "0"];

/**
 * Best-effort page zoom lock.
 *
 * Blocks Ctrl/Cmd + `+`/`-`/`0`, ctrl+wheel / trackpad pinch, and Safari
 * `gesture*` pinch events. Gestures inside Leaflet map containers are left
 * untouched so map pinch-zoom keeps working.
 */
export default function ZoomLock() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ZOOM_KEYS.includes(event.key)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    const handleGesture = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".leaflet-container")) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("gesturestart", handleGesture);
    document.addEventListener("gesturechange", handleGesture);
    document.addEventListener("gestureend", handleGesture);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      document.removeEventListener("gesturestart", handleGesture);
      document.removeEventListener("gesturechange", handleGesture);
      document.removeEventListener("gestureend", handleGesture);
    };
  }, []);

  return null;
}
