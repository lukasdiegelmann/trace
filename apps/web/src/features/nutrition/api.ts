/**
 * NutriTrace's JSON as the backend sends it, and typed calls for it. Shapes
 * after nutritrace/server/routes/{diary,foods,meals,activity,fasts,settings}.js
 * at the submodule commit in deploy/SSO.md. Screens call these, never
 * `api.nt` directly, so the shapes live in one place.
 */
/* eslint-disable @typescript-eslint/naming-convention -- the backend's keys */
import { api } from "@/api";

import type { GoalEntry } from "./lib/goalResolver";
import type { AltUnit } from "./lib/units";

const nt = api.nt;

// ── Shared ──────────────────────────────────────────────────────────────

/** Nutrient id → value; `calories` in kcal. `_derived` flags auto-filled sodium/salt */
export interface NutritionMap {
  [nutrientId: string]: number | undefined;
}

export type Visibility = "private" | "group" | "specific";

// ── Diary ───────────────────────────────────────────────────────────────

export interface DiaryItem {
  uuid: string;
  /** Index into the `mealNames` setting */
  meal: number;
  /** ISO time it was logged */
  addedAt: string;
  updatedAt?: string;
  type?: "quick_calories";
  /** Food or meal id it came from */
  id?: number;
  food_server_id?: number | null;
  is_recipe?: 0 | 1 | boolean;
  name: string;
  brand?: string;
  portion?: number;
  unit?: string;
  /** Servings; nutrition × quantity is what was eaten */
  quantity?: number;
  /** Per `portion`, pre-scaled */
  nutrition: NutritionMap;
  notes?: string;
  imgUrl?: string;
  source?: string;
  source_meal_id?: number;
  /** A recipe split into its ingredients */
  _splitItems?: DiaryItem[];
  /** Recipe ingredients carried by a logged recipe */
  items?: MealItem[];
  // Read-only, hydrated by the server from the food
  nutrition_basis?: "g" | "ml" | null;
  alt_units?: AltUnit[] | string | null;
  density_g_ml?: number | null;
  category?: string | null;
  barcode?: string | null;
}

export interface WaterLog {
  uuid: string;
  /** ml */
  amount: number;
  /** Localised clock time as the old UI wrote it, e.g. "8:30 AM" */
  time: string;
  updatedAt?: string;
}

export interface BodyStats {
  weight?: number | string | null;
  weight_unit?: "kg" | "lb";
  body_fat?: number | string | null;
  body_water?: number | string | null;
  neck?: number | string | null;
  waist?: number | string | null;
  hips?: number | string | null;
  chest?: number | string | null;
  thighs?: number | string | null;
  biceps?: number | string | null;
  calves?: number | string | null;
  lengths_unit?: "in" | "cm";
}

export interface Tombstone {
  kind: "item" | "water";
  uuid: string;
  deleted_at: string;
}

export interface DiaryDay {
  id?: number;
  date: string;
  items: DiaryItem[];
  body_stats: BodyStats;
  water: WaterLog[];
  notes: string;
  notes_updated_at?: string | null;
  /** SQLite UTC `YYYY-MM-DD HH:MM:SS`, null while open */
  completed_at: string | null;
  completed_meals: number[];
  tombstones?: Tombstone[];
  updated_at?: string;
}

/** `PUT /api/diary/:date`: the server merges by uuid and deletes only what is named */
export interface DiaryWrite {
  items: DiaryItem[];
  body_stats: BodyStats;
  water: WaterLog[];
  notes: string;
  deleted_uuids: { items: string[]; water: string[] };
}

