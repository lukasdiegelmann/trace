/** Water amounts: stored in ml, shown in the `waterUnit` setting (Diary/Goals) */

export type WaterUnit = "ml" | "oz" | "L" | "G";

const ML_PER: Record<WaterUnit, number> = {
  ml: 1,
  oz: 29.5735,
  L: 1000,
  G: 3785.41,
};

const DECIMALS: Record<WaterUnit, number> = { ml: 0, oz: 1, L: 2, G: 3 };

export function mlToDisplay(ml: number, unit: WaterUnit): number {
  const factor = 10 ** DECIMALS[unit];
  return Math.round((ml / ML_PER[unit]) * factor) / factor;
}

export function displayToMl(value: number, unit: WaterUnit): number {
  return Math.round(value * ML_PER[unit]);
}

/** Display unit label, `fl oz` for oz as upstream shows it */
export function waterUnitLabel(unit: WaterUnit): string {
  return unit === "oz" ? "fl oz" : unit === "G" ? "gal" : unit;
}
