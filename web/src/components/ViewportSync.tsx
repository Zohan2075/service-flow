"use client";

import { useEffect } from "react";

/**
 * Mirrors the visual viewport into CSS custom properties (`--app-vv-height`,
 * `--app-vv-top`) so fixed overlays stay aligned with the actually visible
 * area — above mobile browser UI and the on-screen keyboard.
 */
export default function ViewportSync() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--app-vv-height", `${Math.round(viewport.height)}px`);
      root.style.setProperty("--app-vv-top", `${Math.round(viewport.offsetTop)}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return null;
}
