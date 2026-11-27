/* eslint-disable @typescript-eslint/naming-convention -- the tools' arguments, result keys and the backend's JSON */
/** The write tools (LiftTrace `src/lib/aiTools.js`) */
import { api, ApiError } from "@/api";

import {
  programApi,
  workoutApi,
  type SaveWorkoutBody,
  type SaveWorkoutResponse,
  type Template,
} from "../diary/api";
import { cardioApi, bodyStatsApi } from "../diary/cardioBodyApi";
import type { Exercise } from "../exercises/api";
import { BODY_STATS_SAVED } from "../common/events";
import { ALL_BODY_STATS, bodyStatUnit } from "../lib/bodyStats";
import { localDateStr } from "../lib/dates";
import { foldText } from "../lib/searchText";
import { templateExerciseToLog } from "../lib/templateLoad";
import { ensureExerciseUuids, withFreshIds } from "../lib/workoutUuid";
import type {
  WorkoutExercise,
  WorkoutLog,
  WorkoutSet,
} from "../lib/workoutTypes";
import { activateProgram, getPrograms } from "../programs/api";
import { bodyStatKey } from "./bodyStatKeys";
import { showInDiary, workoutForDate } from "./diary";
import { totalVolume } from "./shape";
import { weightUnit } from "./units";

/**
 * Saves a workout. `changed` names the fields this write sets
 * (X-Changed-Fields): the server keeps its own value of every other field,
 * so what is only sent along never overrides a newer edit made elsewhere.
 * Exercises and sets get their ids here, as the diary's do.
 */
function putWorkout(
  date: string,
  body: SaveWorkoutBody,
  changed: string[] | null,
): Promise<SaveWorkoutResponse> {
  return api.lt.put<SaveWorkoutResponse>(
    `/workout/${date}`,
    { ...body, exercises: ensureExerciseUuids(body.exercises) },
    changed
      ? { headers: { "X-Changed-Fields": changed.join(",") } }
      : undefined,
  );
}

/**
 * What a workout has that a tool doesn't change. An update writes every
 * field, so one left out would be cleared.
 */
function kept(workout: WorkoutLog | null): Partial<WorkoutLog> {
  if (!workout) return {};
  return {
    notes: workout.notes ?? null,
    completed: workout.completed ? 1 : 0,
    program_id: workout.program_id ?? null,
    template_id: workout.template_id ?? null,
    program_week: workout.program_week ?? null,
  };
}

const idOf = (workout: WorkoutLog | null) =>
  workout?.id != null ? { id: workout.id } : {};

/** An exercise of the library by name: an exact match, else the first hit */
async function exerciseByName(name: string): Promise<Exercise | null> {
  const hits = await api.lt.get<Exercise[]>("/exercises", {
    query: { search: name, limit: 5 },
  });
  const wanted = foldText(name).trim();
  return hits.find((h) => foldText(h.name) === wanted) ?? hits.at(0) ?? null;
}

/** A number as a model may send it */
type ModelNumber = number | string;

interface SetArgs {
  weight?: ModelNumber;
  reps?: ModelNumber;
  duration_sec?: ModelNumber;
  rpe?: ModelNumber | null;
  warmup?: boolean;
  completed?: boolean;
}

function loggedSet(set: SetArgs): WorkoutSet {
  const isTimed = Number(set.duration_sec) > 0;
  return {
    weight: Number(set.weight) || 0,
    reps: isTimed ? 0 : Number(set.reps) || 0,
    ...(isTimed ? { duration_sec: Math.round(Number(set.duration_sec)) } : {}),
    completed: set.completed !== false,
    ...(set.warmup ? { warmup: true } : {}),
    ...(set.rpe != null ? { rpe: Number(set.rpe) } : {}),
  };
}

