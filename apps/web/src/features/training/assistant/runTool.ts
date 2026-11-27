/** The dispatcher of the LiftTrace tools, with the guards around it */
import { localDateStr } from "../lib/dates";
import { toText } from "../lib/searchText";
import { settleDiary } from "./diary";
import { checkWriteDate, cleanRangeArgs, isEmptyResult } from "./guards";
import * as reads from "./reads";
import * as writes from "./writes";

type Executor = (args: Record<string, unknown>) => Promise<unknown>;

/** The model's arguments are what the schema asks; each tool checks its own */
const executor = (run: (args: never) => Promise<unknown>): Executor =>
  run as Executor;

export const EXECUTORS: Partial<Record<string, Executor>> = {
  get_workouts: executor(reads.getWorkouts),
  get_workout: executor(reads.getWorkout),
  get_exercises: executor(reads.getExercises),
  get_exercise: executor(reads.getExercise),
  get_programs: executor(reads.listPrograms),
  get_program: executor(reads.readProgram),
  get_active_program: executor(reads.getActiveProgram),
  get_prs: executor(reads.getPrs),
  get_body_stats: executor(reads.getBodyStats),
  get_progress_photos: executor(reads.getProgressPhotos),
  get_cardio: executor(reads.getCardio),
  get_stats_overview: executor(reads.getStatsOverview),
  get_coach_prescription: executor(reads.getCoachPrescription),
  log_workout: executor(writes.logWorkout),
  add_exercise_to_diary: executor(writes.addExerciseToDiary),
  log_set: executor(writes.logSet),
  log_body_stat: executor(writes.logBodyStat),
  log_cardio: executor(writes.logCardio),
  start_workout_from_template: executor(writes.startWorkoutFromTemplate),
  set_active_program: executor(writes.setActiveProgram),
  add_coach_prescription: executor(writes.addCoachPrescription),
};

const RANGE_TOOLS = new Set([
  "get_workouts",
  "get_prs",
  "get_body_stats",
  "get_cardio",
  "get_progress_photos",
]);

/** Tools that save into a workout */
const WORKOUT_WRITES = new Set([
  "log_set",
  "log_workout",
  "add_exercise_to_diary",
  "start_workout_from_template",
]);

export async function runTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const run = EXECUTORS[name];
  if (!run) throw new Error(`Unknown tool: ${name}`);
  checkWriteDate(name, args);
  if (WORKOUT_WRITES.has(name)) await settleDiary();
  if (!RANGE_TOOLS.has(name)) return run(args);

  const cleaned = cleanRangeArgs(args);
  const result = await run(cleaned);
  const { date_from, date_to, ...rest } = cleaned;
  if (!(date_from || date_to) || !isEmptyResult(result)) return result;

  // The model's own range found nothing: before it tells the user the data
  // is missing, try the default window
  const fallback = await run(rest);
  if (isEmptyResult(fallback)) return result;
  return {
    note:
      `Nothing found between ${toText(date_from) || "the start"} and ${toText(date_to) || "today"}. ` +
      `Today is ${localDateStr()}; unless the user named those dates, they were wrong. ` +
      "These results use the default window instead.",
    results: fallback,
  };
}
