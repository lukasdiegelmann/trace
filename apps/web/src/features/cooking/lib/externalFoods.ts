/**
 * The pantry's external search sources: a food from Open Food Facts, USDA
 * FoodData Central or the connected NutriTrace, in pantry shape. Ported
 * from cooktrace/src/lib/{off,usda,nt-foods}.js. OFF and USDA go through
 * CookTrace's `/api/proxy?url=` (it allowlists both).
 */
import { api, SessionExpiredError } from "@/api";

import { deriveSodiumSalt, type Nutrition } from "./nutriments";

export type FoodSource = "off" | "usda" | "nt";

export interface ExternalFood {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  img_url?: string | null;
  nutrition?: Nutrition | null;
  /** OFF: 0..1 */
  completeness?: number | null;
  nutriscore?: string | null;
  /** OFF: where it was made */
  originTag?: string | null;
  /** USDA: Foundation, SR Legacy, Survey (FNDDS), Branded, Experimental */
  dataType?: string | null;
}

export interface OffPreferences {
  /** `offSearchLanguage` */
  language: string;
  /** `offSearchCountry`: a country name or "World" */
  country: string;
}

const OFF_BASE = "https://world.openfoodfacts.org";
const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

/** A JSON answer through the backend's proxy */
function viaProxy<T>(url: string): Promise<T> {
  return api.ct.get<T>("/proxy", { query: { url } });
}

/** External sources answer "nothing" on failure; a lost session propagates */
function ignoreFailure(error: unknown, source: string): void {
  if (error instanceof SessionExpiredError) throw error;
  console.warn(`[${source}] lookup failed:`, error);
}

/** 12-digit UPC-A codes get OFF's leading zero (EAN-13 form) */
export function canonicalizeBarcode(code: string): string {
  const trimmed = code.trim();
  return /^\d{12}$/.test(trimmed) ? `0${trimmed}` : trimmed;
}

export function offCountryFilter(country: string): string | null {
  if (!country || country === "World") return null;
  const slug = country.toLowerCase().replace(/\s+/g, "-");
  return slug.startsWith("en:") ? slug : `en:${slug}`;
}

function offLanguage(language: string): string {
  return (language || "en").slice(0, 2).toLowerCase();
}

export type OffProduct = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNumber(value: unknown, multiplier = 1): number {
  if (value == null || value === "") return 0;
  const number = Number.parseFloat(
    typeof value === "string" ? value : Number(value).toString(),
  );
  return Number.isFinite(number) ? number * multiplier : 0;
}

