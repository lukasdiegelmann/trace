/** A workout's GPS route as charts (the map of Wellness.svelte, for now) */
import { heartRateZone, type HeartRateZone } from "./wellness";

export type { HeartRateZone };

export const HEART_RATE_ZONES: readonly HeartRateZone[] = [
  "easy",
  "moderate",
  "hard",
  "peak",
];

/** At most `limit` items, evenly picked, the first and last kept */
export function downsample<T>(list: readonly T[], limit: number): T[] {
  if (list.length <= limit) return [...list];
  const step = (list.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => list[Math.round(i * step)]);
}

/**
 * How much of the route each heart-rate zone took, by track points, in %;
 * null when the route has no heart rate.
 */
export function heartRateShares(
  points: readonly { hr: number | null }[],
): { zone: HeartRateZone; pct: number }[] | null {
  const zones = points.flatMap((p) => (p.hr ? [heartRateZone(p.hr)] : []));
  if (!zones.length) return null;
  return HEART_RATE_ZONES.map((zone) => ({
    zone,
    pct: (zones.filter((z) => z === zone).length / zones.length) * 100,
  })).filter((share) => share.pct > 0);
}
