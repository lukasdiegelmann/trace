/**
 * The measurements LiftTrace stores. Its server drops any other key
 * (`mergeStatsObject`), so what a model calls them is mapped to these.
 */
import { ALL_BODY_STATS, type BodyStatId } from "../lib/bodyStats";

const SINGULAR: Partial<Record<string, BodyStatId>> = {
  bicep: "biceps",
  thigh: "thighs",
  calf: "calves",
  hip: "hips",
};

/** "body_fat" is `bodyFat`; null for what LiftTrace can't store */
export function bodyStatKey(name: string): BodyStatId | null {
  const plain = name.toLowerCase().replace(/[^a-z]/g, "");
  return (
    ALL_BODY_STATS.find((id) => id.toLowerCase() === plain) ??
    SINGULAR[plain] ??
    null
  );
}
