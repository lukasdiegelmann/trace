/**
 * The pantry item form: PantryItemSheet.svelte's draft and payload, with
 * the fields PantryEditor.svelte adds (unit, density).
 */
import type { PantryItem, PantryPatch } from "../pantryApi";

import type { ExternalFood } from "./externalFoods";
import {
  deriveSodiumSalt,
  hasNutritionValues,
  scaleNutrition,
  type Nutrition,
} from "./nutriments";
import { foldText } from "./searchText";

export interface PantryDraft {
  name: string;
  brand: string;
  barcode: string;
  quantity: string;
  unit: string;
  serving_size: string;
  serving_unit: string;
  serving_label: string | null;
  g_per_cup: string;
  notes: string;
  img_url: string;
  category: string;
  category_id: number | null;
  expires_on: string;
  nutrition: Nutrition;
}

export function blankDraft(): PantryDraft {
  return {
    name: "",
    brand: "",
    barcode: "",
    quantity: "",
    unit: "",
    serving_size: "",
    serving_unit: "g",
    serving_label: null,
    g_per_cup: "",
    notes: "",
    img_url: "",
    category: "",
    category_id: null,
    expires_on: "",
    nutrition: {},
  };
}

const asInput = (value: number | null | undefined) =>
  value == null ? "" : String(value);

export function draftFromItem(item: PantryItem): PantryDraft {
  const { category } = item;
  return {
    name: item.name,
    brand: item.brand ?? "",
    barcode: item.barcode ?? "",
    quantity: asInput(item.quantity),
    unit: item.unit ?? "",
    serving_size: asInput(item.serving_size),
    serving_unit: item.serving_unit ?? "g",
    serving_label: item.serving_label,
    g_per_cup: asInput(item.g_per_cup),
    notes: item.notes ?? "",
    img_url: item.img_url ?? "",
    category: typeof category === "string" ? category : (category?.slug ?? ""),
    category_id: item.category_id,
    expires_on: item.expires_on ?? "",
    nutrition: { ...(item.nutrition ?? {}) },
  };
}

/** A new item from a search result or a bare barcode */
export function draftFromPrefill(
  prefill: Partial<ExternalFood> | null | undefined,
): PantryDraft {
  const blank = blankDraft();
  if (!prefill) return blank;
  return {
    ...blank,
    name: prefill.name ?? "",
    brand: prefill.brand ?? "",
    barcode: prefill.barcode ?? "",
    serving_size: asInput(prefill.serving_size),
    serving_unit: prefill.serving_unit || "g",
    img_url: prefill.img_url ?? "",
    nutrition: { ...(prefill.nutrition ?? {}) },
  };
}

function asNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

/** In stock follows the quantity: 0 is out, blank or more is in */
export function payloadFromDraft(draft: PantryDraft): PantryPatch {
  const quantity = asNumber(draft.quantity);
  return {
    name: draft.name.trim(),
    brand: draft.brand.trim() || null,
    barcode: draft.barcode.trim() || null,
    in_stock: quantity === 0 ? 0 : 1,
    quantity,
    unit: draft.unit.trim() || null,
    notes: draft.notes.trim() || null,
    img_url: draft.img_url || null,
    category: draft.category || null,
    category_id: draft.category_id,
    serving_size: asNumber(draft.serving_size),
    serving_unit: draft.serving_unit.trim() || null,
    serving_label: draft.serving_label?.trim() || null,
    g_per_cup: asNumber(draft.g_per_cup),
    nutrition: Object.keys(draft.nutrition).length ? draft.nutrition : null,
    expires_on: draft.expires_on || null,
  };
}

export interface ServingChange {
  draft: PantryDraft;
  /** The last usable serving size, the base of the next ratio */
  base: number | null;
}

/**
 * Typing the serving size. Linked, every nutrient scales by new/old; a
 * half-typed or zero value keeps the old base.
 */
