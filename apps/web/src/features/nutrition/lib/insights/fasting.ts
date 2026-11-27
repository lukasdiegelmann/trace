/**
 * Fasting insights on the Statistics page, after
 * nutritrace/src/stores/fasting.js (fastingStats) and
 * components/diary/FastingInsights.svelte.
 */

export interface Fast {
  id: number;
  start_at: string;
  end_at: string | null;
  goal_hours: number | null;
}

export interface FastingStats {
  count: number;
  avg_hours: number;
  longest_hours: number;
  current_streak: number;
  longest_streak: number;
}

function hoursOf(fast: { start_at: string }, end: number): number {
  return (end - new Date(fast.start_at).getTime()) / 3600000;
}

/** UTC day of an ISO moment, as fasting.js keys it */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Average and longest fast, and streaks of days whose fast met its goal
 * (an active fast past its goal counts for today).
 */
export function fastingStats(
  history: readonly Fast[],
  active: Fast | null = null,
  now: Date = new Date(),
): FastingStats {
  const completed = history.filter(
    (f): f is Fast & { end_at: string } => !!f.end_at,
  );
  if (!completed.length && !active) {
    return {
      count: 0,
      avg_hours: 0,
      longest_hours: 0,
      current_streak: 0,
      longest_streak: 0,
    };
  }
  const durations = completed.map((f) =>
    hoursOf(f, new Date(f.end_at).getTime()),
  );
  const avg = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  const longest = durations.length ? Math.max(...durations) : 0;

  const goalsByDay = new Map<string, boolean>();
  completed.forEach((f, i) => {
    const day = f.end_at.slice(0, 10);
    const isHit = durations[i] >= (f.goal_hours || 16);
    goalsByDay.set(day, (goalsByDay.get(day) ?? false) || isHit);
  });
  if (active && hoursOf(active, now.getTime()) >= (active.goal_hours || 16)) {
    goalsByDay.set(utcDay(now), true);
  }

  let currentStreak = 0;
  const cursor = new Date(now);
  while (goalsByDay.get(utcDay(cursor))) {
    currentStreak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...goalsByDay.keys()].sort()) {
    if (!goalsByDay.get(day)) {
      run = 0;
      previous = day;
      continue;
    }
    if (previous) {
      const gap =
        (new Date(day).getTime() - new Date(previous).getTime()) / 86400000;
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  return {
    count: completed.length,
    avg_hours: Math.round(avg * 10) / 10,
    longest_hours: Math.round(longest * 10) / 10,
    current_streak: currentStreak,
    longest_streak: longestStreak,
  };
}

/**
 * The 14 bars: per UTC day the longest fast that ended that day, today
 * including the running fast.
 */
export function fastingDays(
  history: readonly Fast[],
  active: Fast | null,
  now: Date = new Date(),
): { day: string; hours: number }[] {
  const map = new Map<string, number>();
  for (const f of history) {
    if (!f.end_at) continue;
    const day = f.end_at.slice(0, 10);
    map.set(
      day,
      Math.max(map.get(day) ?? 0, hoursOf(f, new Date(f.end_at).getTime())),
    );
  }
  if (active) {
    const today = utcDay(now);
    map.set(
      today,
      Math.max(map.get(today) ?? 0, hoursOf(active, now.getTime())),
    );
  }
  const out: { day: string; hours: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const day = utcDay(d);
    out.push({ day, hours: map.get(day) ?? 0 });
  }
  return out;
}

/** Whether a finished fast reached its goal (default 16 h) */
export function isFastGoalMet(fast: Fast): boolean {
  if (!fast.end_at) return false;
  return (
    hoursOf(fast, new Date(fast.end_at).getTime()) >= (fast.goal_hours || 16)
  );
}

/** A fast's length as "16h 05m" */
export function formatFastDuration(fast: Fast): string {
  if (!fast.end_at) return "—";
  const h = hoursOf(fast, new Date(fast.end_at).getTime());
  const whole = Math.floor(h);
  const m = Math.round((h - whole) * 60);
  return `${whole}h ${String(m).padStart(2, "0")}m`;
}
