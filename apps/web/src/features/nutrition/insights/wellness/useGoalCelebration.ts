import { useEffect, useRef, useState } from "react";

import { crossedGoals, type DayMetrics } from "../../lib/insights/wellness";
import type { Goals } from "../../lib/insights/goals";

/** How long a reached goal stays lit */
const CELEBRATION_MS = 1200;

/**
 * The metrics that just crossed their minimum goal, lit briefly
 * (`goalCelebrations`, off with reduced motion).
 */
export function useGoalCelebration(
  data: DayMetrics | null,
  goals: Goals,
  isEnabled: boolean,
): string[] {
  const [celebrating, setCelebrating] = useState<string[]>([]);
  const previous = useRef<DayMetrics | null>(null);
  // Compared by content: the objects are rebuilt on every render
  const signature = data ? JSON.stringify(data) : null;
  const latest = useRef({ data, goals, isEnabled });
  useEffect(() => {
    latest.current = { data, goals, isEnabled };
  });

  useEffect(() => {
    const current = latest.current;
    if (signature === null || !current.data) return;
    const crossed = crossedGoals(previous.current, current.data, current.goals);
    previous.current = current.data;
    // jsdom has no matchMedia
    const isReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!crossed.length || !current.isEnabled || isReduced) return;
    const start = setTimeout(() => {
      setCelebrating(crossed);
    }, 0);
    const stop = setTimeout(() => {
      setCelebrating([]);
    }, CELEBRATION_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [signature]);

  return celebrating;
}