export function changeServingSize(
  draft: PantryDraft,
  value: string,
  isLinked: boolean,
  base: number | null,
): ServingChange {
  const next = asNumber(value);
  const updated = { ...draft, serving_size: value };
  if (!isLinked || base === null) return { draft: updated, base: next || null };
  if (next === null || next <= 0 || base <= 0) {
    return { draft: updated, base: next || base };
  }
  if (next === base) return { draft: updated, base: next };
  return {
    draft: {
      ...updated,
      nutrition: scaleNutrition(draft.nutrition, next / base),
    },
    base: next,
  };
}

/**
 * "Refresh from OFF": fills a blank name, brand and photo; serving and
 * nutrition come from OFF.
 */
export function mergeOffProduct(
  draft: PantryDraft,
  product: ExternalFood,
): PantryDraft {
  return {
    ...draft,
    name: draft.name || product.name,
    brand: draft.brand || (product.brand ?? ""),
    serving_size:
      product.serving_size == null
        ? draft.serving_size
        : String(product.serving_size),
    serving_unit: product.serving_unit || draft.serving_unit,
    nutrition: deriveSodiumSalt<Nutrition>({
      ...draft.nutrition,
      ...(product.nutrition ?? {}),
    }),
    img_url: draft.img_url || (product.img_url ?? ""),
  };
}

export { hasNutritionValues };

export interface VariantContext {
  parent: PantryItem | null;
  /** Non-empty: this item is a generic */
  children: PantryItem[];
  /** Rows that could become the parent, or be attached as a variant */
  candidates: (PantryItem & { isGeneric: boolean })[];
}

export function variantContext(
  item: PantryItem,
  all: readonly PantryItem[],
): VariantContext {
  const genericIds = new Set(
    all
      .map((row) => row.generic_parent_id)
      .filter((id): id is number => id != null),
  );
  return {
    parent:
      item.generic_parent_id == null
        ? null
        : (all.find((row) => row.id === item.generic_parent_id) ?? null),
    children: all
      .filter((row) => row.generic_parent_id === item.id && row.id !== item.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    candidates: all
      .filter(
        (row) =>
          row.id !== item.id &&
          row.generic_parent_id == null &&
          row.id !== item.generic_parent_id,
      )
      .map((row) => ({ ...row, isGeneric: genericIds.has(row.id) })),
  };
}

export const PICKER_LIMIT = 50;
export const SUGGESTION_LIMIT = 6;

export function pickerResults<T extends { name: string }>(
  candidates: readonly T[],
  query: string,
): T[] {
  const needle = foldText(query).trim();
  return candidates
    .filter((row) => !needle || foldText(row.name).includes(needle))
    .slice(0, PICKER_LIMIT);
}

/**
 * While typing a brand: rows to attach instead of creating one. Generics
 * are left out (the server refuses to nest them); prefix hits come first.
 */
export function variantSuggestions<
  T extends { name: string; brand: string | null; isGeneric: boolean },
>(candidates: readonly T[], query: string): T[] {
  const needle = foldText(query).trim();
  if (!needle) return [];
  return candidates
    .filter(
      (row) =>
        !row.isGeneric &&
        `${foldText(row.name)} ${foldText(row.brand)}`.includes(needle),
    )
    .map((row) => ({
      row,
      isPrefix:
        foldText(row.name).startsWith(needle) ||
        foldText(row.brand).startsWith(needle),
    }))
    .sort(
      (a, b) =>
        Number(b.isPrefix) - Number(a.isPrefix) ||
        a.row.name.localeCompare(b.row.name),
    )
    .map((entry) => entry.row)
    .slice(0, SUGGESTION_LIMIT);
}

/**
 * The new variant row: the parent's name unless overridden. The first
 * variant of a flat item takes its expiry date (it is that product).
 */
export function newVariant(
  parent: PantryItem,
  brand: string,
  nameOverride: string,
  isPromoting: boolean,
): PantryPatch & { name: string } {
  return {
    name: nameOverride.trim() || parent.name,
    brand: brand.trim() || null,
    in_stock: 1,
    category_id: parent.category_id,
    generic_parent_id: parent.id,
    expires_on: isPromoting ? (parent.expires_on ?? null) : null,
  };
}