export const diaryApi = {
  day: (date: string) => nt.get<DiaryDay>(`/diary/${date}`),
  all: () => nt.get<DiaryDay[]>("/diary"),
  save: (date: string, body: DiaryWrite) =>
    nt.put<DiaryDay>(`/diary/${date}`, body),
  setCompletion: (date: string, isCompleted: boolean) =>
    nt.put<{ ok: true; date: string; completed_at: string | null }>(
      `/diary/${date}/completion`,
      { completed: isCompleted },
    ),
  setMealCompletion: (date: string, slot: number, isCompleted: boolean) =>
    nt.put<{ ok: true; date: string; completed_meals: number[] }>(
      `/diary/${date}/meal-completion`,
      { slot, completed: isCompleted },
    ),
};

// ── Foods ───────────────────────────────────────────────────────────────

export interface FoodRow {
  id: number;
  user_id: number | null;
  name: string;
  brand: string | null;
  nutrition: NutritionMap;
  portion: number;
  unit: string;
  img_url: string | null;
  notes: string | null;
  category: string | null;
  barcode: string | null;
  created_at: string;
  visibility: Visibility;
  source_id: number | null;
  source_app: string | null;
  source_external_id: string | null;
  source_url: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  favorite: 0 | 1;
  usage_count: number;
  last_used_at: string | null;
  nutrition_basis: "g" | "ml" | null;
  alt_units: AltUnit[] | null;
  density_g_ml: number | null;
  _specific_users?: number[];
  _shared_by?: string | null;
}

export interface FoodWrite {
  name: string;
  brand?: string | null;
  nutrition?: NutritionMap;
  portion?: number;
  unit?: string;
  /** data: URL or http(s) URL is stored to /uploads; "" clears on PUT */
  img_url?: string | null;
  notes?: string | null;
  category?: string | null;
  barcode?: string | null;
  visibility?: Visibility;
  favorite?: boolean;
  nutrition_basis?: "g" | "ml" | null;
  alt_units?: AltUnit[] | null;
  density_g_ml?: number | null;
  source_id?: number;
  source_app?: string;
  source_external_id?: string;
  source_url?: string;
  client_key?: string;
}

export const foodsApi = {
  list: () => nt.get<FoodRow[]>("/foods"),
  /** Foods others share with this user, with `_shared_by` */
  shared: () => nt.get<FoodRow[]>("/foods", { query: { group: 1 } }),
  get: (id: number) => nt.get<FoodRow>(`/foods/${id}`),
  create: (food: FoodWrite) => nt.post<FoodRow>("/foods", food),
  update: (id: number, food: Partial<FoodWrite>) =>
    nt.put<FoodRow>(`/foods/${id}`, food),
  remove: (id: number) => nt.delete<{ ok: true }>(`/foods/${id}`),
  copy: (id: number) => nt.post<FoodRow>(`/foods/${id}/copy`, {}),
  markUsed: (id: number, date: string) =>
    nt.post<{ ok: true }>(`/foods/${id}/used`, { date }),
  share: (id: number, visibility: Visibility, userIds?: number[]) =>
    nt.patch<FoodRow>(`/foods/${id}/share`, {
      visibility,
      user_ids: userIds,
    }),
};

// ── Meals and recipes ───────────────────────────────────────────────────

/** An ingredient inside a meal: a snapshot of a food or meal, nutrition for its whole amount */
export interface MealItem {
  id?: number;
  name: string;
  brand?: string | null;
  portion: number;
  unit: string;
  quantity?: number;
  nutrition: NutritionMap;
  barcode?: string | null;
  imgUrl?: string;
  is_recipe?: boolean | 0 | 1;
  nutrition_basis?: "g" | "ml" | null;
  alt_units?: AltUnit[] | null;
  density_g_ml?: number | null;
  [field: string]: unknown;
}

export interface MealRow {
  id: number;
  user_id: number | null;
  name: string;
  /** Meal: totals; recipe: per serving */
  nutrition: NutritionMap;
  items: MealItem[];
  img_url: string | null;
  notes: string | null;
  is_recipe: boolean;
  portion: number;
  unit: string;
  servings: number | null;
  created_at: string;
  visibility: Visibility;
  source_id: number | null;
  source_app: string | null;
  source_external_id: string | null;
  source_url: string | null;
  import_warnings?: string[];
  updated_at: string | null;
  deleted_at: string | null;
  favorite: 0 | 1;
  usage_count: number;
  last_used_at: string | null;
  _specific_users?: number[];
  _shared_by?: string | null;
}

