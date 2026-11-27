/** Intermittent fasting rules, ported from nutritrace/src/stores/fasting.js */
import { localDateStr } from "./dates";

export const FASTING_PRESETS = [
  { name: "14:10", hours: 14 },
  { name: "16:8", hours: 16 },
  { name: "18:6", hours: 18 },
  { name: "20:4", hours: 20 },
  { name: "OMAD", hours: 23 },
] as const;

export const MAX_CUSTOM_PRESETS = 3;

export interface FastingSchedule {
  isEnabled: boolean;
  /** `HH:MM`, local */
  time: string;
  /** 0 = Sunday */
  days: number[];
  /** The local day the schedule last fired or was skipped */
  lastFired: string | null;
}

/** Later than this, a missed start is skipped for the day */
const MAX_LATE_MS = 4 * 3600 * 1000;

export type ScheduleDecision =
  | { action: "none" }
  /** Too late for today: remember it so it isn't asked again */
  | { action: "skip"; day: string }
  | { action: "start"; day: string };

/**
 * Whether the auto-start schedule starts a fast now. "Today" is the local
 * calendar day (upstream compared a UTC date with local time).
 */
export function scheduleDecision(
  schedule: FastingSchedule,
  hasActiveFast: boolean,
  now: Date = new Date(),
): ScheduleDecision {
  const none: ScheduleDecision = { action: "none" };
  if (!schedule.isEnabled) return none;
  const day = localDateStr(now);
  if (schedule.lastFired === day) return none;
  if (!schedule.days.includes(now.getDay())) return none;
  const [hours, minutes] = (schedule.time || "20:00")
    .split(":")
    .map((part) => parseInt(part, 10) || 0);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  const late = now.getTime() - scheduled.getTime();
  if (late < 0) return none;
  if (late > MAX_LATE_MS) return { action: "skip", day };
  return hasActiveFast ? none : { action: "start", day };
}

export function elapsedMs(startAt: string, now: Date = new Date()): number {
  return Math.max(0, now.getTime() - new Date(startAt).getTime());
}

/** Whole hours and minutes of a duration */
export function hoursAndMinutes(ms: number): {
  hours: number;
  minutes: number;
} {
  const total = Math.floor(ms / 60000);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export const MAX_START_AGE_DAYS = 7;

/** An edited start must be in the past, at most 7 days back */
export function startEditError(
  start: Date,
  now: Date = new Date(),
): "invalid" | "future" | "tooOld" | null {
  if (Number.isNaN(start.getTime())) return "invalid";
  if (start.getTime() > now.getTime()) return "future";
  const age = now.getTime() - start.getTime();
  return age > MAX_START_AGE_DAYS * 86400000 ? "tooOld" : null;
}
