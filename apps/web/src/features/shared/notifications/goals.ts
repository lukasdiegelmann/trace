import { api } from "@/api";

import { notify } from "./notify";

const STORAGE_KEY = "_celebratedToday";

interface ClaimAnswer {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the backend's field
  fired?: boolean;
}

interface Celebrated {
  _date: string;
  keys: string[];
}

/** YYYY-MM-DD in local time */
export function localDateKey(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE");
}

function readCelebrated(today: string): Set<string> {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Celebrated | null;
    return new Set(parsed?._date === today ? parsed.keys : []);
  } catch {
    return new Set();
  }
}

function remember(today: string, keys: Set<string>): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ _date: today, keys: [...keys] }),
    );
  } catch {
    // Private mode: the server's claim still stops a second celebration.
  }
}

/**
 * True when this device is the first to celebrate `key` today: once here,
 * once across devices (the server's atomic claim).
 */
async function claim(key: string, today: string): Promise<boolean> {
  const celebrated = readCelebrated(today);
  if (celebrated.has(key)) return false;
  celebrated.add(key);
  remember(today, celebrated);
  try {
    const answer = await api.nt.post<ClaimAnswer>(
      "/settings/claim-celebration",
      { key },
    );
    return Boolean(answer.fired);
  } catch {
    return true;
  }
}

export interface GoalTarget {
  min?: number | null;
  max?: number | null;
}

/** What a celebration says; the caller translates (the UI's language) */
export interface CelebrationText {
  goal: (key: string, value: number, target: number) => [string, string];
  calories: (value: number, target: number) => [string, string];
  stepsReached: (steps: number, goal: number) => [string, string];
  stepsMidday: (steps: number, remaining: number) => [string, string];
}

/** A goal is reached at its minimum or at its maximum */
export function isGoalReached(goal: GoalTarget, value: number): boolean {
  return (
    (goal.min != null && value >= goal.min) ||
    (goal.max != null && value >= goal.max)
  );
}

/** Celebrates every goal that today's totals reach, each once a day */
export async function checkGoals(
  goals: Record<string, GoalTarget | null | undefined> | null | undefined,
  values: Record<string, number | null | undefined> | null | undefined,
  text: CelebrationText,
  now: Date = new Date(),
): Promise<void> {
  if (!goals || !values) return;
  const today = localDateKey(now);
  for (const [key, goal] of Object.entries(goals)) {
    const value = values[key];
    if (!goal || value == null) continue;
    const target = goal.min ?? goal.max;
    if (target == null) continue;
    if (isGoalReached(goal, value) && (await claim(`${key}_${today}`, today))) {
      const [title, body] = text.goal(key, value, target);
      await notify("notifGoalCelebrations", title, body, 5);
    }
    if (key === "calories" && goal.max != null && value >= goal.max) {
      if (await claim("cal_max", today)) {
        const [title, body] = text.calories(value, goal.max);
        await notify("notifCalorieGoal", title, body, 6);
      }
    }
  }
}

/**
 * After a wearable sync: the step goal once reached, or one nudge between 12
 * and 14 o'clock while under half of it.
 */
export async function checkStepGoal(
  steps: number | null | undefined,
  goal: number | null | undefined,
  text: CelebrationText,
  now: Date = new Date(),
): Promise<void> {
  if (!steps || !goal) return;
  const today = localDateKey(now);
  if (steps >= goal) {
    if (await claim("steps_hit", today)) {
      const [title, body] = text.stepsReached(steps, goal);
      await notify("notifStepGoal", title, body, 5);
    }
    return;
  }
  const hour = now.getHours();
  if (hour >= 12 && hour <= 14 && steps < goal * 0.5) {
    if (await claim("steps_midday", today)) {
      const [title, body] = text.stepsMidday(steps, goal - steps);
      await notify("notifStepGoal", title, body, 4);
    }
  }
}