export interface MealWrite {
  name: string;
  nutrition?: NutritionMap;
  items?: MealItem[];
  img_url?: string | null;
  notes?: string | null;
  is_recipe?: boolean;
  portion?: number;
  unit?: string;
  servings?: number | null;
  visibility?: Visibility;
  favorite?: boolean;
  source_id?: number;
  source_app?: string;
  source_external_id?: string;
  source_url?: string;
  import_warnings?: string[];
  client_key?: string;
}

export const mealsApi = {
  list: () => nt.get<MealRow[]>("/meals"),
  recipes: () => nt.get<MealRow[]>("/meals", { query: { recipes: 1 } }),
  shared: () => nt.get<MealRow[]>("/meals", { query: { group: 1 } }),
  sharedRecipes: () =>
    nt.get<MealRow[]>("/meals", { query: { group: 1, recipes: 1 } }),
  get: (id: number) => nt.get<MealRow>(`/meals/${id}`),
  create: (meal: MealWrite) => nt.post<MealRow>("/meals", meal),
  update: (id: number, meal: Partial<MealWrite>) =>
    nt.put<MealRow>(`/meals/${id}`, meal),
  remove: (id: number) => nt.delete<{ ok: true }>(`/meals/${id}`),
  copy: (id: number) => nt.post<MealRow>(`/meals/${id}/copy`, {}),
  markUsed: (id: number, date: string) =>
    nt.post<{ ok: true }>(`/meals/${id}/used`, { date }),
  share: (id: number, visibility: Visibility, userIds?: number[]) =>
    nt.patch<MealRow>(`/meals/${id}/share`, {
      visibility,
      user_ids: userIds,
    }),
};

export interface SharingConfig {
  sharing_enabled: boolean;
  foods: number;
  meals: number;
  recipes: number;
}

export const appConfigApi = {
  sharing: () => nt.get<SharingConfig>("/app-config/sharing"),
  envLocks: () => nt.get<Record<string, unknown>>("/app-config/env-locks"),
};

/** `POST /api/upload` (multipart `file`, 10 MB) → `/uploads/...` */
export function uploadImage(file: Blob, name = "image.jpg") {
  const form = new FormData();
  form.append("file", file, name);
  return nt.post<{ url: string }>("/upload", form);
}

/**
 * A third-party JSON API through the backend's allowlisted proxy
 * (Open Food Facts, USDA); `live` skips the local OFF mirror
 */
export function proxyGet<T>(url: string, isLive = false) {
  return nt.get<T>("/proxy", { query: { url, live: isLive ? 1 : undefined } });
}

/** `/nt/uploads/...` for what the backend stores as `/uploads/...` */
export function assetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return `/nt${url}`;
  return url;
}

// ── Activity ────────────────────────────────────────────────────────────

export type ActivitySource =
  "manual_form" | "ai_estimated" | "user_stated" | "compendium";

