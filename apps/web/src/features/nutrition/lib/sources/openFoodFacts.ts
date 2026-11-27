/**
 * Open Food Facts: product mapping, name search and barcode lookup, ported
 * from the OFF parts of nutritrace/src/lib/api.js. Requests go through the
 * injected `getJson` (the backend's proxy).
 */

import { deriveSodiumSalt } from "../nutrition";
import type { AltUnit } from "../units";
import { offProductName } from "./offName";
import { asSoldNutriments } from "./offNutritionSets";
import { rankOffResults, type RankEntry } from "./offRank";
import { needsFullLookup, offNutritionStatus } from "./offStatus";
import {
  emptyPage,
  externalFood,
  isExternalFood,
  type DerivedFlags,
  type ExternalFood,
  type GetJson,
  type PreparedValues,
  type SearchPage,
} from "./types";

export const OFF_BASE = "https://world.openfoodfacts.org";
export const OFF_SEARCH_BASE = "https://search.openfoodfacts.org/search";
export const OFF_PAGE_SIZE = 50;

export interface OffOptions {
  /** The `offSearchLanguage` setting */
  language?: string | null;
  /** The `offSearchCountry` setting; "World" means no filter */
  country?: string | null;
  /** The `offImportPortion` setting: `per100g` (default) or `perServing` */
  importPortion?: string | null;
}

/** A product as v3, a search hit or the local mirror sends it */
export type OffProduct = Record<string, unknown>;

interface OffEnvelope {
  status?: unknown;
  product?: OffProduct | null;
}

interface OffSearchResponse {
  /** The local mirror's envelope; search-a-licious uses it too */
  hits?: OffProduct[];
  products?: OffProduct[];
  count?: unknown;
}

export function offLanguage(language: string | null | undefined): string {
  return language ? language.slice(0, 2).toLowerCase() : "en";
}

/** The `countries_tags` value of a country name, or null for "World" */
export function offCountryFilter(
  country: string | null | undefined,
): string | null {
  if (!country || country === "World") return null;
  const slug = country.toLowerCase().replace(/\s+/g, "-");
  return slug.startsWith("en:") ? slug : `en:${slug}`;
}

