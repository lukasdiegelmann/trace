/** The read tools (LiftTrace `src/lib/aiTools.js`) */
import { api } from "@/api";

import { prescriptionApi, workoutApi } from "../diary/api";
import type { Exercise } from "../exercises/api";
import { bodyStatUnit, parseBodyStatsResponse } from "../lib/bodyStats";
import type { CardioSession } from "../lib/cardio";
import { addDays, localDateStr } from "../lib/dates";
import type { ProgressPhoto } from "../lib/progressPhotos";
import { foldText } from "../lib/searchText";
import type { BodyStatsRow, StatRecord } from "../lib/statistics";
import type { WorkoutLog } from "../lib/workoutTypes";
import { getProgram, getPrograms } from "../programs/api";
import type { Streaks, WeekCount, WeekVolume } from "../statistics/api";
import { bodyStatKey } from "./bodyStatKeys";
import { shapeProgram, shapeWorkout } from "./shape";
import { weightUnit } from "./units";

const lt = api.lt;

const daysAgo = (days: number) => addDays(localDateStr(), -days);

/** A number as a model may send it */
type ModelNumber = number | string;

interface Range {
  date_from?: string;
  date_to?: string;
}

export async function getWorkouts({
  date_from,
  date_to,
  exercise_name,
}: Range & { exercise_name?: string }) {
  const from = date_from || daysAgo(30);
  const to = date_to || localDateStr();
  // /workout/recent has no date range: a generous window, filtered here
  const rows = await workoutApi.recent(200);
  const inRange = rows.filter(
    (r) => (r.date ?? "") >= from && (r.date ?? "") <= to,
  );
  const needle = foldText(exercise_name).trim();
  const hasLift = (r: WorkoutLog) =>
    r.exercises.some((e) => foldText(e.exercise_name).includes(needle));
  const matched = needle ? inRange.filter(hasLift) : inRange;
  // Issue #92: a lift last trained six weeks ago is not missing from the log
  // because the default window is 30 days
  if (needle && !matched.length && !date_from && !date_to) {
    const older = rows.filter(hasLift).slice(0, 10);
    if (older.length) return older.map(shapeWorkout);
  }
  return matched.map(shapeWorkout);
}

export async function getWorkout({ id }: { id?: ModelNumber }) {
  if (id == null) throw new Error("id is required");
  // The diary is keyed by date: find the row in a bounded recent window
  const row = (await workoutApi.recent(500)).find((r) => r.id === Number(id));
  if (!row?.date) throw new Error(`Workout ${id} not found`);
  // By date too, for the coach's feedback and the program's context
  try {
    const { workout } = await workoutApi.get(row.date, row.id);
    const shaped = shapeWorkout(workout ?? row);
    if (!workout?.feedback?.length) return shaped;
    return {
      ...shaped,
      coach_feedback: workout.feedback.map((f) => ({
        trainer_name: f.trainer_name,
        exercise_idx: f.exercise_idx,
        note: f.note,
        updated_at: f.updated_at,
      })),
    };
  } catch {
    return shapeWorkout(row);
  }
}

export async function getExercises({
  query,
  muscle,
  equipment,
  source,
  limit,
}: {
  query?: string;
  muscle?: string;
  equipment?: string;
  source?: string;
  limit?: ModelNumber;
}) {
  const cap = Math.min(Number(limit) || 20, 100);
  const rows = await lt.get<Exercise[]>("/exercises", {
    // Slack for the filters the server doesn't have
    query: {
      search: query || undefined,
      equipment: equipment || undefined,
      limit: cap * 3,
    },
  });
  const wantedMuscle = (muscle ?? "").toLowerCase().trim();
  const wantedSource = (source ?? "").toLowerCase().trim();
  return rows
    .filter((r) => {
      const muscles = [
        ...(r.primary_muscles ?? []),
        ...(r.secondary_muscles ?? []),
      ];
      return (
        (!wantedMuscle ||
          muscles.some((m) => m.toLowerCase().includes(wantedMuscle))) &&
        (!wantedSource || (r.source ?? "").toLowerCase() === wantedSource)
      );
    })
    .slice(0, cap)
    .map((r) => ({
      id: r.id,
      name: r.name,
      primary_muscles: r.primary_muscles ?? [],
      secondary_muscles: r.secondary_muscles ?? [],
      equipment: r.equipment ?? [],
      source: r.source || null,
      has_media: !!(r.gif_url || r.img_url || r.video_url),
    }));
}

