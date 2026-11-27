/**
 * Mealie recipes through the backend's proxy, ported from
 * nutritrace/src/lib/mealieApi.js. A recipe is imported as one food with
 * unit `serving`.
 */
import { deriveSodiumSalt } from "../nutrition";
import {
  emptyPage,
  externalFood,
  type ExternalFood,
  type SearchPage,
} from "./types";

/** `integrationsApi.mealie` of api.ts */
export type MealieProxy = <T>(
  baseUrl: string,
  token: string,
  path: string,
) => Promise<T>;

export interface MealieConfig {
  /** The `mealieBaseUrl` setting */
  baseUrl: string;
  /** The `mealieApiToken` setting */
  token: string;
}

export interface MealieRecipeSummary {
  id: string;
  slug: string;
  name: string;
  recipeCategory?: { name: string }[];
}

export interface MealieRecipe {
  id?: string;
  slug?: string;
  name?: string;
  orgURL?: string | null;
  /** Per serving, as strings */
  nutrition?: Record<string, string | number | null | undefined> | null;
}

interface MealieList {
  items?: MealieRecipeSummary[];
  total?: number;
  total_pages?: number;
}

export const MEALIE_PAGE_SIZE = 10;

function trimmedBase(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function isMealieConfigured(config: MealieConfig): boolean {
  return Boolean(config.baseUrl && config.token);
}

export function mealieSearchPath(
  query: string,
  page = 1,
  perPage = MEALIE_PAGE_SIZE,
): string {
  const quoted = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const filter = encodeURIComponent(`name LIKE "%${quoted}%"`);
  return `/api/recipes?queryFilter=${filter}&perPage=${perPage}&page=${page}`;
}

/** Empty without a query or a configuration; throws when the proxy fails */
export async function searchMealie(
  proxy: MealieProxy,
  config: MealieConfig,
  query: string,
  page = 1,
  perPage = MEALIE_PAGE_SIZE,
): Promise<SearchPage<MealieRecipeSummary>> {
  if (!query.trim() || !isMealieConfigured(config)) return emptyPage(page);
  const data = await proxy<MealieList>(
    trimmedBase(config.baseUrl),
    config.token,
    mealieSearchPath(query, page, perPage),
  );
  const items = data.items ?? [];
  const totalHits = typeof data.total === "number" ? data.total : items.length;
  const totalPages =
    typeof data.total_pages === "number"
      ? data.total_pages
      : Math.ceil(totalHits / perPage);
  return { items, totalHits, page, hasMore: page < totalPages };
}

export async function getMealieRecipe(
  proxy: MealieProxy,
  config: MealieConfig,
  slug: string,
): Promise<MealieRecipe | null> {
  if (!slug || !isMealieConfigured(config)) return null;
  return proxy<MealieRecipe>(
    trimmedBase(config.baseUrl),
    config.token,
    `/api/recipes/${encodeURIComponent(slug)}`,
  );
}

/** Loaded by the browser straight from Mealie */
export function mealieImageUrl(
  baseUrl: string,
  recipeId: string | null | undefined,
): string {
  if (!baseUrl || !recipeId) return "";
  return `${trimmedBase(baseUrl)}/api/media/recipes/${recipeId}/images/original.webp`;
}

/** Our id -> Mealie's nutrition key */
const NUTRITION_KEYS: [string, string][] = [
  ["calories", "calories"],
  ["proteins", "proteinContent"],
  ["carbohydrates", "carbohydrateContent"],
  ["fat", "fatContent"],
  ["saturated-fat", "saturatedFatContent"],
  ["fiber", "fiberContent"],
  ["sugars", "sugarContent"],
  ["sodium", "sodiumContent"],
  ["cholesterol", "cholesterolContent"],
  ["trans-fat", "transFatContent"],
];

function hostName(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function mapMealieRecipe(
  recipe: MealieRecipe,
  baseUrl: string,
): ExternalFood {
  const nutrition: Record<string, number> = {};
  for (const [id, key] of NUTRITION_KEYS) {
    nutrition[id] = parseFloat(String(recipe.nutrition?.[key])) || 0;
  }
  const derived = deriveSodiumSalt(nutrition);
  return externalFood("mealie", {
    name: recipe.name ?? "",
    brand: hostName(recipe.orgURL),
    portion: 100,
    unit: "serving",
    nutrition,
    derived: derived
      ? { salt: derived === "salt", sodium: derived === "sodium" }
      : {},
    imgUrl: mealieImageUrl(baseUrl, recipe.id),
    mealieSlug: recipe.slug ?? null,
  });
}
