/** Ported from NutriTrace's routes/settings/Water.svelte */
export const WATER_UNITS = ["ml", "oz", "L", "G"] as const;
export type WaterUnit = (typeof WATER_UNITS)[number];

export const ML_PER_UNIT: Record<WaterUnit, number> = {
  ml: 1,
  oz: 29.5735,
  L: 1000,
  G: 3785.41,
};

const DECIMALS: Record<WaterUnit, number> = { ml: 0, oz: 1, L: 2, G: 3 };

export interface WaterContainer {
  id: string;
  name: string;
  volumeMl: number;
}

export function isWaterUnit(value: unknown): value is WaterUnit {
  return WATER_UNITS.includes(value as WaterUnit);
}

export function toMl(volume: number, unit: WaterUnit): number {
  return Math.round(volume * ML_PER_UNIT[unit]);
}

export function fromMl(ml: number, unit: WaterUnit): number {
  const factor = 10 ** DECIMALS[unit];
  return Math.round((ml / ML_PER_UNIT[unit]) * factor) / factor;
}

/** A new container, or null while the name or the volume is missing */
export function newContainer(
  name: string,
  volume: number | null,
  unit: WaterUnit,
  now: number = Date.now(),
): WaterContainer | null {
  const trimmed = name.trim();
  if (!trimmed || volume === null || !(volume > 0)) return null;
  return { id: String(now), name: trimmed, volumeMl: toMl(volume, unit) };
}