export async function getExercise({
  id,
  name,
}: {
  id?: ModelNumber;
  name?: string;
}) {
  let wanted = id;
  if (wanted == null) {
    if (!name) throw new Error("Provide id or name");
    const matches = await lt.get<Exercise[]>("/exercises", {
      query: { search: name, limit: 1 },
    });
    if (!matches[0]) throw new Error(`No exercise found matching "${name}"`);
    wanted = matches[0].id;
  }
  const row = await lt.get<Exercise>(`/exercises/${Number(wanted)}`);
  // Similar exercises: the same first primary muscle, up to five
  let similar: { id: number; name: string }[] = [];
  const primary = row.primary_muscles?.[0]?.toLowerCase();
  if (primary) {
    try {
      const pool = await lt.get<Exercise[]>("/exercises", {
        query: { limit: 40 },
      });
      similar = pool
        .filter(
          (x) =>
            x.id !== row.id &&
            (x.primary_muscles ?? []).some((m) => m.toLowerCase() === primary),
        )
        .slice(0, 5)
        .map((x) => ({ id: x.id, name: x.name }));
    } catch {
      // The exercise is the answer; similar ones are extra
    }
  }
  return {
    id: row.id,
    name: row.name,
    description: (row as { description?: string }).description || null,
    primary_muscles: row.primary_muscles ?? [],
    secondary_muscles: row.secondary_muscles ?? [],
    equipment: row.equipment ?? [],
    source: row.source || null,
    instructions: row.instructions || null,
    tips: row.tips || null,
    similar_exercises: similar,
  };
}

export async function listPrograms() {
  return (await getPrograms()).map((p) => ({
    id: p.id,
    name: p.name,
    goal: p.goal,
    template_count: p.template_count ?? 0,
    weeks: p.duration_weeks ?? 1,
    is_active: !!p.is_active,
    ...(p.current_week ? { current_week: p.current_week } : {}),
  }));
}

export async function readProgram({ id }: { id?: ModelNumber }) {
  if (id == null) throw new Error("id is required");
  return shapeProgram(await getProgram(Number(id)));
}

export async function getActiveProgram() {
  const active = (await getPrograms()).find((p) => p.is_active);
  if (!active) return { active: false };
  return shapeProgram(await getProgram(active.id));
}

export async function getPrs({
  exercise_name,
  date_from,
  date_to,
  limit,
}: Range & { exercise_name?: string; limit?: ModelNumber }) {
  const records = await lt.get<StatRecord[]>("/stats/records");
  const needle = foldText(exercise_name).trim();
  // A timed exercise has no max weight; its record is the longest hold
  const isHold = (r: StatRecord) =>
    !((r.maxWeight ?? 0) > 0) && (r.maxDuration ?? 0) > 0;
  const dateOf = (r: StatRecord) => (isHold(r) ? r.durationDate : r.date);
  return records
    .filter((r) => (r.maxWeight ?? 0) > 0 || (r.maxDuration ?? 0) > 0)
    .filter((r) => !needle || foldText(r.name).includes(needle))
    .filter((r) => !date_from || (dateOf(r) ?? "") >= date_from)
    .filter((r) => {
      const date = dateOf(r);
      return !date_to || (!!date && date <= date_to);
    })
    .sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0))
    .slice(0, Number(limit) || 20)
    .map((r) =>
      isHold(r)
        ? {
            exercise_name: r.name,
            longest_hold_sec: r.maxDuration,
            ...(r.maxDurationWeight
              ? { hold_weight: r.maxDurationWeight }
              : {}),
            date: r.durationDate || null,
          }
        : {
            exercise_name: r.name,
            weight: r.maxWeight,
            reps: r.maxReps,
            one_rep_max_estimate: r.e1rm,
            date: r.date || null,
          },
    );
}

interface StatPoint {
  date: string;
  stat: string;
  value: number;
  unit: unknown;
}

