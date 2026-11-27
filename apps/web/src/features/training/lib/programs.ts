/**
 * Program logic, after backends/lifttrace/src/lib/program-actions.js and the
 * permission and display rules of Programs.svelte / ProgramDetail.svelte.
 */
import { fmtSetDuration, parseDuration } from "./workout";
import { toText } from "./searchText";

/** "Push (Copy)" → "Push (Copy 2)": the lowest free suffix, never chained */
export function nextCopyName(
  sourceName: string | null | undefined,
  existingNames: string[],
): string {
  const base =
    (sourceName ?? "").replace(/\s*\(Copy(?:\s+\d+)?\)\s*$/, "").trim() ||
    "Program";
  const taken = new Set(existingNames);
  if (!taken.has(`${base} (Copy)`)) return `${base} (Copy)`;
  let n = 2;
  while (taken.has(`${base} (Copy ${n})`)) n++;
  return `${base} (Copy ${n})`;
}

/** A program's length in weeks, 1 to 52, whatever was typed */
export function clampWeeks(value: unknown): number {
  const weeks = parseInt(toText(value), 10);
  return Math.min(52, Math.max(1, weeks || 1));
}

/** The list with the item at `from` moved to `to` */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return list;
  if (from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface ProgramViewer {
  id: number;
  role?: unknown;
}

export interface ProgramAccess {
  /** May rename, change, delete, and edit the workouts */
  isOwner: boolean;
  /** Someone else's program (a coach's): opens read-only */
  isOthers: boolean;
  isCoach: boolean;
  canAssign: boolean;
}

/**
 * What the viewer may do (server/lib/program-access.js). Trace always signs
 * in, so user management is on.
 */
export function programAccess(
  program: { created_by?: number | null } | null | undefined,
  viewer: ProgramViewer | null | undefined,
): ProgramAccess {
  const isCoach = viewer?.role === "trainer" || viewer?.role === "admin";
  const maker = program?.created_by;
  const isOwner = !!viewer && !!program && maker === viewer.id;
  return {
    isOwner,
    isOthers: !!viewer && maker != null && maker !== viewer.id,
    isCoach,
    canAssign: isCoach && isOwner,
  };
}

export interface TemplateExercise {
  id?: number | string;
  name?: string | null;
  exercise_name?: string | null;
  set_type?: string | null;
  target_sets?: number | string | null;
  target_reps?: number | string | null;
  target_weight?: number | string | null;
  target_duration?: number | string | null;
}

/** "3 × 8-10 @ 60" or "3 × 1:00"; "" when nothing is planned */
export function targetText(exercise: TemplateExercise): string {
  const sets = toText(exercise.target_sets);
  const amount =
    exercise.set_type === "time"
      ? fmtSetDuration(parseDuration(exercise.target_duration)) ||
        toText(exercise.target_duration)
      : toText(exercise.target_reps);
  const weight = toText(exercise.target_weight);
  if (!sets && !amount && !weight) return "";
  return [sets ? `${sets} ×` : "", amount, weight ? `@ ${weight}` : ""]
    .filter(Boolean)
    .join(" ");
}

export interface ProgressSource {
  is_active?: number | boolean | null;
  duration_weeks?: number | null;
  current_week?: number | null;
  weeks_active?: number | null;
  sessions_in_program?: number | null;
}

export interface CardProgress {
  /** "Week n of m" when the block has weeks, else "Week n" */
  week: { current: number; of?: number } | null;
  sessions: number;
}

/** The progress line of the active program's card; null when there is none */
export function cardProgress(program: ProgressSource): CardProgress | null {
  const weeks = program.weeks_active ?? 0;
  const sessions = program.sessions_in_program ?? 0;
  if (!program.is_active || (weeks <= 0 && sessions <= 0)) return null;
  const duration = program.duration_weeks ?? 1;
  const week =
    duration > 1 && program.current_week
      ? { current: program.current_week, of: duration }
      : weeks > 0
        ? { current: weeks }
        : null;
  return { week, sessions };
}
