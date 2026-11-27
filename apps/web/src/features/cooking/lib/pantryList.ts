/** The pantry list's filtering, sorting and grouping (Pantry.svelte) */
import type { PantryCategory, PantryItem } from "../pantryApi";

import { effectiveExpiry, isExpiring } from "./expiry";
import {
  aggregateStock,
  classifySearchHit,
  isItemInStock,
  matchingVariants,
  matchesSearch,
  topLevelItems,
} from "./pantryVariants";

export type StockFilter = "all" | "in" | "out" | "expiring";
export type SortKey = "name" | "updated" | "usage";

/** "all", "uncategorized" or a category slug */
export type CategoryFilter = string;

export const UNCATEGORIZED = "__uncategorized__";

export type VariantsByParent = ReadonlyMap<number, PantryItem[]>;

/** A list card: a brand-only search shows a variant on its own */
export interface PantryRow extends PantryItem {
  standaloneParent?: PantryItem;
}

/**
 * The row's category slug. The server joins an object onto `category`;
 * rows made on the client carry the slug; else resolve `category_id`.
 */
export function itemSlug(
  item: Pick<PantryItem, "category" | "category_id">,
  categories: readonly PantryCategory[],
): string | null {
  const { category } = item;
  if (typeof category === "string" && category) return category;
  if (category && typeof category === "object" && category.slug) {
    return category.slug;
  }
  if (item.category_id != null) {
    return (
      categories.find((entry) => entry.id === item.category_id)?.slug ?? null
    );
  }
  return null;
}

/** In stock as the list shows it: a generic when any variant is */
export function isShownInStock(
  item: PantryItem,
  variantsByParent: VariantsByParent,
): boolean {
  const aggregate = aggregateStock(item, variantsByParent);
  return aggregate.isGeneric ? aggregate.stocked > 0 : isItemInStock(item);
}

/** Itself or any variant is expired or expiring soon */
export function isAnyExpiring(
  item: PantryItem,
  variantsByParent: VariantsByParent,
  now: Date,
): boolean {
  return (
    isExpiring(item.expires_on, now) ||
    (variantsByParent.get(item.id) ?? []).some((variant) =>
      isExpiring(variant.expires_on, now),
    )
  );
}

