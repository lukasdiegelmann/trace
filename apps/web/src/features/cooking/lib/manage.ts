/** The Manage hub's filtering, sorting and reordering */
import type { TaxonomyEntry } from "../manageApi";

import { includesFolded } from "./searchText";
import { BUILTIN_UNIT_ABBRS, type CustomUnit, type Unit } from "./units";

export const MANAGE_SECTIONS = [
  "recipe-categories",
  "tags",
  "kitchen-gear",
  "pantry-categories",
  "units",
  "cookbooks",
] as const;

export type ManageSection = (typeof MANAGE_SECTIONS)[number];

export function asManageSection(value: string | undefined): ManageSection {
  return (
    MANAGE_SECTIONS.find((section) => section === value) ?? "recipe-categories"
  );
}

export function filterByName<T extends { name: string }>(
  items: readonly T[],
  query: string,
): T[] {
  return items.filter((item) => includesFolded(item.name, query));
}

export type TaxonomySort = "name" | "most" | "least";

export function asTaxonomySort(value: string | null): TaxonomySort {
  return value === "most" || value === "least" ? value : "name";
}

export function taxonomyView(
  items: readonly TaxonomyEntry[],
  query: string,
  sort: TaxonomySort,
  isUnusedOnly: boolean,
): TaxonomyEntry[] {
  const direction = sort === "most" ? -1 : sort === "least" ? 1 : 0;
  return filterByName(
    items.filter((item) => !isUnusedOnly || item.count === 0),
    query,
  ).sort(
    (a, b) => direction * (a.count - b.count) || a.name.localeCompare(b.name),
  );
}

/** The entry a rename would merge into, if any */
export function mergeTarget(
  items: readonly TaxonomyEntry[],
  name: string,
  next: string,
): TaxonomyEntry | null {
  return (
    items.find(
      (item) =>
        item.name !== name &&
        item.name.toLowerCase() === next.trim().toLowerCase(),
    ) ?? null
  );
}

/** The list with one item moved a step, or null at an edge */
export function moveItem<T>(
  items: readonly T[],
  index: number,
  delta: -1 | 1,
): T[] | null {
  const next = [...items];
  const item = next[index];
  const other = next[index + delta];
  if (item === undefined || other === undefined) return null;
  next[index] = other;
  next[index + delta] = item;
  return next;
}

/** Units matching the abbreviation or the full name */
export function matchesUnit(unit: Unit, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return (
    !needle ||
    unit.abbr.toLowerCase().includes(needle) ||
    unit.full.toLowerCase().includes(needle)
  );
}

export function customAsUnit(unit: CustomUnit): Unit {
  return { abbr: unit.abbr, full: unit.full_name ?? unit.abbr };
}

/** Why a new custom abbreviation can't be added */
export function customUnitProblem(
  abbr: string,
  custom: readonly CustomUnit[],
): "builtin" | "duplicate" | null {
  const trimmed = abbr.trim();
  if (BUILTIN_UNIT_ABBRS.has(trimmed)) return "builtin";
  return custom.some(
    (unit) => unit.abbr.toLowerCase() === trimmed.toLowerCase(),
  )
    ? "duplicate"
    : null;
}

/** The old UI's swatches. Stored data (recipe category colours), not styling */
export const CATEGORY_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#d97706",
] as const;