export async function logWorkout({
  date,
  name,
  duration_min,
  exercises,
}: {
  date?: string;
  name?: string;
  duration_min?: ModelNumber;
  exercises?: { name?: string; sets?: SetArgs[] }[];
}) {
  if (!date || !Array.isArray(exercises) || !exercises.length) {
    throw new Error("date and non-empty exercises[] are required");
  }
  // Every name is resolved first; any miss stops before anything is written
  const added: WorkoutExercise[] = [];
  const unknown: string[] = [];
  for (const input of exercises) {
    if (!input.name) throw new Error("Each exercise needs a name");
    const found = await exerciseByName(input.name);
    if (!found) {
      unknown.push(input.name);
      continue;
    }
    const sets = (input.sets ?? []).map(loggedSet);
    added.push({
      exercise_id: found.id,
      exercise_name: found.name,
      sets,
      // So the diary shows a time input at once (issue #89)
      ...(sets.some((s) => s.duration_sec) ? { set_type: "time" } : {}),
    });
  }
  if (unknown.length) {
    throw new Error(
      `Unknown exercise(s): ${unknown.join(", ")}. Please confirm and I'll add as custom, or pick from get_exercises.`,
    );
  }
  const existing = await workoutForDate(date);
  const { workout } = await putWorkout(
    date,
    {
      ...idOf(existing),
      ...kept(existing),
      name: name ?? existing?.name ?? null,
      duration_min:
        duration_min != null
          ? Number(duration_min)
          : (existing?.duration_min ?? null),
      exercises: [...(existing?.exercises ?? []), ...added],
      completed: 1,
    },
    [
      "exercises",
      "completed",
      ...(name != null ? ["name"] : []),
      ...(duration_min != null ? ["duration_min"] : []),
    ],
  );
  showInDiary(date, workout);
  return {
    id: workout?.id,
    date: workout?.date,
    exercises_logged: added.length,
    sets_logged: added.reduce((sum, e) => sum + (e.sets?.length ?? 0), 0),
    total_volume: totalVolume(workout?.exercises),
  };
}

export async function addExerciseToDiary({
  exercise_name,
  date,
}: {
  exercise_name?: string;
  date?: string;
}) {
  if (!exercise_name) throw new Error("exercise_name is required");
  const day = date || localDateStr();
  const found = await exerciseByName(exercise_name);
  if (!found) throw new Error(`Unknown exercise: ${exercise_name}`);
  const existing = await workoutForDate(day);
  const exercises = existing?.exercises ?? [];
  const { workout } = await putWorkout(
    day,
    {
      ...idOf(existing),
      ...kept(existing),
      name: existing?.name ?? null,
      duration_min: existing?.duration_min ?? null,
      exercises: [
        ...exercises,
        {
          exercise_id: found.id,
          exercise_name: found.name,
          sets: [{ weight: 0, reps: 0, completed: false }],
        },
      ],
    },
    ["exercises"],
  );
  showInDiary(day, workout);
  return {
    workout_id: workout?.id,
    exercise_added_id: found.id,
    position: exercises.length,
  };
}

export async function logSet(
  args: SetArgs & {
    workout_id?: ModelNumber;
    exercise_id?: ModelNumber;
    exercise_name?: string;
  },
) {
  const { workout_id, exercise_id, exercise_name } = args;
  if (workout_id == null) throw new Error("workout_id is required");
  const row = (await workoutApi.recent(500)).find(
    (r) => r.id === Number(workout_id),
  );
  if (!row?.date) throw new Error(`Workout ${workout_id} not found`);
  const exercises = [...row.exercises];
  let position = -1;
  if (exercise_id != null && exercises.at(Number(exercise_id))) {
    position = Number(exercise_id);
  } else if (exercise_name) {
    const wanted = foldText(exercise_name);
    position = exercises.findIndex((e) =>
      foldText(e.exercise_name).includes(wanted),
    );
  }
  const exercise = position >= 0 ? exercises.at(position) : undefined;
  if (!exercise) {
    throw new Error(
      "exercise_id (position) or exercise_name is required and must match a slot in the workout",
    );
  }
  const set = loggedSet(args);
  const isTimed = !!set.duration_sec;
  // An exercise with a chosen type takes only that kind of set (issue #89)
  if (isTimed && exercise.set_type === "reps") {
    throw new Error(
      `${exercise.exercise_name} is tracked by reps; send reps, not duration_sec`,
    );
  }
  if (!isTimed && exercise.set_type === "time") {
    throw new Error(
      `${exercise.exercise_name} is tracked by time; send duration_sec, not reps`,
    );
  }
  const sets = [...(exercise.sets ?? []), set];
  exercises[position] = {
    ...exercise,
    sets,
    ...(isTimed && !exercise.set_type ? { set_type: "time" } : {}),
  };
  const { workout } = await putWorkout(
    row.date,
    {
      id: row.id,
      ...kept(row),
      name: row.name ?? null,
      duration_min: row.duration_min ?? null,
      exercises,
    },
    ["exercises"],
  );
  showInDiary(row.date, workout);
  return {
    set_id: sets.length - 1,
    position,
    workout_total_volume: totalVolume(workout?.exercises),
  };
}

