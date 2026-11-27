/**
 * The pantry variant hierarchy, ported from
 * cooktrace/src/lib/pantry-variants.js. A pantry row is one of three things,
 * by its nullable `generic_parent_id`:
 *   - flat:    no parent, and no row points at it
 *   - generic: other rows point at it (its own parent is always null)
 *   - variant: its `generic_parent_id` is a generic's id
 */
import { foldText } from "./searchText";

/** The fields of a pantry row these helpers read */
export interface VariantRow {
  id: number;
  name?: string | null;
  brand?: string | null;
  generic_parent_id?: number | null;
  in_stock?: number | boolean | string | null;
  quantity?: number | string | null;
}

export interface DisplayVariantNameOptions {
  /** The parent's name is already on screen (variant listed under it) */
  isNested?: boolean;
}

/**
 * The variant's name in context. Nested: just the distinguishing brand.
 * Out of context: "Parent (Brand)". A name override wins in both.
 */
export function displayVariantName(
  variant: Pick<VariantRow, "name" | "brand"> | null | undefined,
  parent: Pick<VariantRow, "name"> | null | undefined,
  { isNested = false }: DisplayVariantNameOptions = {},
): string {
  if (!variant) return "";
  const parentName = parent?.name ?? "";
  const hasOverride =
    Boolean(parentName) && Boolean(variant.name) && variant.name !== parentName;
  if (hasOverride) {
    return variant.brand
      ? `${variant.name ?? ""} (${variant.brand})`
      : (variant.name ?? "");
  }
  if (isNested) return variant.brand || variant.name || "Variant";
  if (parentName && variant.brand) return `${parentName} (${variant.brand})`;
  return variant.name || parentName || "Variant";
}

/** Variants by parent id, each list sorted by brand (or name) */
export function buildVariantsByParent<T extends VariantRow>(
  items: readonly T[] | null | undefined,
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  if (!items) return map;
  for (const item of items) {
    const parentId = item.generic_parent_id;
    if (parentId == null) continue;
    const list = map.get(parentId);
    if (list) list.push(item);
    else map.set(parentId, [item]);
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      (a.brand || a.name || "").localeCompare(b.brand || b.name || ""),
    );
  }
  return map;
}

/** Flat items and generics; variants surface under their parents */
export function topLevelItems<T extends VariantRow>(
  items: readonly T[] | null | undefined,
): T[] {
  if (!items) return [];
  return items.filter((item) => item.generic_parent_id == null);
}

/**
 * Is this row in stock? `in_stock` wins when present; quantity is only the
 * fallback. A blank quantity is not zero (Number(null) === 0 was issue #55).
 */
export function isItemInStock(
  item: Pick<VariantRow, "in_stock" | "quantity"> | null | undefined,
): boolean {
  if (!item) return false;
  if (item.in_stock != null && item.in_stock !== "") {
    return Boolean(Number(item.in_stock));
  }
  if (item.quantity == null || item.quantity === "") return true;
  return Number(item.quantity) > 0;
}

export interface StockAggregate {
  stocked: number;
  total: number;
  isGeneric: boolean;
}

/** Flat: 0/1 of 1. Generic: children in stock of all children */
export function aggregateStock(
  item: VariantRow | null | undefined,
  variantsByParent: ReadonlyMap<number, readonly VariantRow[]> | undefined,
): StockAggregate {
  if (!item) return { stocked: 0, total: 0, isGeneric: false };
  const children = variantsByParent?.get(item.id) ?? [];
  if (children.length === 0) {
    return { stocked: item.in_stock ? 1 : 0, total: 1, isGeneric: false };
  }
  const stocked = children.reduce(
    (count, child) => count + (child.in_stock ? 1 : 0),
    0,
  );
  return { stocked, total: children.length, isGeneric: true };
}

function tokensOf(query: string): string[] {
  return foldText(query).trim().split(/\s+/).filter(Boolean);
}
function hayOf(row: Pick<VariantRow, "name" | "brand">): string {
  return foldText(`${row.name ?? ""} ${row.brand ?? ""}`);
}
function covers(hay: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => hay.includes(token));
}

/**
 * Matches the item's own name/brand or, with the parent's words, one of its
 * variants. Every token has to hit ("greenwise whole milk").
 */
export function matchesSearch(
  item: VariantRow | null | undefined,
  variantsByParent: ReadonlyMap<number, readonly VariantRow[]> | undefined,
  query: string,
): boolean {
  const tokens = tokensOf(query);
  if (!tokens.length) return true;
  if (!item) return false;
  const parentHay = hayOf(item);
  if (covers(parentHay, tokens)) return true;
  const children = variantsByParent?.get(item.id) ?? [];
  return children.some((child) =>
    covers(`${parentHay} ${hayOf(child)}`, tokens),
  );
}

/** True when the query hit a variant, not the parent on its own */
export function queryHitVariant(
  item: VariantRow | null | undefined,
  variantsByParent: ReadonlyMap<number, readonly VariantRow[]> | undefined,
  query: string,
): boolean {
  const tokens = tokensOf(query);
  if (!tokens.length || !item) return false;
  const parentHay = hayOf(item);
  if (covers(parentHay, tokens)) return false;
  const children = variantsByParent?.get(item.id) ?? [];
  return children.some((child) =>
    covers(`${parentHay} ${hayOf(child)}`, tokens),
  );
}

/** The variants covering the tokens the parent's own words didn't */
export function matchingVariants<T extends VariantRow>(
  item: T | null | undefined,
  variantsByParent: ReadonlyMap<number, readonly T[]> | undefined,
  query: string,
): T[] {
  const tokens = tokensOf(query);
  if (!tokens.length || !item) return [];
  const parentHay = hayOf(item);
  const remaining = tokens.filter((token) => !parentHay.includes(token));
  if (!remaining.length) return [];
  const children = variantsByParent?.get(item.id) ?? [];
  return children.filter((child) => covers(hayOf(child), remaining));
}

/**
 * How a top-level item shows for a query: `parent` (its own words match),
 * `expanded` (parent and a variant), `variants` (only variant words; show
 * the variants on their own) or null (no match). Empty query: `parent`.
 */
export type SearchHit = "parent" | "expanded" | "variants" | null;

export function classifySearchHit(
  item: VariantRow | null | undefined,
  variantsByParent: ReadonlyMap<number, readonly VariantRow[]> | undefined,
  query: string,
): SearchHit {
  const tokens = tokensOf(query);
  if (!tokens.length) return "parent";
  if (!item) return null;
  const parentHay = hayOf(item);
  if (covers(parentHay, tokens)) return "parent";
  const children = variantsByParent?.get(item.id) ?? [];
  const isCoveredByChild = children.some((child) =>
    covers(hayOf(child), tokens),
  );
  const isParentTouched = tokens.some((token) => parentHay.includes(token));
  if (isCoveredByChild && !isParentTouched) return "variants";
  const isCoveredWithParent = children.some((child) =>
    covers(`${parentHay} ${hayOf(child)}`, tokens),
  );
  return isCoveredWithParent ? "expanded" : null;
}

/**
 * The quick stock toggle's next state (Pantry.svelte quickToggle): marking
 * out sets 0; marking in keeps a positive quantity, else 1.
 */
export function nextStockToggle(
  item: Pick<VariantRow, "in_stock" | "quantity">,
): { quantity: number; in_stock: 0 | 1 } {
  const isNextInStock = !isItemInStock(item);
  const current = Number(item.quantity);
  const quantity = isNextInStock ? (current > 0 ? current : 1) : 0;
  return { quantity, in_stock: isNextInStock ? 1 : 0 };
}
