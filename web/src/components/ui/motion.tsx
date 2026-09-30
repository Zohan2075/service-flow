"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, type Transition, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

/** Soft spring for most UI motion (pills, cards, entrances). */
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 400, damping: 32 };

/** Snappier spring for tactile feedback (chips, switches). */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 500, damping: 35 };

/** Shared ease-out curve matching the `spring-out` Tailwind token. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Fade + slight rise on entrance. Animates opacity/transform only so that
 * `MotionConfig reducedMotion="user"` can disable it automatically.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
};

/** Fade + slight scale on entrance. Opacity/transform only (reduced-motion safe). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: SPRING_SOFT },
};

/** Container variants that stagger child entrances by `step` seconds (cap ≤ 0.05). */
export function staggerContainer(step = 0.04): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: step } },
  };
}

interface StaggerGroupProps {
  children: React.ReactNode;
  className?: string;
  step?: number;
}

/** Module flag: true once the app has hydrated at least once in this JS context. */
let appHydrated = false;

/** True when this component's first render happens after hydration (client-side mount). */
function usePostHydrationFirstRender(): boolean {
  const isPostHydration = useRef(appHydrated);
  useEffect(() => {
    appHydrated = true;
  }, []);
  return isPostHydration.current;
}

/** Container for staggered list/card entrances. */
export function StaggerGroup({ children, className, step = 0.04 }: StaggerGroupProps) {
  const skipInitial = !usePostHydrationFirstRender();
  const variants = useMemo(() => staggerContainer(step), [step]);
  return (
    <motion.div
      className={cn(className)}
      variants={variants}
      initial={skipInitial ? false : "hidden"}
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

/** Child of `StaggerGroup`; animates with `fadeUp`. */
export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div className={cn(className)} variants={fadeUp}>
      {children}
    </motion.div>
  );
}