/** The other unit of the same measurement: a number in it would be wrong */
const OTHER_UNIT: Partial<Record<string, string[]>> = {
  kg: ["lb", "lbs", "pound", "pounds"],
  lbs: ["kg", "kgs", "kilogram", "kilograms"],
  cm: ["in", "inch", "inches"],
  in: ["cm"],
};

export async function logBodyStat({
  stat,
  value,
  unit,
  date,
  note,
}: {
  stat?: string;
  value?: ModelNumber;
  unit?: string;
  date?: string;
  note?: string;
}) {
  if (!stat) throw new Error("stat is required");
  if (value == null || Number.isNaN(Number(value))) {
    throw new Error("value must be a number");
  }
  const key = bodyStatKey(stat);
  if (!key) {
    throw new Error(
      `LiftTrace can't store "${stat}". It stores: ${ALL_BODY_STATS.join(", ")}.`,
    );
  }
  const own = bodyStatUnit(key, await weightUnit());
  if (unit && OTHER_UNIT[own]?.includes(unit.toLowerCase().trim())) {
    throw new Error(
      `The user tracks ${key} in ${own}. Convert the value to ${own} and call again.`,
    );
  }
  const day = date || localDateStr();
  // The server merges by measurement: the day's others stay
  const saved = (await bodyStatsApi.save(day, { [key]: Number(value) })) as {
    stats?: { id?: number } | null;
  };
  window.dispatchEvent(
    new CustomEvent(BODY_STATS_SAVED, { detail: { date: day } }),
  );
  return {
    id: saved.stats?.id,
    stat: key,
    value: Number(value),
    unit: own,
    date: day,
    ...(note
      ? { warning: "The note was not saved: body stats hold numbers only." }
      : {}),
  };
}

export async function logCardio({
  activity,
  duration_min,
  distance,
  distance_unit,
  avg_hr,
  notes,
  date,
}: {
  activity?: string;
  duration_min?: ModelNumber;
  distance?: number | string | null;
  distance_unit?: string;
  avg_hr?: number | string | null;
  notes?: string;
  date?: string;
}) {
  const name = activity?.trim();
  if (!name) throw new Error("activity is required");
  const minutes = Math.floor(Number(duration_min));
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("duration_min must be a positive number of minutes");
  }
  const day = date || localDateStr();
  const saved = await cardioApi.create({
    date: day,
    activity: name,
    duration_min: minutes,
    distance: distance == null || distance === "" ? null : Number(distance),
    distance_unit: distance_unit === "mi" ? "mi" : "km",
    avg_hr: avg_hr == null || avg_hr === "" ? null : Math.floor(Number(avg_hr)),
    notes: notes || null,
  });
  return {
    id: saved.id,
    date: day,
    activity: name,
    duration_min: minutes,
  };
}

async function templateByName(name: string): Promise<Template> {
  const wanted = foldText(name);
  for (const { id } of await programApi.list()) {
    const templates = (await programApi.get(id)).templates ?? [];
    const found =
      templates.find((t) => foldText(t.name) === wanted) ??
      templates.find((t) => foldText(t.name).includes(wanted));
    if (found) return found;
  }
  throw new Error(`No template matching "${name}"`);
}

