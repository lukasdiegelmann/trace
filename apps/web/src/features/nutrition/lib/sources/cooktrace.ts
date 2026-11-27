/**
 * CookTrace recipes and pantry through the backend's proxy, ported from
 * nutritrace/src/lib/cooktraceApi.js and the MealEditor's update check.
 */

import type { MealItem, NutritionMap } from "../../api";
import { parseServerTimestamp } from "../dates";
import { deriveSodiumSalt } from "../nutrition";
import type { AltUnit } from "../units";
import {
  derivedFlagsOf,
  emptyPage,
  externalFood,
  withDerivedFlags,
  type DerivedFlags,
  type ExternalFood,
  type MealPrefill,
  type SearchPage,
} from "./types";

/** `integrationsApi.cooktrace` of api.ts; throws with `status` on non-2xx */
export type CooktraceProxy = <T>(
  baseUrl: string,
  token: string,
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;

export interface CooktraceConfig {
  /** The `cooktraceBaseUrl` setting */
  baseUrl: string;
  /** The `cooktraceApiToken` setting */
  token: string;
}

export interface CooktraceRecipeSummary {
  id: number;
  name: string;
  img_url?: string | null;
  servings?: number | null;
  portion?: number | null;
  unit?: string | null;
  /** Per serving */
  nutrition?: NutritionMap | null;
  source_url?: string | null;
  updated_at?: string | null;
}

export interface CooktraceIngredient {
  name?: string;
  brand?: string | null;
  portion?: number | string | null;
  unit?: string | null;
  quantity?: number | string | null;
  nutrition?: NutritionMap | null;
  barcode?: string | null;
  img_url?: string | null;
}

export interface CooktraceRecipe extends CooktraceRecipeSummary {
  items?: CooktraceIngredient[] | null;
}

/** A pantry row already has NutriTrace's food shape */
export interface CooktracePantryRow {
  name: string;
  brand?: string | null;
  portion?: number | null;
  unit?: string | null;
  nutrition?: NutritionMap | null;
  img_url?: string | null;
  barcode?: string | null;
  nutrition_basis?: "g" | "ml" | null;
  alt_units?: AltUnit[] | null;
  source_app?: string | null;
  source_external_id?: string | null;
  source_url?: string | null;
}

interface CooktraceList<T> {
  items?: T[];
  total?: number;
}

export function isCooktraceConfigured(config: CooktraceConfig): boolean {
  return Boolean(config.baseUrl && config.token);
}

function get<T>(
  proxy: CooktraceProxy,
  config: CooktraceConfig,
  path: string,
): Promise<T> {
  return proxy<T>(config.baseUrl.replace(/\/$/, ""), config.token, path, "GET");
}

async function searchList<T>(
  proxy: CooktraceProxy,
  config: CooktraceConfig,
  resource: "recipes" | "pantry",
  query: string,
  page: number,
  perPage: number,
): Promise<SearchPage<T>> {
  if (!query.trim() || !isCooktraceConfigured(config)) return emptyPage(page);
  const offset = Math.max(0, (page - 1) * perPage);
  const data = await get<CooktraceList<T>>(
    proxy,
    config,
    `/api/v1/${resource}?q=${encodeURIComponent(query)}&limit=${perPage}&offset=${offset}`,
  );
  const items = data.items ?? [];
  const totalHits = typeof data.total === "number" ? data.total : items.length;
  return { items, totalHits, page, hasMore: offset + items.length < totalHits };
}

export function searchCooktraceRecipes(
  proxy: CooktraceProxy,
  config: CooktraceConfig,
  query: string,
  page = 1,
  perPage = 25,
): Promise<SearchPage<CooktraceRecipeSummary>> {
  return searchList(proxy, config, "recipes", query, page, perPage);
}

function derive(nutrition: NutritionMap | null | undefined): {
  nutrition: NutritionMap;
  derived: DerivedFlags;
} {
  const out: Record<string, unknown> = { ...nutrition };
  delete out._derived;
  const derived = deriveSodiumSalt(out);
  return {
    nutrition: out as NutritionMap,
    derived: derived
      ? { salt: derived === "salt", sodium: derived === "sodium" }
      : derivedFlagsOf(nutrition),
  };
}

export function mapCooktracePantryRow(row: CooktracePantryRow): ExternalFood {
  const nutrition: Record<string, unknown> = { ...row.nutrition };
  delete nutrition._derived;
  return externalFood("cooktracePantry", {
    name: row.name,
    brand: row.brand ?? "",
    barcode: row.barcode ?? "",
    portion: row.portion ?? 100,
    unit: row.unit ?? "g",
    nutrition: nutrition as NutritionMap,
    derived: derivedFlagsOf(row.nutrition),
    imgUrl: row.img_url ?? "",
    nutrition_basis: row.nutrition_basis ?? null,
    alt_units: row.alt_units ?? null,
    source_app: row.source_app ?? "cooktrace",
    source_external_id: row.source_external_id ?? null,
    source_url: row.source_url ?? null,
  });
}

export async function searchCooktracePantry(
  proxy: CooktraceProxy,
  config: CooktraceConfig,
  query: string,
  page = 1,
  perPage = 50,
): Promise<SearchPage<ExternalFood>> {
  const result = await searchList<CooktracePantryRow>(
    proxy,
    config,
    "pantry",
    query,
    page,
    perPage,
  );
  return { ...result, items: result.items.map(mapCooktracePantryRow) };
}

export async function getCooktraceRecipe(
  proxy: CooktraceProxy,
  config: CooktraceConfig,
  id: number | string,
): Promise<CooktraceRecipe | null> {
  if (!isCooktraceConfigured(config)) return null;
  return get<CooktraceRecipe>(
    proxy,
    config,
    `/api/v1/recipes/${encodeURIComponent(id)}`,
  );
}

function finiteOr<T>(value: unknown, fallback: T): number | T {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mapIngredient(item: CooktraceIngredient): MealItem {
  const values = derive(item.nutrition);
  return {
    name: (item.name ?? "").slice(0, 200),
    brand: (item.brand ?? "").slice(0, 120),
    // An empty unit stays empty: "4 egg yolks" must not read "4 g"
    portion: finiteOr(item.portion, 1),
    unit: (item.unit ?? "").slice(0, 16),
    quantity: finiteOr(item.quantity, 1),
    nutrition: withDerivedFlags(values.nutrition, values.derived),
    ...(item.barcode ? { barcode: item.barcode } : {}),
    ...(item.img_url ? { imgUrl: item.img_url } : {}),
  };
}

/**
 * CookTrace's nutrition is per serving, the editor works with whole-recipe
 * totals and divides again on save. The source ids make a re-import upsert.
 */
export function mapCooktraceRecipe(recipe: CooktraceRecipe): MealPrefill {
  const servings = finiteOr(recipe.servings ?? undefined, 1);
  const values = derive(recipe.nutrition);
  const totals: Record<string, number> = {};
  for (const [key, value] of Object.entries(values.nutrition)) {
    totals[key] = (parseFloat(String(value)) || 0) * servings;
  }
  return {
    name: recipe.name,
    imgUrl: recipe.img_url ?? "",
    items: (recipe.items ?? []).map(mapIngredient),
    nutrition: totals,
    servings,
    portion: finiteOr(recipe.portion ?? undefined, null),
    unit: recipe.unit || "g",
    source_app: "cooktrace",
    source_external_id: `recipe:${recipe.id}`,
    source_url: recipe.source_url || null,
  };
}

/** What identifies where a saved meal came from */
export interface SourcedMeal {
  id?: number | null;
  updated_at?: string | null;
  source_app?: string | null;
  source_external_id?: string | null;
}

export function cooktraceRecipeId(meal: SourcedMeal): number | null {
  if (meal.source_app !== "cooktrace") return null;
  const match = /^recipe:(\d+)$/.exec(meal.source_external_id ?? "");
  return match ? Number(match[1]) : null;
}

/** Both as SQLite UTC or ISO */
export function isCooktraceNewer(
  remoteUpdatedAt: string,
  localUpdatedAt: string,
): boolean {
  return (
    parseServerTimestamp(remoteUpdatedAt).getTime() >
    parseServerTimestamp(localUpdatedAt).getTime()
  );
}

export type CooktraceUpdate =
  | { status: "notApplicable" | "upToDate" | "deleted" | "unknown" }
  | { status: "updated"; recipe: CooktraceRecipe };

/**
 * The editor's check on open. Only saved CookTrace imports are checked (a
 * fresh pick is current). 404 is `deleted`; other failures stay `unknown`.
 * The caller skips it when `cooktraceEnabled` is off.
 */
export async function checkCooktraceUpdate(
  proxy: CooktraceProxy,
  config: CooktraceConfig,
  meal: SourcedMeal,
): Promise<CooktraceUpdate> {
  const recipeId = cooktraceRecipeId(meal);
  if (
    recipeId === null ||
    !meal.id ||
    !meal.updated_at ||
    !isCooktraceConfigured(config)
  ) {
    return { status: "notApplicable" };
  }
  try {
    const recipe = await getCooktraceRecipe(proxy, config, recipeId);
    if (!recipe?.updated_at) return { status: "unknown" };
    return isCooktraceNewer(recipe.updated_at, meal.updated_at)
      ? { status: "updated", recipe }
      : { status: "upToDate" };
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    return { status: status === 404 ? "deleted" : "unknown" };
  }
}