export function compareByName(
  a: { name?: string | null },
  b: { name?: string | null },
): number {
  return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortRows(rows: PantryRow[], sortKey: SortKey): PantryRow[] {
  return [...rows].sort((a, b) => {
    if (sortKey === "updated") {
      const order = (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      if (order !== 0) return order;
    }
    if (sortKey === "usage") {
      const order = (b.recipe_count ?? 0) - (a.recipe_count ?? 0);
      if (order !== 0) return order;
    }
    return compareByName(a, b);
  });
}

export interface PantryQuery {
  query: string;
  stockFilter: StockFilter;
  categoryFilter: CategoryFilter;
  sortKey: SortKey;
}

/** The cards in order, filters applied to top-level rows */
export function filterPantry(
  items: readonly PantryItem[],
  variantsByParent: VariantsByParent,
  categories: readonly PantryCategory[],
  { query, stockFilter, categoryFilter, sortKey }: PantryQuery,
  now: Date = new Date(),
): PantryRow[] {
  const filtered = topLevelItems(items)
    .filter((item) => {
      if (stockFilter === "all") return true;
      if (stockFilter === "expiring") {
        return isAnyExpiring(item, variantsByParent, now);
      }
      const isInStock = isShownInStock(item, variantsByParent);
      return stockFilter === "in" ? isInStock : !isInStock;
    })
    .filter((item) => {
      if (categoryFilter === "all") return true;
      const slug = itemSlug(item, categories);
      return categoryFilter === "uncategorized"
        ? !slug
        : slug === categoryFilter;
    });
  const trimmed = query.trim();
  if (!trimmed) return sortRows(filtered, sortKey);
  const rows: PantryRow[] = [];
  for (const item of filtered) {
    const hit = classifySearchHit(item, variantsByParent, trimmed);
    if (hit === "parent" || hit === "expanded") rows.push(item);
    else if (hit === "variants") {
      for (const variant of matchingVariants(item, variantsByParent, trimmed)) {
        rows.push({ ...variant, standaloneParent: item });
      }
    }
  }
  return sortRows(rows, sortKey);
}

/** Generics a query opens: it names the parent and a variant */
export function autoExpandedIds(
  items: readonly PantryItem[],
  variantsByParent: VariantsByParent,
  query: string,
): number[] {
  if (!query.trim()) return [];
  return topLevelItems(items)
    .filter(
      (item) => classifySearchHit(item, variantsByParent, query) === "expanded",
    )
    .map((item) => item.id);
}

/** The local rows of the "All" source */
export function localMatches(
  items: readonly PantryItem[],
  variantsByParent: VariantsByParent,
  query: string,
): PantryItem[] {
  if (!query.trim()) return [];
  return topLevelItems(items).filter((item) =>
    matchesSearch(item, variantsByParent, query),
  );
}

export interface PantrySection {
  /** A category slug, UNCATEGORIZED or "*" (flat) */
  key: string;
  /** Null: flat list, or the "Uncategorized" bucket (by key) */
  category: PantryCategory | null;
  rows: PantryRow[];
}

/**
 * Grouped by category only for A→Z with no filter or search. Slugs that no
 * category knows land under Uncategorized so nothing disappears (#41).
 */
export function groupPantry(
  rows: PantryRow[],
  categories: readonly PantryCategory[],
  { query, categoryFilter, sortKey }: PantryQuery,
): PantrySection[] {
  if (sortKey !== "name" || categoryFilter !== "all" || query.trim()) {
    return [{ key: "*", category: null, rows }];
  }
  const buckets = new Map<string, PantryRow[]>();
  for (const row of rows) {
    const slug = itemSlug(row, categories) ?? UNCATEGORIZED;
    const bucket = buckets.get(slug);
    if (bucket) bucket.push(row);
    else buckets.set(slug, [row]);
  }
  const sections: PantrySection[] = [];
  for (const category of categories) {
    const bucket = buckets.get(category.slug);
    if (!bucket) continue;
    sections.push({ key: category.slug, category, rows: bucket });
    buckets.delete(category.slug);
  }
  const rest = [...buckets.values()].flat();
  if (rest.length > 0) {
    sections.push({ key: UNCATEGORIZED, category: null, rows: rest });
  }
  return sections;
}

export interface PantryCounts {
  all: number;
  inStock: number;
  out: number;
  expiring: number;
  uncategorized: number;
  /** Top-level rows per category slug */
  bySlug: Map<string, number>;
}

/** The chips' badges; variants don't count on their own */
export function countPantry(
  items: readonly PantryItem[],
  variantsByParent: VariantsByParent,
  categories: readonly PantryCategory[],
  now: Date = new Date(),
): PantryCounts {
  const top = topLevelItems(items);
  const bySlug = new Map<string, number>(
    categories.map((category) => [category.slug, 0]),
  );
  let uncategorized = 0;
  for (const item of top) {
    const slug = itemSlug(item, categories);
    if (!slug) uncategorized++;
    else {
      const count = bySlug.get(slug);
      if (count !== undefined) bySlug.set(slug, count + 1);
    }
  }
  const inStock = top.filter((item) =>
    isShownInStock(item, variantsByParent),
  ).length;
  return {
    all: top.length,
    inStock,
    out: top.length - inStock,
    expiring: top.filter((item) => isAnyExpiring(item, variantsByParent, now))
      .length,
    uncategorized,
    bySlug,
  };
}

export const SPOTLIGHT_SIZE = 8;

/** "Expiring & Expired": the most urgent first */
export function expiringSpotlight(
  items: readonly PantryItem[],
  variantsByParent: VariantsByParent,
  now: Date = new Date(),
): { item: PantryItem; date: string }[] {
  const entries: { item: PantryItem; date: string }[] = [];
  for (const item of topLevelItems(items)) {
    const date = effectiveExpiry(
      item,
      variantsByParent.get(item.id) ?? [],
      now,
    );
    if (date && isExpiring(date, now)) entries.push({ item, date });
  }
  return entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, SPOTLIGHT_SIZE);
}