export interface ActivityRow {
  id: number;
  date: string;
  name: string;
  kcal: number;
  duration_min: number | null;
  distance: string | null;
  source: ActivitySource;
  met: number | null;
  is_template: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface ActivityWrite {
  date: string;
  name: string;
  kcal: number;
  duration_min: number | null;
  distance: string | null;
  source: ActivitySource;
  met: number | null;
  is_template: boolean;
}

export type ActivityPolicy = "wearable_wins" | "manual_wins" | "additive";

export interface ActivitySum {
  date: string;
  manual: number;
  wearable: number;
  effective: number;
  policy: ActivityPolicy;
}

export const activityApi = {
  day: (date: string) => nt.get<ActivityRow[]>(`/activity/${date}`),
  sum: (date: string, policy: ActivityPolicy) =>
    nt.get<ActivitySum>(`/activity/sum/${date}`, { query: { policy } }),
  range: (from: string, to: string) =>
    nt.get<ActivityRow[]>("/activity", { query: { from, to } }),
  create: (activity: ActivityWrite) =>
    nt.post<ActivityRow>("/activity", activity),
  update: (id: number, activity: Partial<ActivityWrite>) =>
    nt.put<ActivityRow>(`/activity/${id}`, activity),
  remove: (id: number) => nt.delete<{ ok: true }>(`/activity/${id}`),
};

// ── Fasting ─────────────────────────────────────────────────────────────

export interface Fast {
  id: number;
  start_at: string;
  end_at: string | null;
  goal_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const fastsApi = {
  active: () => nt.get<Fast | null>("/fasts/active"),
  history: (limit = 60) => nt.get<Fast[]>("/fasts", { query: { limit } }),
  start: (goalHours: number, startAt?: string) =>
    nt.post<Fast>("/fasts/start", { goal_hours: goalHours, start_at: startAt }),
  end: (id: number) => nt.post<Fast>(`/fasts/${id}/end`, {}),
  update: (
    id: number,
    changes: Partial<
      Pick<Fast, "start_at" | "end_at" | "goal_hours" | "notes">
    >,
  ) => nt.patch<Fast>(`/fasts/${id}`, changes),
  remove: (id: number) => nt.delete<{ ok: true }>(`/fasts/${id}`),
};

// ── Wellness and goals ──────────────────────────────────────────────────

export interface CaloriesOut {
  calories_out: number | null;
  source: string | null;
  /** The day before the date asked for */
  date: string;
}

export interface AdaptiveTdee {
  ready: boolean;
  daysAvailable: number;
  daysRequired: number;
  windowDays: number;
  tdee: number | null;
  trendKgPerWeek: number | null;
  confidence: number | null;
  weightSource: "wellness" | "manual" | "mixed" | null;
  computedAt: string;
}

/** Metric values by date, then metric type */
export type WellnessByDate = Record<string, Record<string, number>>;

export const wellnessApi = {
  caloriesOut: (date: string) =>
    nt.get<CaloriesOut>("/wellness/calories-out", { query: { date } }),
  latest: (metric: string) =>
    nt.get<{ date: string; value: number; source: string } | null>(
      "/wellness/latest",
      { query: { metric } },
    ),
  fitbitData: (date: string) =>
    nt.get<WellnessByDate>("/wellness/fitbit/data", { query: { date } }),
  garminData: (date: string) =>
    nt.get<WellnessByDate>("/wellness/garmin/data", { query: { date } }),
  adaptiveTdee: () => nt.get<AdaptiveTdee>("/goals/adaptive-tdee"),
};

// ── Settings ────────────────────────────────────────────────────────────

export type Goals = Partial<Record<string, GoalEntry>>;

export const settingsApi = {
  all: () => nt.get<Record<string, unknown>>("/settings"),
  set: (key: string, value: unknown) =>
    nt.put<{ ok: true }>("/settings", { key, value }),
  /** The server proxy for Gotify, ntfy and Apprise (no CORS from here) */
  push: (message: {
    service: string;
    title: string;
    message: string;
    priority: number;
  }) => nt.post<{ ok?: boolean }>("/settings/push-test", message),
};

// ── Integrations (proxied, settings hold the credentials) ───────────────

export const integrationsApi = {
  mealie: <T>(baseUrl: string, token: string, path: string) =>
    nt.post<T>("/mealie/proxy", { baseUrl, token, path }),
  cooktrace: <T>(
    baseUrl: string,
    token: string,
    path: string,
    method = "GET",
    body?: unknown,
  ) => nt.post<T>("/cooktrace/proxy", { baseUrl, token, path, method, body }),
};
