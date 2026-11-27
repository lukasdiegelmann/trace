import type { ParseKeys, TFunction } from "i18next";

import type { MapMuscle } from "../lib/statisticsMuscles";

/** "upper-back" → statistics.mapMuscles.upperBack */
export function mapMuscleLabel(
  t: TFunction<"training">,
  muscle: MapMuscle,
): string {
  const key = muscle.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  return t(`statistics.mapMuscles.${key}` as ParseKeys<"training">);
}

/** The map's five shades, untrained to hardest-worked */
export const LEVEL_CLASS_NAMES = [
  "fill-fg/10",
  "fill-accent/30",
  "fill-accent/50",
  "fill-accent/75",
  "fill-accent",
] as const;