export async function startWorkoutFromTemplate({
  template_id,
  template_name,
  date,
}: {
  template_id?: ModelNumber;
  template_name?: string;
  date?: string;
}) {
  if (template_id == null && !template_name) {
    throw new Error("template_id or template_name is required");
  }
  const day = date || localDateStr();
  const template =
    template_id != null
      ? await programApi.template(Number(template_id))
      : await templateByName(template_name ?? "");
  // The plan week it is performed in, only for the program being followed
  let planWeek: number | null = null;
  if (template.program_id != null) {
    const program = await programApi.get(template.program_id).catch(() => null);
    planWeek = program?.is_active ? program.current_week || null : null;
  }
  // Into an empty workout, else a new one of the day, as the diary's + does:
  // a workout under way keeps its name and exercises
  const target = await workoutForDate(day);
  const isNew = !!target?.exercises.length;
  const exercises = withFreshIds(
    template.exercises.map((exercise) =>
      templateExerciseToLog(
        {
          ...exercise,
          exercise_id: exercise.exercise_id || undefined,
          exercise_name:
            exercise.exercise_name ||
            (exercise as { name?: string }).name ||
            "",
        },
        null,
        planWeek,
      ),
    ),
  );
  const { workout } = await putWorkout(
    day,
    {
      ...(isNew ? { new_session: true } : { ...idOf(target), ...kept(target) }),
      template_id: template.id,
      program_id: template.program_id ?? null,
      program_week: planWeek,
      name: template.name,
      duration_min: isNew ? null : (target?.duration_min ?? null),
      exercises,
    },
    isNew
      ? null
      : ["exercises", "name", "template_id", "program_id", "program_week"],
  );
  // A new workout opens in the diary, so what comes next goes into it
  showInDiary(day, workout, { isOpening: isNew });
  return {
    workout_id: workout?.id,
    new_workout: isNew,
    exercises_loaded: exercises.length,
    from_template: { id: template.id, name: template.name },
  };
}

export async function setActiveProgram({
  program_id,
  program_name,
}: {
  program_id?: ModelNumber;
  program_name?: string;
}) {
  if (program_id == null && !program_name) {
    throw new Error("program_id or program_name is required");
  }
  const programs = await getPrograms();
  const wanted = foldText(program_name);
  const target =
    program_id != null
      ? programs.find((p) => p.id === Number(program_id))
      : (programs.find((p) => foldText(p.name) === wanted) ??
        programs.find((p) => foldText(p.name).includes(wanted)));
  if (!target) {
    throw new Error(`No program matching ${program_id ?? program_name}`);
  }
  const previous = programs.find((p) => p.is_active);
  await activateProgram(target.id);
  return {
    active_program_id: target.id,
    previous_active_program_id:
      previous && previous.id !== target.id ? previous.id : null,
    name: target.name,
  };
}

export async function addCoachPrescription({
  trainee_id,
  template_id,
  target_date,
  notes,
}: {
  trainee_id?: ModelNumber;
  template_id?: ModelNumber;
  target_date?: string;
  notes?: string;
}) {
  if (trainee_id == null || template_id == null || !target_date) {
    throw new Error("trainee_id, template_id, and target_date are required");
  }
  try {
    const row = await api.lt.post<{ id?: number }>(
      `/trainer/members/${Number(trainee_id)}/prescriptions`,
      {
        template_id: Number(template_id),
        date: target_date,
        notes: notes || null,
      },
    );
    return {
      prescription_id: row.id,
      trainee_id: Number(trainee_id),
      template_id: Number(template_id),
      target_date,
    };
  } catch (error) {
    // A message the model can relay
    if (
      error instanceof ApiError &&
      (error.status === 403 || /not your member|forbidden/i.test(error.message))
    ) {
      throw new Error(
        "Only a coach or admin can prescribe workouts to their own members.",
        { cause: error },
      );
    }
    throw error;
  }
}
