/**
 * USDA FoodData Central search, mapping and data-type tiers, ported from the
 * `USDA` part of nutritrace/src/lib/api.js and Foods.svelte's badges.
 */
import { deriveSodiumSalt } from "../nutrition";
import {
  emptyPage,
  externalFood,
  type ExternalFood,
  type GetJson,
  type SearchPage,
} from "./types";

export const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
export const USDA_PAGE_SIZE = 50;

/** Best quality first; `Survey` is USDA's "Survey (FNDDS)" */
export type UsdaTier =
  | "Foundation"
  | "SR Legacy"
  | "Survey"
  | "Branded"
  | "Experimental"
  | "Unknown";

export const USDA_TIERS: readonly UsdaTier[] = [
  "Foundation",
  "SR Legacy",
  "Survey",
  "Branded",
  "Experimental",
  "Unknown",
];

export type UsdaBadge = "F" | "L" | "S" | "B" | "X" | "?";

const BADGES: Record<UsdaTier, UsdaBadge> = {
  Foundation: "F",
  "SR Legacy": "L",
  Survey: "S",
  Branded: "B",
  Experimental: "X",
  Unknown: "?",
};

export function usdaTier(dataType: string | null | undefined): UsdaTier {
  if (dataType === "Survey (FNDDS)") return "Survey";
  return USDA_TIERS.find((tier) => tier === dataType) ?? "Unknown";
}

export function usdaBadge(dataType: string | null | undefined): UsdaBadge {
  return BADGES[usdaTier(dataType)];
}

export function filterByUsdaTier<T extends { dataType?: string | null }>(
  foods: readonly T[],
  active: ReadonlySet<UsdaTier>,
): T[] {
  return foods.filter((food) => active.has(usdaTier(food.dataType)));
}

/** USDA's relevance is text only, so curated tiers move up within a page */
export function rankUsdaResults<T extends { dataType?: string | null }>(
  foods: readonly T[],
): T[] {
  const rank = (food: T) => USDA_TIERS.indexOf(usdaTier(food.dataType));
  return [...foods].sort((a, b) => rank(a) - rank(b));
}

/** FoodData Central nutrient id -> ours */
const NUTRIENT_IDS: Record<number, string | undefined> = {
  1008: "calories",
  1062: "kilojoules",
  1003: "proteins",
  1004: "fat",
  1258: "saturated-fat",
  1257: "trans-fat",
  1292: "monounsaturated-fat",
  1293: "polyunsaturated-fat",
  1005: "carbohydrates",
  2000: "sugars",
  1235: "added-sugars",
  1079: "fiber",
  1093: "sodium",
  1253: "cholesterol",
  1087: "calcium",
  1089: "iron",
  1092: "potassium",
  1090: "magnesium",
  1095: "zinc",
  1091: "phosphorus",
  1162: "vitamin-c",
  1106: "vitamin-a",
  1114: "vitamin-d",
  1109: "vitamin-e",
  1185: "vitamin-k",
  1165: "b1",
  1166: "b2",
  1167: "b3",
  1175: "b6",
  1177: "b9",
  1178: "b12",
};

interface UsdaNutrient {
  /** Search API */
  nutrientId?: number;
  value?: number | null;
  /** Detail API */
  nutrient?: { id?: number };
  amount?: number | null;
}

export interface UsdaItem {
  fdcId?: number;
  gtinUpc?: string;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  dataType?: string;
  foodNutrients?: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods?: UsdaItem[];
  totalHits?: number;
  totalPages?: number;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Values scaled from `servingSize` (g or ml) to per 100 */
export function mapUsdaFood(item: UsdaItem, servingSize: number): ExternalFood {
  const factor = servingSize > 0 ? 100 / servingSize : 1;
  const nutrition: Record<string, number> = {};
  for (const row of item.foodNutrients ?? []) {
    const id = row.nutrientId || row.nutrient?.id;
    const key = id === undefined ? undefined : NUTRIENT_IDS[id];
    const raw = row.value ?? row.amount;
    if (key && raw != null) nutrition[key] = round4(raw * factor);
  }
  if (nutrition.calories && !nutrition.kilojoules) {
    nutrition.kilojoules = Math.round(nutrition.calories * 4.184 * 10) / 10;
  }
  const derived = deriveSodiumSalt(nutrition);
  // USDA's carbohydrate "by difference" includes fiber; never below sugars
  if ("carbohydrates" in nutrition && "fiber" in nutrition) {
    nutrition.carbohydrates = round4(
      Math.max(
        nutrition.carbohydrates - nutrition.fiber,
        nutrition.sugars || 0,
      ),
    );
  }
  const isMillilitres = item.servingSizeUnit?.toLowerCase() === "ml";
  return externalFood("usda", {
    name: (item.description ?? "").trim(),
    brand: (item.brandOwner || item.brandName || "").trim(),
    barcode: item.fdcId ? `fdcId_${item.fdcId}` : (item.gtinUpc ?? ""),
    unit: isMillilitres ? "ml" : "g",
    portion: 100,
    nutrition,
    derived: derived
      ? { salt: derived === "salt", sodium: derived === "sodium" }
      : {},
    dataType: item.dataType || null,
  });
}

export function usdaSearchUrl(
  query: string,
  page: number,
  apiKey: string,
  pageSize = USDA_PAGE_SIZE,
): string {
  return (
    `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}` +
    `&pageSize=${pageSize}&pageNumber=${page}` +
    `&api_key=${encodeURIComponent(apiKey)}`
  );
}

/** Empty without a query or an API key; throws when the search fails */
export async function searchUsda(
  getJson: GetJson,
  query: string,
  page: number,
  apiKey: string,
  pageSize = USDA_PAGE_SIZE,
): Promise<SearchPage<ExternalFood>> {
  if (!query.trim() || !apiKey) return emptyPage(page);
  const data = await getJson<UsdaSearchResponse>(
    usdaSearchUrl(query, page, apiKey, pageSize),
  );
  const items = (data.foods ?? [])
    .map((food) => mapUsdaFood(food, Number(food.servingSize) || 100))
    .filter((food) => food.name);
  const totalHits =
    typeof data.totalHits === "number" ? data.totalHits : items.length;
  const totalPages =
    typeof data.totalPages === "number"
      ? data.totalPages
      : Math.ceil(totalHits / pageSize);
  return {
    items: rankUsdaResults(items),
    totalHits,
    page,
    hasMore: page < totalPages,
  };
}
