import { api } from "@/api";

import type {
  BodyStatsRow,
  ProgressPoint,
  RecentWorkout,
  StatRecord,
} from "../lib/statistics";
import type { MuscleLoad } from "../lib/statisticsMuscles";

export interface WeekVolume {
  week: string;
  volume: number;
}
export interface WeekCount {
  week: string;
  count: number;
}
export interface Streaks {
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
}
export interface WeekdayCount {
  /** 0 is Sunday */
  day: number;
  count: number;
}
export interface CardioWeek {
  week: string;
  minutes: number;
}
export interface CardioSession {
  id: number;
  date: string;
  activity?: string | null;
  duration_min?: number | null;
  distance?: number | null;
  distance_unit?: string | null;
  avg_hr?: number | null;
}

/** What one load gathers; what failed is missing, never zero */
export interface Statistics {
  volume?: WeekVolume[];
  frequency?: WeekCount[];
  records?: StatRecord[];
  streaks?: Streaks;
  muscleLoad?: MuscleLoad;
  weekdays?: WeekdayCount[];
  cardioWeeks?: CardioWeek[];
  cardioSessions?: CardioSession[];
  workouts?: RecentWorkout[];
  bodyStats?: BodyStatsRow[];
  /** At least one of them failed */
  hasFailed: boolean;
}

export function getEarliestWorkoutDate(): Promise<string | null> {
  return api.lt
    .get<{ date?: string | null }>("/stats/earliest-workout-date")
    .then((answer) => answer.date ?? null);
}

export async function getStatistics(
  start: string,
  end: string,
  bodyStart: string,
): Promise<Statistics> {
  const query = { start, end };
  const requests = {
    volume: api.lt.get<WeekVolume[]>("/stats/volume", { query }),
    frequency: api.lt.get<WeekCount[]>("/stats/frequency", { query }),
    records: api.lt.get<StatRecord[]>("/stats/records"),
    streaks: api.lt.get<Streaks>("/stats/streaks"),
    muscleLoad: api.lt.get<MuscleLoad>("/stats/muscle-effective-sets", {
      query,
    }),
    weekdays: api.lt.get<WeekdayCount[]>("/stats/weekday-distribution", {
      query,
    }),
    cardioWeeks: api.lt.get<CardioWeek[]>("/cardio/stats/weekly", { query }),
    cardioSessions: api.lt.get<CardioSession[]>("/cardio", { query }),
    workouts: api.lt.get<RecentWorkout[]>("/workout/recent", {
      query: { limit: 365 },
    }),
    // Weigh-ins don't depend on workouts: their range has its own start.
    bodyStats: api.lt.get<BodyStatsRow[]>("/body-stats/range", {
      query: { start: bodyStart, end },
    }),
  };
  const keys = Object.keys(requests) as (keyof typeof requests)[];
  const results = await Promise.allSettled(keys.map((key) => requests[key]));
  const statistics: Record<string, unknown> = {};
  let hasFailed = false;
  results.forEach((result, index) => {
    const key = keys[index] as string;
    if (result.status === "fulfilled") statistics[key] = result.value;
    else hasFailed = true;
  });
  return { ...(statistics as Omit<Statistics, "hasFailed">), hasFailed };
}

export function getExerciseProgress(
  exerciseId: number,
  start: string,
  end: string,
): Promise<ProgressPoint[]> {
  return api.lt.get<ProgressPoint[]>(`/stats/progress/${exerciseId}`, {
    query: { start, end },
  });
}

export interface PickableExercise {
  id: number;
  name: string;
  category?: string | null;
  primary_muscles?: string[] | null;
}

export function getExerciseList(): Promise<PickableExercise[]> {
  return api.lt.get<PickableExercise[]>("/exercises");
}
