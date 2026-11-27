/** Minutes as "45m", "2h" or "2h 15m" (cooktrace/src/lib/duration.js) */
export function formatDuration(minutes: unknown): string {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return "";
  const total = Math.round(value);
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export interface RecipeTimes {
  total_minutes?: number | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  rest_minutes?: number | null;
}

/** The typed total, else prep + cook + rest */
export function totalMinutes(recipe: RecipeTimes): number {
  return (
    recipe.total_minutes ??
    (recipe.prep_minutes ?? 0) +
      (recipe.cook_minutes ?? 0) +
      (recipe.rest_minutes ?? 0)
  );
}