const bodyStatsRange = (start: string, end: string) =>
  lt.get<BodyStatsRow[]>("/body-stats/range", { query: { start, end } });

/** A stored measurement: a number, or the `{ value, unit }` of older writes */
function readStat(raw: unknown): { value?: unknown; unit?: unknown } {
  return raw && typeof raw === "object" ? raw : { value: raw };
}

export async function getBodyStats({
  stat,
  date_from,
  date_to,
}: Range & { stat?: string }) {
  const [rows, unit] = await Promise.all([
    bodyStatsRange(date_from || daysAgo(90), date_to || localDateStr()),
    weightUnit(),
  ]);
  const wanted = stat ? (bodyStatKey(stat) ?? stat) : null;
  const series: StatPoint[] = [];
  for (const row of rows) {
    for (const [key, raw] of Object.entries(
      parseBodyStatsResponse(row) as Record<string, unknown>,
    )) {
      if (wanted && key !== wanted) continue;
      if (raw == null || raw === "") continue;
      const stored = readStat(raw);
      const id = bodyStatKey(key);
      series.push({
        date: row.date,
        stat: key,
        value: Number(stored.value),
        unit: stored.unit ?? (id ? bodyStatUnit(id, unit) : null),
      });
    }
  }
  series.sort((a, b) => a.date.localeCompare(b.date));
  const values = series.map((s) => s.value).filter((n) => Number.isFinite(n));
  const first = series.at(0)?.value;
  const last = series.at(-1)?.value;
  if (!wanted || !values.length || first == null || last == null) {
    return { series };
  }
  return {
    series,
    summary: {
      first,
      last,
      min: Math.min(...values),
      max: Math.max(...values),
      change_absolute: Math.round((last - first) * 100) / 100,
      change_pct: first
        ? Math.round(((last - first) / first) * 1000) / 10
        : null,
    },
  };
}

/**
 * Progress-photo metadata only: no image and no address of one. A user's body
 * photos never go to a model provider as a side effect of a tool.
 */
export async function getProgressPhotos({ date_from, date_to }: Range) {
  const start = date_from || daysAgo(365);
  const end = date_to || localDateStr();
  const [answer, statRows, unit] = await Promise.all([
    lt.get<{ photos?: ProgressPhoto[]; count?: number }>("/body-stats/photos", {
      query: { start, end },
    }),
    bodyStatsRange(start, end).catch((): BodyStatsRow[] => []),
    weightUnit(),
  ]);
  const weights = new Map<string, unknown>();
  for (const row of statRows) {
    const raw = (parseBodyStatsResponse(row) as Record<string, unknown>).weight;
    if (raw != null && raw !== "") weights.set(row.date, readStat(raw).value);
  }
  // Several shots of one day are one session
  const byDate = new Map<string, number>();
  for (const photo of answer.photos ?? []) {
    byDate.set(photo.date, (byDate.get(photo.date) ?? 0) + 1);
  }
  const entries = [...byDate.keys()].sort().map((date) => ({
    date,
    photos: byDate.get(date),
    ...(weights.has(date)
      ? { weight: weights.get(date), weight_unit: unit }
      : {}),
  }));
  return {
    start,
    end,
    count: answer.count ?? answer.photos?.length ?? 0,
    days_with_photos: entries.length,
    first: entries[0] ?? null,
    latest: entries[entries.length - 1] ?? null,
    entries,
    note: "Metadata only. Image content is not available to you; ask the user to attach a photo if you need to see one.",
  };
}

/** Cardio has its own table: get_workouts and the stats don't include it */
export async function getCardio({
  date_from,
  date_to,
  activity,
}: Range & { activity?: string }) {
  const start = date_from || daysAgo(30);
  const end = date_to || localDateStr();
  const rows = await lt.get<CardioSession[]>("/cardio", {
    query: { start, end },
  });
  const needle = foldText(activity).trim();
  const sessions = rows
    .filter((r) => !needle || foldText(r.activity).includes(needle))
    .map((r) => ({
      date: r.date,
      activity: r.activity,
      duration_min: r.duration_min,
      ...(r.distance != null
        ? { distance: r.distance, distance_unit: r.distance_unit || "km" }
        : {}),
      ...(r.avg_hr != null ? { avg_hr: r.avg_hr } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
    }));
  const byActivity: Record<string, { sessions: number; minutes: number }> = {};
  let totalMinutes = 0;
  for (const session of sessions) {
    const minutes = session.duration_min || 0;
    totalMinutes += minutes;
    const total = (byActivity[session.activity || "unknown"] ??= {
      sessions: 0,
      minutes: 0,
    });
    total.sessions += 1;
    total.minutes += minutes;
  }
  return {
    start,
    end,
    count: sessions.length,
    total_minutes: totalMinutes,
    by_activity: byActivity,
    sessions,
  };
}

const RANGE_DAYS: Partial<Record<string, number | null>> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: null,
};

