"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/components/ui/motion";

interface OptionChipProps {
  selected: boolean;
  onClick: () => void;
  variant?: "solid" | "soft";
  color?: string;
  icon?: string;
  className?: string;
  children: React.ReactNode;
}

export default function OptionChip({
  selected,
  onClick,
  variant = "soft",
  color,
  icon,
  className,
  children,
}: OptionChipProps) {
  const solid = variant === "solid" && selected;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING_SNAPPY}
      style={solid && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors",
        selected
          ? variant === "solid"
            ? "border-transparent text-white"
            : "border-primary bg-primary/10 text-primary"
          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400",
        className,
      )}
    >
      {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
      {children}
    </motion.button>
  );
}
