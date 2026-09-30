"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SOFT } from "@/components/ui/motion";

interface PressableCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function PressableCard({ children, className, onClick }: PressableCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={SPRING_SOFT}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