/** Typed text must not act as Lucene operators ("Ben & Jerry's", "M&M's") */
export function luceneEscape(text: string): string {
  return text
    .replace(/[+\-!(){}[\]^"~*?:\\/]/g, "\\$&")
    .replace(/&&/g, "\\&\\&")
    .replace(/\|\|/g, "\\|\\|");
}

export function offSearchUrl(
  query: string,
  page: number,
  pageSize: number,
  options: OffOptions = {},
): string {
  const country = offCountryFilter(options.country);
  const escaped = luceneEscape(query);
  const params = new URLSearchParams({
    q: country ? `${escaped} +countries_tags:"${country}"` : escaped,
    page_size: String(pageSize),
    page: String(page),
    langs: offLanguage(options.language),
  });
  return `${OFF_SEARCH_BASE}?${params.toString()}`;
}

export function offProductUrl(code: string, options: OffOptions = {}): string {
  const language = encodeURIComponent(offLanguage(options.language));
  return `${OFF_BASE}/api/v3/product/${encodeURIComponent(code)}?lc=${language}`;
}

export function offNutritionSetsUrl(code: string): string {
  return `${OFF_BASE}/api/v3.5/product/${encodeURIComponent(code)}?fields=nutrition`;
}

/** Any "found" envelope: v2 and mirror `1`, v3 `success*`, or a product */
export function isOffSuccess(data: unknown): boolean {
  if (!data) return false;
  const { status, product } = data as OffEnvelope;
  if (status === 1) return true;
  if (typeof status === "string" && status.startsWith("success")) return true;
  return !!product;
}

/** [our id, OFF's key, factor from OFF's unit to ours] */
const OFF_NUTRIENTS: [string, string, number?][] = [
  ["kilojoules", "energy"],
  ["fat", "fat"],
  ["saturated-fat", "saturated-fat"],
  ["trans-fat", "trans-fat"],
  ["polyunsaturated-fat", "polyunsaturated-fat"],
  ["monounsaturated-fat", "monounsaturated-fat"],
  ["carbohydrates", "carbohydrates"],
  ["sugars", "sugars"],
  ["added-sugars", "added-sugars"],
  ["fiber", "fiber"],
  ["proteins", "proteins"],
  ["salt", "salt"],
  ["sodium", "sodium", 1000],
  ["potassium", "potassium", 1000],
  ["cholesterol", "cholesterol", 1000],
  ["caffeine", "caffeine", 1000],
  ["alcohol", "alcohol"],
  ["calcium", "calcium", 1000],
  ["iron", "iron", 1000],
  ["magnesium", "magnesium", 1000],
  ["vitamin-c", "vitamin-c", 1000],
  ["vitamin-a", "vitamin-a", 1000000],
  ["vitamin-d", "vitamin-d", 1000000],
  ["vitamin-e", "vitamin-e", 1000],
  ["vitamin-k", "vitamin-k", 1000000],
  ["b1", "vitamin-b1", 1000],
  ["b2", "vitamin-b2", 1000],
  ["b3", "vitamin-b3", 1000],
  ["b6", "vitamin-b6", 1000],
  ["b9", "vitamin-b9", 1000000],
  ["b12", "vitamin-b12", 1000000],
  ["zinc", "zinc", 1000],
  ["phosphorus", "phosphorus", 1000],
];

function isFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function amount(value: unknown): number {
  return parseFloat(text(value)) || 0;
}

/**
 * One column of `nutriments` (`_100g`, `_serving`, `_prepared_100g`).
 * Values OFF marks `~` are estimates and count as missing.
 */
function readColumn(
  nutriments: Record<string, unknown>,
  suffix: string,
  modifierSuffix: string,
) {
  const has = (key: string) =>
    nutriments[key + modifierSuffix] !== "~" &&
    isFilled(nutriments[key + suffix]);
  const get = (key: string, factor = 1) =>
    has(key) ? amount(nutriments[key + suffix]) * factor : 0;
  return { has, get };
}

function mapNutrients(
  column: ReturnType<typeof readColumn>,
  kcal: number,
): { nutrition: Record<string, number>; present: Set<string> } {
  const nutrition: Record<string, number> = {
    calories: Math.round(kcal * 10) / 10,
  };
  const present = new Set<string>();
  if (column.has("energy-kcal") || column.has("energy")) {
    present.add("calories");
  }
  for (const [id, key, factor] of OFF_NUTRIENTS) {
    nutrition[id] = column.get(key, factor);
    if (column.has(key)) present.add(id);
  }
  // Salt and sodium are one datum
  if (present.has("salt") || present.has("sodium")) {
    present.add("salt");
    present.add("sodium");
  }
  return { nutrition, present };
}

function derive(nutrition: Record<string, number>): DerivedFlags {
  const derived = deriveSodiumSalt(nutrition);
  return derived
    ? { salt: derived === "salt", sodium: derived === "sodium" }
    : {};
}

const BASE_UNITS = new Set([
  "g",
  "mg",
  "kg",
  "ml",
  "l",
  "oz",
  "lb",
  "cup",
  "tbsp",
  "tsp",
]);

function nutritionBasis(product: OffProduct): "g" | "ml" | null {
  const per = text(product.nutrition_data_per).toLowerCase();
  if (per === "100g") return "g";
  if (per === "100ml") return "ml";
  const unit = text(product.serving_quantity_unit).toLowerCase();
  if (unit === "g" || unit === "kg") return "g";
  if (unit === "ml" || unit === "l") return "ml";
  return null;
}

/** "1 slice (35 g)" with serving_quantity 35 gives `{ slice: 35 g }` */
function servingAltUnit(product: OffProduct): AltUnit[] | null {
  const size = text(product.serving_size).trim();
  const quantity = parseFloat(text(product.serving_quantity));
  if (!size || !Number.isFinite(quantity) || quantity <= 0) return null;
  const match = /^\s*\d+\s*([a-zA-ZÀ-ÿ]+)/.exec(size);
  const label = match?.[1]?.toLowerCase() ?? "";
  if (!label || BASE_UNITS.has(label)) return null;
  return [{ abbr: label, grams: Math.round(quantity * 10) / 10 }];
}

function brandOf(brands: unknown): string {
  // The search API now answers with brand tags such as "xx:Ferrero"
  return firstBrand(brands).replace(/^[a-z]{2,3}:/, "");
}

function firstBrand(brands: unknown): string {
  const first: unknown = Array.isArray(brands)
    ? (brands as unknown[])[0]
    : text(brands).split(",")[0];
  return text(first).trim();
}

function firstTag(value: unknown): string | null {
  return Array.isArray(value) ? text((value as unknown[])[0]) || null : null;
}

function preparedValues(
  product: OffProduct,
  nutriments: Record<string, unknown>,
): PreparedValues | null {
  const column = readColumn(nutriments, "_prepared_100g", "_prepared_modifier");
  const kcal = column.has("energy-kcal")
    ? column.get("energy-kcal")
    : column.get("energy") / 4.184;
  const { nutrition, present } = mapNutrients(column, kcal);
  if (present.size === 0) return null;
  const derived = derive(nutrition);
  const per = text(product.nutrition_data_prepared_per).toLowerCase();
  return {
    nutrition,
    derived,
    present: [...present],
    portion: 100,
    unit: per === "100ml" ? "ml" : "g",
  };
}

/** Null without a name in any language. `isFull`: a product lookup, not a hit */
export function mapOffProduct(
  product: OffProduct | null | undefined,
  options: OffOptions = {},
  isFull = false,
): ExternalFood | null {
  const name = offProductName(product, offLanguage(options.language));
  if (!product || !name) return null;
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const servingQuantity = parseFloat(text(product.serving_quantity));
  const isPerServing =
    options.importPortion === "perServing" &&
    Number.isFinite(servingQuantity) &&
    servingQuantity > 0 &&
    (nutriments["energy-kcal_serving"] != null ||
      nutriments.energy_serving != null);
  const suffix = isPerServing ? "_serving" : "_100g";
  const column = readColumn(nutriments, suffix, "_modifier");
  const kcal =
    column.get("energy-kcal") || amount(nutriments[`energy${suffix}`]) / 4.184;
  const { nutrition, present } = mapNutrients(column, kcal);
  const isPreparedOnly =
    present.size === 0 &&
    Object.keys(nutriments).some(
      (key) =>
        key.endsWith(`_prepared${suffix}`) &&
        nutriments[key] !== "" &&
        nutriments[key] != null,
    );
  const prepared = isPreparedOnly ? preparedValues(product, nutriments) : null;
  const derived = derive(nutrition);
  const grade = text(
    product.nutriscore_grade || product.nutrition_grades,
  ).toLowerCase();
  return externalFood("off", {
    name,
    brand: brandOf(product.brands),
    barcode: text(product.code || product._id || product.id),
    unit: isPerServing ? text(product.serving_quantity_unit) || "g" : "g",
    portion: isPerServing ? servingQuantity : 100,
    nutrition,
    derived,
    imgUrl: text(
      product.image_front_display_url ||
        product.image_front_url ||
        product.image_url ||
        product.image_front_small_url,
    ),
    nutrition_basis: nutritionBasis(product),
    alt_units: servingAltUnit(product),
    completeness:
      typeof product.completeness === "number" ? product.completeness : null,
    nutriscore: grade || null,
    nova: typeof product.nova_group === "number" ? product.nova_group : null,
    // Where it is from, not `countries_tags` (where it is sold)
    originTag:
      firstTag(product.origins_tags) ??
      firstTag(product.manufacturing_places_tags),
    offInfo: { present: [...present], isPreparedOnly, prepared, isFull },
  });
}

export interface OffLookupOptions extends OffOptions {
  /** Past the server's local OFF mirror, which may predate an edit (#241) */
  isLive?: boolean;
}

/**
 * A full product, with its "as sold" values from v3.5 when v3 only sends "as
 * prepared" ones. Any surprise there, or a set without calories, keeps v3's.
 */
export async function mapFullOffProduct(
  getJson: GetJson,
  product: OffProduct,
  code: string,
  options: OffLookupOptions = {},
): Promise<ExternalFood | null> {
  const mapped = mapOffProduct(product, options, true);
  if (!mapped?.offInfo?.isPreparedOnly) return mapped;
  try {
    const data = await getJson<OffEnvelope>(
      offNutritionSetsUrl(code),
      options.isLive ?? false,
    );
    const asSold = isOffSuccess(data)
      ? asSoldNutriments(data.product?.nutrition, product.serving_quantity)
      : null;
    if (!asSold) return mapped;
    const merged = mapOffProduct(
      {
        ...product,
        nutriments: {
          ...(product.nutriments as object | undefined),
          ...asSold.nutriments,
        },
        nutrition_data_per: asSold.per,
      },
      options,
      true,
    );
    return merged?.offInfo?.present.includes("calories") ? merged : mapped;
  } catch {
    return mapped;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 404;
}

/** Null when OFF doesn't have the product; other failures throw */
export async function lookupBarcode(
  getJson: GetJson,
  code: string,
  options: OffLookupOptions = {},
): Promise<ExternalFood | null> {
  if (!code) return null;
  let data: OffEnvelope;
  try {
    data = await getJson<OffEnvelope>(
      offProductUrl(code, options),
      options.isLive ?? false,
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  if (!isOffSuccess(data) || !data.product) return null;
  return mapFullOffProduct(getJson, data.product, code, options);
}

/** A ranked result page; throws when the search fails */
export async function searchOff(
  getJson: GetJson,
  query: string,
  page = 1,
  options: OffOptions = {},
  pageSize = OFF_PAGE_SIZE,
): Promise<SearchPage<ExternalFood>> {
  if (!query.trim()) return emptyPage(page);
  const data = await getJson<OffSearchResponse>(
    offSearchUrl(query, page, pageSize, options),
  );
  const entries: RankEntry<ExternalFood>[] = [];
  for (const hit of data.hits ?? data.products ?? []) {
    const food = mapOffProduct(hit, options);
    if (!food) continue;
    const score = typeof hit._score === "number" ? hit._score : undefined;
    entries.push({ food, score });
  }
  const totalHits =
    typeof data.count === "number" ? data.count : entries.length;
  return {
    items: rankOffResults(entries, {
      isFromMirror: Array.isArray(data.hits),
    }),
    totalHits,
    page,
    hasMore: page * pageSize < totalHits,
  };
}

/**
 * A tapped search hit replaced by the full product (hits lack the serving
 * fields); the hit itself when that fails.
 */
export async function hydrateOffHit(
  getJson: GetJson,
  hit: ExternalFood,
  options: OffOptions = {},
): Promise<ExternalFood> {
  if (hit.source !== "off" || !hit.barcode || hit.offInfo?.isFull) return hit;
  const full = await lookupBarcode(getJson, hit.barcode, options).catch(
    () => null,
  );
  return full ? { ...hit, ...full } : hit;
}

/**
 * Before a hit is saved or logged: if it has no values, the full product may.
 * Anything but `ok` must not be added as it is (it would be 0 kcal).
 */
export async function completeOffFood(
  getJson: GetJson,
  food: ExternalFood,
  options: OffOptions = {},
): Promise<{
  food: ExternalFood;
  status: ReturnType<typeof offNutritionStatus>;
}> {
  let result = food;
  if (needsFullLookup(food.offInfo) && offNutritionStatus(food) !== "ok") {
    const full = await lookupBarcode(getJson, food.barcode, options).catch(
      () => null,
    );
    if (full) {
      result =
        offNutritionStatus(full) === "ok"
          ? { ...food, ...full }
          : { ...food, offInfo: full.offInfo };
    }
  }
  return { food: result, status: offNutritionStatus(result) };
}

export interface ResolvedPicks<T> {
  keep: (T | ExternalFood)[];
  /** Names of the products left out for having no values */
  skipped: string[];
}

/** Multi-select: unsaved OFF picks completed, those without values dropped */
export async function resolveOffPicks<T extends { name: string }>(
  getJson: GetJson,
  picks: readonly (T | ExternalFood)[],
  options: OffOptions = {},
): Promise<ResolvedPicks<T>> {
  const keep: (T | ExternalFood)[] = [];
  const skipped: string[] = [];
  for (const pick of picks) {
    if (!isExternalFood(pick)) {
      keep.push(pick);
      continue;
    }
    const { food, status } = await completeOffFood(getJson, pick, options);
    if (status === "ok") keep.push(food);
    else skipped.push(food.name);
  }
  return { keep, skipped };
}
