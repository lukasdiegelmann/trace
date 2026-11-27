/**
 * "Similar exercises", after backends/lifttrace/src/lib/exerciseSimilarity.js:
 * shared primary muscles weigh 3, crossing secondary ones 1, and different
 * equipment costs 1. At least one primary muscle must match.
 */

export interface ComparableExercise {
  id: number;
  name: string;
  primary_muscles?: string[] | null;
  secondary_muscles?: string[] | null;
  equipment?: string[] | null;
}

function lower(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.toLowerCase());
}

export function findSimilarExercises<T extends ComparableExercise>(
  source: ComparableExercise,
  library: T[],
  limit = 8,
): T[] {
  const primary = new Set(lower(source.primary_muscles));
  const secondary = new Set(lower(source.secondary_muscles));
  const equipment = new Set(lower(source.equipment));
  if (primary.size === 0) return [];

  const scored: { exercise: T; score: number; primaryOverlap: number }[] = [];
  for (const other of library) {
    if (other.id === source.id) continue;
    const otherPrimary = lower(other.primary_muscles);
    const primaryOverlap = otherPrimary.filter((m) => primary.has(m)).length;
    if (primaryOverlap === 0) continue;
    const secondaryOverlap =
      otherPrimary.filter((m) => secondary.has(m)).length +
      lower(other.secondary_muscles).filter((m) => primary.has(m)).length;
    const otherEquipment = lower(other.equipment);
    const isOtherKit =
      equipment.size > 0 &&
      otherEquipment.length > 0 &&
      !otherEquipment.some((e) => equipment.has(e));
    scored.push({
      exercise: other,
      score: primaryOverlap * 3 + secondaryOverlap - (isOtherKit ? 1 : 0),
      primaryOverlap,
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.primaryOverlap - a.primaryOverlap ||
      a.exercise.name.localeCompare(b.exercise.name),
  );
  return scored.slice(0, limit).map((entry) => entry.exercise);
}
