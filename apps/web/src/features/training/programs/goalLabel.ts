import type { TFunction } from "i18next";

import { type GoalId, GOALS } from "../lib/workout";

export function goalLabel(t: TFunction<"training">, goal: string): string {
  return (GOALS as readonly string[]).includes(goal)
    ? t(`goals.${goal as GoalId}`)
    : goal;
}
