"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/components/ui/motion";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  checkedClassName?: string;
  ariaLabel?: string;
  className?: string;
}

export default function Switch({
  checked,
  onChange,
  disabled = false,
  checkedClassName = "bg-primary",
  ariaLabel,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? checkedClassName : "bg-slate-300 dark:bg-slate-700",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <motion.div
        animate={{ x: checked ? 20 : 0 }}
        transition={SPRING_SNAPPY}
        className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow"
      />
    </button>
  );
}
