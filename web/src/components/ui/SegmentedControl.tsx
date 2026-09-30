"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SOFT } from "@/components/ui/motion";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex bg-slate-100 p-1 rounded-xl dark:bg-slate-800",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              "relative flex items-center justify-center rounded-lg font-semibold transition-colors",
              size === "sm"
                ? "px-3 py-1.5 text-xs min-h-7"
                : size === "lg"
                  ? "px-4 py-2.5 text-sm min-h-11"
                  : "px-4 py-2 text-sm min-h-10",
              fullWidth && "flex-1",
              selected ? "text-primary" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_SOFT}
                className="absolute inset-0 rounded-lg bg-surface shadow-sm dark:bg-slate-700"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
