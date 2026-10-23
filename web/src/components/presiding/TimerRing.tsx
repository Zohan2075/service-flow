"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_CLASS_NAME = "w-40 h-40 md:w-44 md:h-44";
const TRACK_CLASS_NAME = "stroke-slate-200 dark:stroke-slate-800";

interface TimerRingProps {
  /** Remaining fraction of the timer, 0–1 (clamped). */
  progress: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  children?: ReactNode;
}

/**
 * Progress ring for the timers. The track uses the slate palette (light/dark)
 * and the progress arc uses the user's accent via the global `--sf-primary`
 * variable, so custom themes are respected with no hardcoded colors.
 */
export default function TimerRing({
  progress,
  strokeWidth = 7,
  className,
  trackClassName,
  children,
}: TimerRingProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn("relative", className ?? DEFAULT_CLASS_NAME)}>
      <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn(TRACK_CLASS_NAME, trackClassName)}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke="rgb(var(--sf-primary))"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.9s linear" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
