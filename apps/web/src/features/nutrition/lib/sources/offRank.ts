/**
 * Ordering and completeness tiers of Open Food Facts search results, ported
 * from nutritrace/src/lib/off-rank.js and Foods.svelte (`_bucketOff`).
 * OFF's order holds between clearly different scores; within 10 % of a
 * group's best, photo, completeness and Nutri-Score decide (#213). The local
 * mirror sends no scores and has few photos, so no photo tier there (#192).
 */
export const OFF_RELEVANCE_BAND = 0.9;

export interface Rankable {
  imgUrl?: string;
  completeness?: number | null;
  nutriscore?: string | null;
}

/** The score stays beside the food, so it never gets saved with it */
export interface RankEntry<T extends Rankable> {
  food: T;
  score?: number;
}

export function hasNutriScore(food: Rankable | null | undefined): boolean {
  const grade = food?.nutriscore;
  return !!grade && grade !== "unknown" && grade !== "not-applicable";
}

function compareQuality(
  a: Rankable,
  b: Rankable,
  shouldPreferPhotos: boolean,
): number {
  if (shouldPreferPhotos) {
    const photo = (b.imgUrl ? 1 : 0) - (a.imgUrl ? 1 : 0);
    if (photo) return photo;
  }
  return (
    (b.completeness ?? 0) - (a.completeness ?? 0) ||
    (hasNutriScore(b) ? 1 : 0) - (hasNutriScore(a) ? 1 : 0)
  );
}

export function rankOffResults<T extends Rankable>(
  entries: readonly RankEntry<T>[],
  options: { isFromMirror?: boolean } = {},
): T[] {
  const isScored = entries.every(
    (entry) => typeof entry.score === "number" && Number.isFinite(entry.score),
  );
  if (!isScored) {
    return [...entries]
      .sort((a, b) =>
        compareQuality(a.food, b.food, !(options.isFromMirror ?? false)),
      )
      .map((entry) => entry.food);
  }
  // Already best first; the stable sort only guards the grouping
  const byScore = [...entries].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const out: T[] = [];
  let group: T[] = [];
  let top: number | null = null;
  const flush = () => {
    out.push(...group.sort((a, b) => compareQuality(a, b, true)));
    group = [];
  };
  for (const entry of byScore) {
    const score = entry.score ?? 0;
    if (top === null || score < top * OFF_RELEVANCE_BAND) {
      flush();
      top = score;
    }
    group.push(entry.food);
  }
  flush();
  return out;
}

export type OffTier = "high" | "medium" | "low" | "unknown";

export const OFF_TIERS: readonly OffTier[] = [
  "high",
  "medium",
  "low",
  "unknown",
];

export function offCompletenessTier(completeness: unknown): OffTier {
  if (typeof completeness !== "number") return "unknown";
  if (completeness >= 0.7) return "high";
  if (completeness >= 0.4) return "medium";
  return "low";
}

export function filterByOffTier<T extends Rankable>(
  foods: readonly T[],
  active: ReadonlySet<OffTier>,
): T[] {
  return foods.filter((food) =>
    active.has(offCompletenessTier(food.completeness)),
  );
}
