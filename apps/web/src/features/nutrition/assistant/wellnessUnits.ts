/**
 * Wellness values in the user's units before the model sees them
 * (Trace.svelte `_convertWellnessUnits`). Withings sends `{ value }` per
 * metric where the other sources send numbers; both are converted (the old UI
 * turned Withings' into NaN).
 */

export interface WellnessUnits {
  distUnit: string;
  weightUnit: string;
  tempUnit: string;
}

const LB_PER_KG = 2.20462;

/** [metric in kg, its name in lb, decimals] */
const WEIGHTS: [string, string, number][] = [
  ["weight_kg", "weight_lb", 1],
  ["muscle_mass_kg", "muscle_mass_lb", 1],
  ["bone_mass_kg", "bone_mass_lb", 2],
  ["lean_mass_kg", "lean_mass_lb", 1],
  ["fat_mass_kg", "fat_mass_lb", 1],
];

function round(value: number, decimals: number): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

function mapValue(entry: unknown, change: (value: number) => number): unknown {
  if (typeof entry === "number") return change(entry);
  const wrapped = entry as { value?: unknown } | null;
  return typeof wrapped?.value === "number"
    ? { ...wrapped, value: change(wrapped.value) }
    : entry;
}

/** `from` renamed to `to` with its value changed; unchanged without it */
function convert(
  metrics: Record<string, unknown>,
  from: string,
  to: string,
  change: (value: number) => number,
): Record<string, unknown> {
  if (metrics[from] == null) return metrics;
  const { [from]: entry, ...rest } = metrics;
  return { ...rest, [to]: mapValue(entry, change) };
}

export function milesOf(km: number): number {
  return round(km * 0.621371, 2);
}

/** `{ date: { metric: value } }` with distances, weights and temperature converted */
export function convertWellnessUnits(
  data: Partial<Record<string, object>>,
  units: WellnessUnits,
): Record<string, Record<string, unknown>> {
  const converted: Record<string, Record<string, unknown>> = {};
  for (const [date, values] of Object.entries(data)) {
    let metrics: Record<string, unknown> = { ...values };
    if (units.distUnit === "mi") {
      metrics = convert(metrics, "distance_km", "distance_mi", milesOf);
    }
    if (units.weightUnit === "lb") {
      for (const [from, to, decimals] of WEIGHTS) {
        metrics = convert(metrics, from, to, (kg) =>
          round(kg * LB_PER_KG, decimals),
        );
      }
    }
    if (units.tempUnit === "F" && metrics.skin_temp_variation != null) {
      // A difference: no 32° offset
      metrics.skin_temp_variation = mapValue(
        metrics.skin_temp_variation,
        (celsius) => round((celsius * 9) / 5, 2),
      );
    }
    converted[date] = metrics;
  }
  return converted;
}
