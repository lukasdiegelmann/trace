/**
 * Bulk food import: the parsers of NutriTrace's src/lib/food-import-parse.js
 * and the templates of food-import-template.js.
 */
import { NUTRIMENTS } from "./nutrimentCatalog";

export const FIXED_COLUMNS = [
  "name",
  "brand",
  "barcode",
  "portion",
  "unit",
  "category",
];

/** What POST /api/data/import takes per food */
export interface ImportedFood {
  name: string;
  brand: string | null;
  barcode: string | null;
  portion: number;
  unit: string;
  category: string | null;
  nutrition: Record<string, number>;
}

export type FoodRowError =
  | "invalidJson"
  | "notAList"
  | "notAnObject"
  | "missingName"
  | "missingCalories"
  | "csvTooShort"
  | "csvHeader";

export interface FoodParseError {
  row: number;
  code: FoodRowError;
  detail?: string;
}

export interface FoodParse {
  valid: ImportedFood[];
  errors: FoodParseError[];
}

type Raw = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function addRow(out: FoodParse, raw: Raw, row: number): void {
  const name = toText(raw.name);
  if (!name) {
    out.errors.push({ row, code: "missingName" });
    return;
  }
  const nested = (raw.nutrition ?? {}) as Raw;
  const calories = toNumber(nested.calories ?? raw.calories);
  if (calories === null) {
    out.errors.push({ row, code: "missingCalories" });
    return;
  }
  const nutrition: Record<string, number> = { calories };
  for (const { id } of NUTRIMENTS) {
    if (id === "calories") continue;
    const value = toNumber(nested[id] ?? raw[id]);
    if (value !== null) nutrition[id] = value;
  }
  out.valid.push({
    name,
    brand: toText(raw.brand) || null,
    barcode: toText(raw.barcode) || null,
    portion: toNumber(raw.portion) ?? 100,
    unit: toText(raw.unit) || "g",
    category: toText(raw.category) || null,
    nutrition,
  });
}

export function parseFoodJson(text: string): FoodParse {
  const out: FoodParse = { valid: [], errors: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (caught) {
    out.errors.push({
      row: 0,
      code: "invalidJson",
      detail: caught instanceof Error ? caught.message : undefined,
    });
    return out;
  }
  const foods = Array.isArray(data)
    ? (data as unknown[])
    : (data as { foods?: unknown } | null)?.foods;
  if (!Array.isArray(foods)) {
    out.errors.push({ row: 0, code: "notAList" });
    return out;
  }
  (foods as unknown[]).forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      out.errors.push({ row: index + 1, code: "notAnObject" });
    } else {
      addRow(out, raw as Raw, index + 1);
    }
  });
  return out;
}

/** One CSV row into cells; quoted cells keep commas and doubled quotes */
export function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let isQuoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (isQuoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        cell += char;
      }
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else if (char === '"') {
      isQuoted = true;
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

/** Lines of a CSV; a newline inside quotes belongs to its cell */
export function splitCsvLines(text: string): string[] {
  // Excel exports often start with a byte order mark.
  const content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines: string[] = [];
  let line = "";
  let isQuoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (isQuoted && content[i + 1] === '"') {
        line += '""';
        i++;
      } else {
        isQuoted = !isQuoted;
        line += char;
      }
    } else if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && content[i + 1] === "\n") i++;
      if (line.length || lines.length === 0) lines.push(line);
      line = "";
    } else {
      line += char;
    }
  }
  if (line.length) lines.push(line);
  return lines.filter((entry) => entry.trim().length > 0);
}

export function parseFoodCsv(text: string): FoodParse {
  const out: FoodParse = { valid: [], errors: [] };
  const [head, ...rows] = splitCsvLines(text);
  if (rows.length === 0) {
    out.errors.push({ row: 0, code: "csvTooShort" });
    return out;
  }
  const headers = splitCsvRow(head).map((cell) => cell.trim());
  if (!headers.includes("name") || !headers.includes("calories")) {
    out.errors.push({ row: 0, code: "csvHeader", detail: headers.join(", ") });
    return out;
  }
  const nutrientIds = new Set<string>(NUTRIMENTS.map((n) => n.id));
  rows.forEach((line, index) => {
    const cells = splitCsvRow(line);
    const raw: Raw = {};
    const nutrition: Raw = {};
    headers.forEach((header, column) => {
      const value = cells[column] ?? "";
      if (FIXED_COLUMNS.includes(header)) raw[header] = value;
      else if (nutrientIds.has(header)) nutrition[header] = value;
      // Unknown columns are ignored.
    });
    addRow(out, { ...raw, nutrition }, index + 2);
  });
  return out;
}

export interface Deduplicated {
  ready: ImportedFood[];
  /** Skipped: the barcode is in the library already, or earlier in the file */
  duplicates: ImportedFood[];
}

/** The old dialog's check against the library's barcodes */
export function splitDuplicates(
  foods: readonly ImportedFood[],
  existingBarcodes: Iterable<string>,
): Deduplicated {
  const seen = new Set(existingBarcodes);
  const out: Deduplicated = { ready: [], duplicates: [] };
  for (const food of foods) {
    if (food.barcode && seen.has(food.barcode)) out.duplicates.push(food);
    else {
      if (food.barcode) seen.add(food.barcode);
      out.ready.push(food);
    }
  }
  return out;
}

const EXAMPLE: Record<string, number> = {
  calories: 200,
  fat: 8,
  carbohydrates: 25,
  proteins: 5,
};

export function buildJsonTemplate(): string {
  const nutrition = Object.fromEntries(
    NUTRIMENTS.map((n) => [n.id, EXAMPLE[n.id] ?? 0]),
  );
  return JSON.stringify(
    {
      foods: [
        {
          name: "Example Food",
          brand: "Example Brand",
          barcode: "",
          portion: 100,
          unit: "g",
          category: "",
          nutrition,
        },
      ],
    },
    null,
    2,
  );
}

export function buildCsvTemplate(): string {
  const headers = [...FIXED_COLUMNS, ...NUTRIMENTS.map((n) => n.id)];
  const example = [
    "Example Food",
    "Example Brand",
    "",
    100,
    "g",
    "",
    ...NUTRIMENTS.map((n) => EXAMPLE[n.id] ?? ""),
  ];
  return `${headers.join(",")}\n${example.join(",")}\n`;
}