function firstString(value: unknown): string | null {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

/** An OFF product (per 100 g) in pantry shape, or null without a name */
export function mapOffProduct(
  product: OffProduct | null | undefined,
): ExternalFood | null {
  if (!product || !text(product.product_name)) return null;
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  // "~" marks an estimate OFF itself hides from its nutrition table.
  const read = (field: string, multiplier = 1): number => {
    const base = field.replace(/_100g$/, "");
    if (nutriments[`${base}_modifier`] === "~") return 0;
    return toNumber(nutriments[field], multiplier);
  };
  const kcal =
    read("energy-kcal_100g") ||
    (nutriments.energy_100g ? read("energy_100g") / 4.184 : 0);
  const nutrition = deriveSodiumSalt<Nutrition>({
    calories: Math.round(kcal * 10) / 10,
    kilojoules: read("energy_100g"),
    fat: read("fat_100g"),
    "saturated-fat": read("saturated-fat_100g"),
    "trans-fat": read("trans-fat_100g"),
    "polyunsaturated-fat": read("polyunsaturated-fat_100g"),
    "monounsaturated-fat": read("monounsaturated-fat_100g"),
    carbohydrates: read("carbohydrates_100g"),
    sugars: read("sugars_100g"),
    "added-sugars": read("added-sugars_100g"),
    fiber: read("fiber_100g"),
    proteins: read("proteins_100g"),
    salt: read("salt_100g"),
    sodium: read("sodium_100g", 1000),
    potassium: read("potassium_100g", 1000),
    cholesterol: read("cholesterol_100g", 1000),
  });
  const brands = product.brands;
  const brand = Array.isArray(brands)
    ? (firstString(brands) ?? "")
    : (text(brands).split(",")[0] ?? "");
  return {
    name: text(product.product_name).trim(),
    brand: brand.trim(),
    barcode: text(product.code) || text(product._id) || text(product.id),
    serving_size: 100,
    serving_unit: "g",
    img_url:
      text(product.image_front_display_url) ||
      text(product.image_front_url) ||
      text(product.image_url) ||
      text(product.image_front_small_url),
    nutrition,
    completeness:
      typeof product.completeness === "number" ? product.completeness : null,
    nutriscore:
      (
        text(product.nutriscore_grade) || text(product.nutrition_grades)
      ).toLowerCase() || null,
    originTag:
      firstString(product.origins_tags) ??
      firstString(product.manufacturing_places_tags),
  };
}

/** Image first, then completeness, then a Nutri-Score (OFF ignores these) */
export function rankOffResults(items: ExternalFood[]): ExternalFood[] {
  return [...items].sort(
    (a, b) =>
      Number(Boolean(b.img_url)) - Number(Boolean(a.img_url)) ||
      (b.completeness ?? 0) - (a.completeness ?? 0) ||
      Number(Boolean(b.nutriscore)) - Number(Boolean(a.nutriscore)),
  );
}

export async function offLookupBarcode(
  barcode: string,
  preferences: OffPreferences,
): Promise<ExternalFood | null> {
  const code = canonicalizeBarcode(barcode);
  if (!code) return null;
  try {
    const url = `${OFF_BASE}/api/v3/product/${encodeURIComponent(code)}?lc=${encodeURIComponent(offLanguage(preferences.language))}`;
    const data = await viaProxy<{
      status?: number | string;
      product?: OffProduct;
    }>(url);
    // v3 says "success", v0/v2 and the local mirror say 1.
    if (data.status !== 1 && data.status !== "success") return null;
    return mapOffProduct(data.product);
  } catch (error) {
    ignoreFailure(error, "off");
    return null;
  }
}

export async function offSearch(
  query: string,
  preferences: OffPreferences,
  page = 1,
): Promise<ExternalFood[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    // search-a-licious takes Lucene filters inline in q=.
    const country = offCountryFilter(preferences.country);
    const full = country ? `${trimmed} +countries_tags:"${country}"` : trimmed;
    const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(full)}&json=1&page_size=20&page=${page}&lc=${encodeURIComponent(offLanguage(preferences.language))}`;
    const data = await viaProxy<{ hits?: OffProduct[] }>(url);
    return rankOffResults(
      (data.hits ?? [])
        .map((hit) => mapOffProduct(hit))
        .filter((food): food is ExternalFood => food !== null),
    );
  } catch (error) {
    ignoreFailure(error, "off");
    return [];
  }
}

export interface OffAccount {
  /** `offUsername` */
  username: string;
  /** `offPassword` */
  password: string;
  /** `offUploadCountry`: a country or "Auto" */
  uploadCountry: string;
}

export interface OffContribution {
  name: string;
  brand?: string | null;
  barcode: string;
  serving_size?: number | null;
  serving_unit?: string | null;
  nutrition?: Nutrition | null;
}

const OFF_NUTRIENT_FIELDS: Record<string, string> = {
  calories: "energy-kcal",
  kilojoules: "energy",
  fat: "fat",
  "saturated-fat": "saturated-fat",
  carbohydrates: "carbohydrates",
  sugars: "sugars",
  fiber: "fiber",
  proteins: "proteins",
  salt: "salt",
  sodium: "sodium",
};

/** The query of OFF's contribute endpoint (it takes the form as a GET) */
export function offContributionParams(
  item: OffContribution,
  account: OffAccount,
  language: string,
): URLSearchParams {
  const lang = language.slice(0, 2);
  const params = new URLSearchParams({
    code: item.barcode,
    user_id: account.username || "cooktrace-app",
    password: account.password || "cooktrace",
    lang,
    [`product_name_${lang}`]: item.name,
  });
  if (item.brand) params.set("brands", item.brand);
  params.set("nutrition_data_per", "100g");
  const unit = item.serving_unit || "g";
  if (item.serving_size && (item.serving_size !== 100 || unit !== "g")) {
    params.set("serving_size", `${item.serving_size} ${unit}`);
  }
  if (account.uploadCountry && account.uploadCountry !== "Auto") {
    params.set("countries", account.uploadCountry);
  }
  for (const [id, field] of Object.entries(OFF_NUTRIENT_FIELDS)) {
    const value = item.nutrition?.[id];
    if (typeof value === "number" && Number.isFinite(value)) {
      params.set(`nutriment_${field}`, String(value));
    }
  }
  return params;
}

/** Submits to Open Food Facts, directly (the proxy only reads) */
export async function offContribute(
  item: OffContribution,
  account: OffAccount,
  language: string,
): Promise<void> {
  const params = offContributionParams(item, account, language);
  const response = await fetch(
    `${OFF_BASE}/cgi/product_jqm2.pl?${params.toString()}`,
  );
  const body = (await response.json()) as {
    status?: number;
    status_verbose?: string;
  };
  if (body.status !== 1) {
    throw new Error(body.status_verbose || "Upload failed");
  }
}

/** FoodData Central nutrient ids -> nutrition keys (as NutriTrace) */
const USDA_NUTRIENTS: Record<number, string | undefined> = {
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
};

const USDA_TYPE_PRIORITY: Record<string, number | undefined> = {
  Foundation: 1,
  "SR Legacy": 2,
  "Survey (FNDDS)": 3,
  Branded: 4,
  Experimental: 5,
};

export interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: {
    nutrientId?: number;
    nutrient?: { id?: number };
    value?: number;
    amount?: number;
  }[];
}

/** A USDA food, normalised to per 100 g */
export function mapUsdaFood(food: UsdaFood): ExternalFood {
  const servingSize = food.servingSize;
  const factor = servingSize && servingSize > 0 ? 100 / servingSize : 1;
  const nutrition: Nutrition = {};
  const values: Record<string, number | undefined> = {};
  for (const entry of food.foodNutrients ?? []) {
    const id = entry.nutrientId ?? entry.nutrient?.id;
    const key = id == null ? undefined : USDA_NUTRIENTS[id];
    const raw = entry.value ?? entry.amount;
    if (key && raw != null) {
      values[key] = Math.round(raw * factor * 10000) / 10000;
    }
  }
  for (const [key, value] of Object.entries(values)) nutrition[key] = value;
  if (values.calories && !values.kilojoules) {
    nutrition.kilojoules = Math.round(values.calories * 4.184 * 10) / 10;
  }
  deriveSodiumSalt(nutrition);
  // "Carbohydrate, by difference" includes fiber; OFF's number doesn't.
  if (values.carbohydrates != null && values.fiber != null) {
    const corrected = Math.max(
      values.carbohydrates - values.fiber,
      values.sugars ?? 0,
    );
    nutrition.carbohydrates = Math.round(corrected * 10000) / 10000;
  }
  const unit = (food.servingSizeUnit ?? "g").toLowerCase();
  return {
    name: (food.description ?? "").trim(),
    brand: (food.brandOwner || food.brandName || "").trim(),
    barcode: food.gtinUpc || (food.fdcId ? `fdcId_${food.fdcId}` : ""),
    serving_size: 100,
    serving_unit: unit === "ml" ? "ml" : "g",
    img_url: "",
    nutrition,
    dataType: food.dataType ?? null,
  };
}

/** Curated tiers above manufacturer-submitted Branded entries */
export function rankUsdaResults(items: ExternalFood[]): ExternalFood[] {
  const rank = (food: ExternalFood) =>
    USDA_TYPE_PRIORITY[food.dataType ?? ""] ?? 99;
  return [...items].sort((a, b) => rank(a) - rank(b));
}

export async function usdaSearch(
  query: string,
  apiKey: string,
  page = 1,
): Promise<ExternalFood[]> {
  const trimmed = query.trim();
  if (!apiKey || !trimmed) return [];
  try {
    const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(trimmed)}&pageSize=20&pageNumber=${page}&api_key=${encodeURIComponent(apiKey)}`;
    const data = await viaProxy<{ foods?: UsdaFood[] }>(url);
    return rankUsdaResults(
      (data.foods ?? []).map(mapUsdaFood).filter((food) => food.name),
    );
  } catch (error) {
    ignoreFailure(error, "usda");
    return [];
  }
}