export async function getStatsOverview({ range }: { range?: string }) {
  const name = (range || "30d").toLowerCase();
  const known = RANGE_DAYS[name];
  const days = known === undefined ? 30 : known;
  let from: string;
  if (days === null) {
    from = await lt
      .get<{ date?: string | null }>("/stats/earliest-workout-date")
      .then((answer) => answer.date || daysAgo(3650))
      .catch(() => daysAgo(3650));
  } else {
    from = daysAgo(days);
  }
  const to = localDateStr();
  const query = { start: from, end: to };
  const [streaks, volume, frequency, muscleSets, records] = await Promise.all([
    lt
      .get<Partial<Streaks>>("/stats/streaks")
      .catch((): Partial<Streaks> => ({})),
    lt
      .get<WeekVolume[]>("/stats/volume", { query })
      .catch((): WeekVolume[] => []),
    lt
      .get<WeekCount[]>("/stats/frequency", { query })
      .catch((): WeekCount[] => []),
    lt
      .get<Record<string, number>>("/stats/muscle-effective-sets", { query })
      .catch((): Record<string, number> => ({})),
    lt.get<StatRecord[]>("/stats/records").catch((): StatRecord[] => []),
  ]);
  const workouts = frequency.reduce((sum, week) => sum + (week.count || 0), 0);
  const weeks = Math.max(1, frequency.length || Math.ceil(days ? days / 7 : 1));
  const groups = Object.entries(muscleSets);
  const totalSets = groups.reduce((sum, [, sets]) => sum + (sets || 0), 0);
  const meanSets = totalSets && groups.length ? totalSets / groups.length : 0;
  return {
    range: name,
    date_from: from,
    date_to: to,
    workouts_in_range: workouts,
    streak_current: streaks.currentStreak ?? 0,
    streak_best: streaks.longestStreak ?? 0,
    weekly_avg: Math.round((workouts / weeks) * 10) / 10,
    weekly_volume: volume.map((v) => ({
      week: v.week,
      volume: Math.round(v.volume),
    })),
    weekly_frequency: frequency,
    muscle_group_balance: groups
      .map(([group, sets]) => ({
        group,
        sets_pct: totalSets ? Math.round((sets / totalSets) * 1000) / 10 : 0,
        imbalance_pct: meanSets
          ? Math.round(((sets - meanSets) / meanSets) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.sets_pct - a.sets_pct),
    top_prs_in_range: records
      .filter((r) => r.date && r.date >= from && r.date <= to)
      .sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0))
      .slice(0, 5)
      .map((r) => ({
        exercise_name: r.name,
        weight: r.maxWeight,
        reps: r.maxReps,
        one_rep_max_estimate: r.e1rm,
        date: r.date,
      })),
  };
}

export async function getCoachPrescription({ date }: { date?: string }) {
  const day = date || localDateStr();
  const row = await prescriptionApi.forDate(day).catch(() => null);
  if (!row) return { prescribed: false };
  const status = row.status ?? "accepted";
  return {
    prescribed: true,
    prescription: {
      trainer_name: row.trainer_name || null,
      // Not loadable until the user accepts it on the diary
      workout_template_ref:
        row.template_id && status === "accepted"
          ? { id: row.template_id, name: row.template_name }
          : null,
      workout_name: row.template_name || row.name || null,
      program_name: row.program_name || null,
      inline_name: row.name || null,
      notes: row.notes || null,
      target_date: row.date || day,
      // "pending" (waiting for Accept or Decline), "accepted" or "declined"
      status,
    },
  };
}
