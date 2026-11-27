/**
 * The date guard (LiftTrace issue #92). Models invent dates, so:
 *
 *   Reads   A malformed date is dropped so the default applies, a range that
 *           ends in the future is clamped to today, an inverted range is
 *           swapped. If a range the model supplied comes back empty but the
 *           default window does not, the default results are returned with a
 *           note naming today's date (see runTool).
 *   Writes  A date more than WRITE_WINDOW_DAYS from today is refused unless
 *           date_confirmed is true.
 */
import { dayOffset, localDateStr } from "../lib/dates";

export const WRITE_WINDOW_DAYS = 60;

const WRITE_DATE_FIELD: Partial<Record<string, string>> = {
  log_workout: "date",
  log_body_stat: "date",
  log_cardio: "date",
  add_exercise_to_diary: "date",
  start_workout_from_template: "date",
  add_coach_prescription: "target_date",
};

/** A calendar day, checked in UTC so that no time zone shifts it */
function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export interface RangeArgs {
  date_from?: unknown;
  date_to?: unknown;
}

/** Tidies a model-supplied read range; returns the cleaned arguments */
export function cleanRangeArgs<A extends RangeArgs>(args: A): A {
  const today = localDateStr();
  let from = isRealDate(args.date_from) ? args.date_from : undefined;
  let to = isRealDate(args.date_to) ? args.date_to : undefined;
  if (to && to > today) to = today;
  if (from && from > today) from = undefined;
  if (from && to && from > to) [from, to] = [to, from];
  // A dropped date is absent, so that the tool's default applies
  const rest = { ...args } as Record<string, unknown>;
  delete rest.date_from;
  delete rest.date_to;
  return {
    ...rest,
    ...(from ? { date_from: from } : {}),
    ...(to ? { date_to: to } : {}),
  } as A;
}

/** Throws a message the model can act on when a write date looks invented */
export function checkWriteDate(
  name: string,
  args: Record<string, unknown>,
): void {
  const field = WRITE_DATE_FIELD[name];
  const value = field ? args[field] : null;
  if (value == null || value === "") return;
  if (!isRealDate(value)) {
    throw new Error(`${field} must be a real date in YYYY-MM-DD form.`);
  }
  const today = localDateStr();
  const days = dayOffset(value, today);
  if (Math.abs(days) > WRITE_WINDOW_DAYS && args.date_confirmed !== true) {
    const when = days < 0 ? `${-days} days ago` : `${days} days from now`;
    throw new Error(
      `${value} is ${when} (today is ${today}). Do not guess dates or years. ` +
        "Ask the user to confirm this exact date, then call again with date_confirmed: true.",
    );
  }
}

export function isEmptyResult(result: unknown): boolean {
  if (result == null) return true;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === "object") {
    const { count, series } = result as { count?: unknown; series?: unknown };
    if (typeof count === "number") return count === 0;
    if (Array.isArray(series)) return series.length === 0;
  }
  return false;
}
