/**
 * Body stats as the diary stores them, after
 * nutritrace/src/lib/body-stats-unit.js.
 */

/** The ten body stats in their default order (settings/BodyStats.svelte) */
export const BODY_STAT_KEYS = [
  "weight",
  "neck",
  "waist",
  "hips",
  "chest",
  "thighs",
  "biceps",
  "calves",
  "body_fat",
  "body_water",
] as const;

export type BodyStatKey = (typeof BODY_STAT_KEYS)[number];

export const LENGTH_KEYS: readonly string[] = [
  "neck",
  "waist",
  "hips",
  "chest",
  "thighs",
  "biceps",
  "calves",
];

export function isBodyStatKey(key: string): key is BodyStatKey {
  return (BODY_STAT_KEYS as readonly string[]).includes(key);
}

const KG_PER_LB = 1 / 2.20462;
const CM_PER_IN = 2.54;

function convertWeight(n: number, from: string, to: string): number {
  if (from === to) return n;
  if (from === "lb" && to === "kg") return Math.round(n * KG_PER_LB * 10) / 10;
  if (from === "kg" && to === "lb") return Math.round(n * 2.20462 * 10) / 10;
  return n;
}

function convertLength(n: number, from: string, to: string): number {
  if (from === to) return n;
  if (from === "in" && to === "cm") return Math.round(n * CM_PER_IN * 10) / 10;
  if (from === "cm" && to === "in")
    return Math.round((n / CM_PER_IN) * 10) / 10;
  return n;
}

export type BodyStatsRecord = Record<string, unknown>;

/**
 * One body stat in the user's current unit. Rows carry the unit they were
 * entered in (`weight_unit`, `lengths_unit`); older rows without it are
 * read as already in the current unit.
 */
export function readBodyStat(
  stats: BodyStatsRecord | null | undefined,
  metric: string,
  weightUnit: string,
  lengthUnit: string,
): number | null {
  if (!stats) return null;
  const raw = stats[metric];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (metric === "weight") {
    const stored =
      (stats.weight_unit as string | undefined) || weightUnit || "kg";
    return convertWeight(n, stored, weightUnit || "kg");
  }
  if (LENGTH_KEYS.includes(metric)) {
    const stored =
      (stats.lengths_unit as string | undefined) || lengthUnit || "in";
    return convertLength(n, stored, lengthUnit || "in");
  }
  return n;
}

/** The body stats in the user's order, unknown ids dropped, new ones appended */
export function orderBodyStats(order: readonly string[]): BodyStatKey[] {
  if (!order.length) return [...BODY_STAT_KEYS];
  const sorted = order.filter(isBodyStatKey);
  const rest = BODY_STAT_KEYS.filter((key) => !order.includes(key));
  return [...sorted, ...rest];
}
