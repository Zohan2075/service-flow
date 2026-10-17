"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/components/ui/motion";

interface CopyFeedbackIconProps {
  copied: boolean;
  className?: string;
}

/**
 * Copy icon that pops into a check mark while `copied` is true, then back.
 * The `key` remount replays the spring pop on every state change.
 */
export default function CopyFeedbackIcon({ copied, className }: CopyFeedbackIconProps) {
  return (
    <motion.span
      key={copied ? "copied" : "copy"}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING_SNAPPY}
      className={cn("material-symbols-outlined", className)}
    >
      {copied ? "check" : "content_copy"}
    </motion.span>
  );
}
