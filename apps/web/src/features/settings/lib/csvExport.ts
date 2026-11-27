/** The CSV exports of NutriTrace's SettingsImportExport.svelte */
import { NUTRIMENTS } from "./nutrimentCatalog";
import type { CustomNutriment } from "./nutrientSettings";
import { calculateNutrition, type DiaryItem } from "./nutritionCalc";

export interface DiaryDay {
  date: string;
  items?: DiaryItem[] | null;
}

export interface ActivityRow {
  date: string;
  name?: string | null;
  kcal?: number | string | null;
  duration_min?: number | null;
  distance?: number | string | null;
  source?: string | null;
  met?: number | string | null;
  is_template?: number | boolean | null;
}

export function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

/** The short diary export (the old one didn't escape quotes in names) */
export function diaryCsv(diary: readonly DiaryDay[]): string {
  const lines = ["Date,Meal,Food,Amount,Unit,Calories,Fat,Carbs,Protein"];
  for (const day of diary) {
    for (const item of day.items ?? []) {
      const n = calculateNutrition(item);
      lines.push(
        csvLine([
          day.date,
          item.meal ?? 0,
          item.name ?? "",
          item.portion ?? 100,
          item.unit ?? "g",
          Math.round(n.calories ?? 0),
          (n.fat ?? 0).toFixed(1),
          (n.carbohydrates ?? 0).toFixed(1),
          (n.proteins ?? 0).toFixed(1),
        ]),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Every nutrient, one row per item; an absent value stays empty, not zero */
export function fullNutritionCsv(
  diary: readonly DiaryDay[],
  mealNames: readonly string[],
  custom: readonly CustomNutriment[],
  labelOf: (id: string) => string,
): string {
  const columns = [
    ...NUTRIMENTS.map((n) => ({
      id: n.id,
      header: `${labelOf(n.id)} (${n.unit})`,
    })),
    ...custom.map((n) => ({
      id: n.id,
      header: n.unit ? `${n.label} (${n.unit})` : n.label,
    })),
  ];
  const lines = [
    csvLine([
      "Date",
      "Time",
      "Meal",
      "Food",
      "Brand",
      "Amount",
      "Unit",
      ...columns.map((column) => column.header),
    ]),
  ];
  for (const day of diary) {
    for (const item of day.items ?? []) {
      const n = calculateNutrition(item);
      const meal = Number(item.meal) || 0;
      lines.push(
        csvLine([
          day.date,
          item.addedAt ?? "",
          mealNames[meal] ?? `Meal ${meal + 1}`,
          item.name ?? "",
          item.brand ?? "",
          item.portion ?? 100,
          item.unit ?? "g",
          ...columns.map(({ id }) => {
            const value = n[id];
            return value === undefined || Number.isNaN(value)
              ? ""
              : value.toFixed(2).replace(/\.?0+$/, "");
          }),
        ]),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export function activityCsv(rows: readonly ActivityRow[]): string {
  const lines = [
    "Date,Name,Calories,DurationMin,Distance,Source,MET,IsTemplate",
  ];
  for (const row of rows) {
    lines.push(
      csvLine([
        row.date,
        row.name,
        Math.max(0, Math.round(Number(row.kcal) || 0)),
        row.duration_min ?? "",
        row.distance,
        row.source || "manual_form",
        row.met != null ? Number(row.met).toFixed(1) : "",
        row.is_template ? 1 : 0,
      ]),
    );
  }
  return `${lines.join("\n")}\n`;
}