/** Branded foods by UPC */
export async function usdaLookupBarcode(
  barcode: string,
  apiKey: string,
): Promise<ExternalFood | null> {
  if (!apiKey || !barcode) return null;
  try {
    const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=10&api_key=${encodeURIComponent(apiKey)}`;
    const data = await viaProxy<{ foods?: UsdaFood[] }>(url);
    const match = (data.foods ?? []).find(
      (food) =>
        food.gtinUpc === barcode ||
        (Boolean(food.gtinUpc) && food.gtinUpc === barcode.replace(/^0+/, "")),
    );
    return match ? mapUsdaFood(match) : null;
  } catch (error) {
    ignoreFailure(error, "usda");
    return null;
  }
}

/** The connected NutriTrace's foods; "not enabled" (503) is no results */
export async function ntSearch(query: string): Promise<ExternalFood[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const data = await api.ct.get<ExternalFood[]>("/nt/foods", {
      query: { q: trimmed },
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    ignoreFailure(error, "nt-foods");
    return [];
  }
}

/** OFF completeness buckets of the quality filter */
export const OFF_TIERS = ["hi", "mid", "lo", "unknown"] as const;
export const USDA_TIERS = [
  "Foundation",
  "SR Legacy",
  "Survey (FNDDS)",
  "Branded",
  "Experimental",
  "unknown",
] as const;

export function offTier(completeness: number | null | undefined): string {
  if (typeof completeness !== "number") return "unknown";
  if (completeness >= 0.7) return "hi";
  return completeness >= 0.4 ? "mid" : "lo";
}

/** The dot beside an OFF result: 85 % and 60 % steps */
export function completenessLevel(value: number): "high" | "mid" | "low" {
  if (value >= 0.85) return "high";
  return value >= 0.6 ? "mid" : "low";
}
