/**
 * Body stats of a day: the measurements, their units and the date line,
 * ported from LiftTrace `components/diary/BodyStats.svelte` and
 * `BodyStatsWidget.svelte`.
 */

export type BodyStatId =
  | "weight"
  | "bodyFat"
  | "neck"
  | "chest"
  | "waist"
  | "hips"
  | "biceps"
  | "thighs"
  | "calves";

/** The measurements as stored: numbers, or what an old client wrote */
export type BodyStatValues = Partial<
  Record<string, number | string | null | undefined>
>;

/** The sheet's fields, in its order */
export const ALL_BODY_STATS: readonly BodyStatId[] = [
  "weight",
  "bodyFat",
  "neck",
  "chest",
  "waist",
  "hips",
  "biceps",
  "thighs",
  "calves",
];

/** The widget's measurement rows, in its order (weight has its own row) */
export const WIDGET_MEASUREMENTS: readonly BodyStatId[] = [
  "bodyFat",
  "waist",
  "hips",
  "chest",
  "neck",
  "thighs",
  "biceps",
  "calves",
];

/**
 * The measurements out of GET /body-stats/:date. It answers
 * `{ stats: row | null }` and the row carries them one level deeper, at
 * `row.stats` (LiftTrace issue #80); a flat answer still works.
 */
export function parseBodyStatsResponse(data: unknown): BodyStatValues {
  if (!data || typeof data !== "object") return {};
  let raw: unknown = (data as { stats?: unknown }).stats;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object") return {};
  const inner = (raw as { stats?: unknown }).stats;
  let stats: unknown = inner ?? raw;
  if (typeof stats === "string") {
    try {
      stats = JSON.parse(stats);
    } catch {
      return {};
    }
  }
  return stats && typeof stats === "object" ? stats : {};
}

/** The ids of `order` the user tracks (setting `bodyStatsVisible`) */
export function visibleBodyStats(
  visible: readonly string[] | null | undefined,
  order: readonly BodyStatId[] = ALL_BODY_STATS,
): BodyStatId[] {
  const set = new Set(visible ?? []);
  return order.filter((id) => set.has(id));
}

/** cm for a kg user, inches otherwise (the values are never converted) */
export function lengthUnit(weightUnit: string): "cm" | "in" {
  return weightUnit === "kg" ? "cm" : "in";
}

export function bodyStatUnit(id: BodyStatId, weightUnit: string): string {
  if (id === "weight") return weightUnit || "lbs";
  if (id === "bodyFat") return "%";
  return lengthUnit(weightUnit);
}

export function hasBodyStatValue(value: unknown): boolean {
  return value != null && value !== "";
}

/** The widget's rows: tracked, measured, in the widget's order */
export function widgetMeasurementRows(
  stats: BodyStatValues,
  visible: readonly string[] | null | undefined,
): { id: BodyStatId; value: number | string }[] {
  return visibleBodyStats(visible, WIDGET_MEASUREMENTS).flatMap((id) => {
    const value = stats[id];
    return value != null && value !== "" ? [{ id, value }] : [];
  });
}

/**
 * A YYYY-MM-DD date in the user's format (setting `dateFormat`): EU
 * dd/mm/yyyy, ISO as is, US (and anything else) mm/dd/yyyy
 */
export function formatBodyStatsDate(date: string, dateFormat: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || dateFormat === "ISO") return date;
  const [, y, m, d] = match;
  return dateFormat === "EU" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}

/** A stored value as the text of a field */
export function bodyStatToInput(value: unknown): string {
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
}

/**
 * The stats the sheet saves: the loaded ones with the fields the user
 * touched over them. A cleared field is sent as null, which the backend
 * takes as a deliberate clear; untouched keys keep their stored value.
 */
export function mergeBodyStatsDrafts(
  stats: BodyStatValues,
  drafts: Partial<Record<string, string>>,
): BodyStatValues {
  const next: BodyStatValues = { ...stats };
  for (const [id, text] of Object.entries(drafts)) {
    if (text === undefined) continue;
    const trimmed = text.trim();
    if (trimmed === "") {
      next[id] = null;
      continue;
    }
    const value = Number(trimmed);
    next[id] = Number.isFinite(value) ? value : null;
  }
  return next;
}

/**
 * The weight typed into the widget, or null when it isn't a positive
 * number (the widget then just closes the field, as before)
 */
export function parseWeightInput(text: string): number | null {
  const value = parseFloat(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}
