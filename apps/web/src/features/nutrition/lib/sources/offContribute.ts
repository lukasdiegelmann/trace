/**
 * Contributing a food to Open Food Facts, ported from `contributeToOFF` in
 * nutritrace/src/lib/api.js: the URL the browser calls directly (no proxy)
 * and how to read the answer. The image upload is not ported (the editor
 * never passed an image).
 */
import { parseDecimal } from "../decimal";
import { OFF_BASE } from "./openFoodFacts";

export interface OffContribution {
  name: string;
  barcode: string;
  brand?: string | null;
  portion?: number | string | null;
  unit?: string | null;
  /** Per portion, in our units (sodium in mg) */
  nutrition?: object | null;
}

export interface OffAccount {
  /** The `offUsername` setting */
  username: string;
  /** The `offPassword` setting */
  password: string;
  /** The `offUploadCountry` setting; "Auto" sends none */
  country?: string | null;
}

/** [our id, OFF's nutriment name, factor from our unit to OFF's] */
const UPLOAD_NUTRIENTS: [string, string, number?][] = [
  ["calories", "energy-kcal"],
  ["kilojoules", "energy"],
  ["fat", "fat"],
  ["saturated-fat", "saturated-fat"],
  ["carbohydrates", "carbohydrates"],
  ["sugars", "sugars"],
  ["fiber", "fiber"],
  ["proteins", "proteins"],
  ["salt", "salt"],
  // mg here, grams at OFF
  ["sodium", "sodium", 0.001],
];

/** Null without a name, a barcode or an account */
export function buildOffContributionUrl(
  food: OffContribution,
  account: OffAccount,
  language: string,
): string | null {
  if (!food.name || !food.barcode) return null;
  if (!account.username || !account.password) return null;
  const lang = language.slice(0, 2) || "en";
  const portion = parseDecimal(food.portion) || 0;
  const unit = food.unit || "g";
  const isPer100g = portion === 100 && unit === "g";
  const params: [string, string][] = [
    ["code", food.barcode],
    ["user_id", account.username],
    ["password", account.password],
    ["lang", lang],
    [`product_name_${lang}`, food.name],
  ];
  if (food.brand) params.push(["brands", food.brand]);
  // Tells OFF how to read every nutriment value
  params.push(["nutrition_data_per", isPer100g ? "100g" : "serving"]);
  if (!isPer100g) params.push(["serving_size", `${portion} ${unit}`]);
  if (account.country && account.country !== "Auto") {
    params.push(["countries", account.country]);
  }
  const nutrition = (food.nutrition ?? {}) as Record<string, unknown>;
  for (const [id, field, factor = 1] of UPLOAD_NUTRIENTS) {
    const value = parseDecimal(nutrition[id]);
    if (!Number.isFinite(value)) continue;
    params.push([
      `nutriment_${field}`,
      String(Number((value * factor).toPrecision(12))),
    ]);
  }
  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${OFF_BASE}/cgi/product_jqm2.pl?${query}`;
}

/** The upload answer `{ status: 1 }`; otherwise `status_verbose` says why */
export function isOffUploadAccepted(response: unknown): boolean {
  return (response as { status?: unknown } | null)?.status === 1;
}

export function offProductPageUrl(barcode: string): string {
  return `${OFF_BASE}/product/${encodeURIComponent(barcode)}`;
}
