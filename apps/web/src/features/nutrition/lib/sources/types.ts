/**
 * The one shape every outside food source is mapped to (NutriTrace's
 * MappedFood, api.js and mealieApi.js/cooktraceApi.js), what the fetching
 * functions get injected, and how a pick becomes a `FoodWrite`.
 */
/* eslint-disable @typescript-eslint/naming-convention -- the backend's keys */
import type { FoodWrite, MealItem, NutritionMap } from "../../api";
import type { AltUnit } from "../units";

export type ExternalSource =
  "off" | "usda" | "mealie" | "cooktrace" | "cooktracePantry";

/** Which of sodium and salt was worked out from the other (`nutrition._derived`) */
export interface DerivedFlags {
  salt?: boolean;
  sodium?: boolean;
}

/** A product's "as prepared" values, offered but never used unasked (#241) */
export interface PreparedValues {
  nutrition: NutritionMap;
  derived: DerivedFlags;
  present: string[];
  portion: number;
  unit: "g" | "ml";
}

/**
 * What Open Food Facts really has for a product; the mapper's zeros stand in
 * for missing values. Upstream kept this in a registry by barcode.
 */
export interface OffInfo {
  present: string[];
  isPreparedOnly: boolean;
  prepared: PreparedValues | null;
  /** From a full product lookup, not a search hit (which carries less) */
  isFull: boolean;
}

export interface ExternalFood {
  source: ExternalSource;
  /** "" when the source has none; the form then asks for one */
  name: string;
  brand: string;
  /** OFF code, `fdcId_<id>` for USDA, "" without one */
  barcode: string;
  unit: string;
  portion: number;
  /** Per `portion`, without `_derived` (see `derived`) */
  nutrition: NutritionMap;
  derived: DerivedFlags;
  imgUrl: string;
  nutrition_basis: "g" | "ml" | null;
  alt_units: AltUnit[] | null;
  /** OFF's own 0-1 completeness */
  completeness: number | null;
  nutriscore: string | null;
  nova: number | null;
  /** OFF country tag of origin, e.g. `en:france` */
  originTag: string | null;
  /** USDA's source database */
  dataType: string | null;
  /** Only for OFF */
  offInfo: OffInfo | null;
  mealieSlug: string | null;
  source_app: string | null;
  source_external_id: string | null;
  source_url: string | null;
}

/** A CookTrace recipe as a MealEditor prefill */
export interface MealPrefill {
  /** "" when the source has none */
  name: string;
  imgUrl: string;
  items: MealItem[];
  /** Whole-recipe totals */
  nutrition: NutritionMap;
  servings: number;
  /** Per serving */
  portion: number | null;
  unit: string;
  source_app: string;
  source_external_id: string;
  source_url: string | null;
}

export interface SearchPage<T> {
  items: T[];
  totalHits: number;
  page: number;
  hasMore: boolean;
}

/** `proxyGet` of api.ts: JSON of a third-party URL; throws on non-2xx */
export type GetJson = <T>(url: string, isLive?: boolean) => Promise<T>;

export function emptyPage<T>(page = 1): SearchPage<T> {
  return { items: [], totalHits: 0, page, hasMore: false };
}

/** An `ExternalFood` with every optional field empty */
export function externalFood(
  source: ExternalSource,
  fields: Partial<ExternalFood>,
): ExternalFood {
  return {
    source,
    name: "",
    brand: "",
    barcode: "",
    unit: "g",
    portion: 100,
    nutrition: {},
    derived: {},
    imgUrl: "",
    nutrition_basis: null,
    alt_units: null,
    completeness: null,
    nutriscore: null,
    nova: null,
    originTag: null,
    dataType: null,
    offInfo: null,
    mealieSlug: null,
    source_app: null,
    source_external_id: null,
    source_url: null,
    ...fields,
  };
}

/** A pick that is not in the library yet (library rows have no `source`) */
export function isExternalFood(value: object): value is ExternalFood {
  return "source" in value && "offInfo" in value && !("id" in value);
}

/** The truthy `_derived` flags of a stored nutrition object */
export function derivedFlagsOf(
  nutrition: object | null | undefined,
): DerivedFlags {
  const stored = (nutrition as { _derived?: unknown } | null | undefined)
    ?._derived;
  const flags: DerivedFlags = {};
  if (typeof stored !== "object" || stored === null) return flags;
  const record = stored as Record<string, unknown>;
  if (record.salt) flags.salt = true;
  if (record.sodium) flags.sodium = true;
  return flags;
}

/**
 * The nutrition as stored: the numbers plus `_derived` when a flag is set.
 * `NutritionMap` can't express the nested object, hence the cast.
 */
export function withDerivedFlags(
  nutrition: NutritionMap,
  derived: DerivedFlags,
): NutritionMap {
  const out: Record<string, unknown> = { ...nutrition };
  delete out._derived;
  const flags = derivedFlagsOf({ _derived: derived });
  if (Object.keys(flags).length > 0) out._derived = flags;
  return out as NutritionMap;
}

/** What `POST /api/foods` gets for a pick (CookTrace rows upsert by source) */
export function toFoodWrite(food: ExternalFood): FoodWrite {
  return {
    name: food.name,
    brand: food.brand,
    nutrition: withDerivedFlags(food.nutrition, food.derived),
    portion: food.portion,
    unit: food.unit,
    img_url: food.imgUrl || null,
    barcode: food.barcode || null,
    nutrition_basis: food.nutrition_basis,
    alt_units: food.alt_units,
    ...(food.source_app ? { source_app: food.source_app } : {}),
    ...(food.source_external_id
      ? { source_external_id: food.source_external_id }
      : {}),
    ...(food.source_url ? { source_url: food.source_url } : {}),
  };
}

/** The next result page appended, skipping what is already listed */
export function appendUnique<T>(
  existing: readonly T[],
  incoming: readonly T[],
  keyOf: (item: T) => string | number,
): T[] {
  const seen = new Set(existing.map(keyOf));
  return [...existing, ...incoming.filter((item) => !seen.has(keyOf(item)))];
}

export function externalFoodKey(food: ExternalFood): string {
  return food.source_external_id || food.barcode || food.name;
}

/** A tier checkbox toggled; the last active tier can't be switched off */
export function toggleTier<T>(active: ReadonlySet<T>, tier: T): Set<T> {
  const next = new Set(active);
  if (next.has(tier)) next.delete(tier);
  else next.add(tier);
  if (next.size === 0) next.add(tier);
  return next;
}
