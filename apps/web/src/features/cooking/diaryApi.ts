/* eslint-disable @typescript-eslint/naming-convention -- the names of CookTrace's JSON and settings */
/** CookTrace's cook diary (cooktrace/server/routes/cook-diary.js) */
import { api } from "@/api";

export type CookKind = "cooked" | "planned";

export interface CookEntry {
  id: number;
  recipe_id: number | null;
  date: string;
  kind: CookKind;
  meal_type: string | null;
  rating: number | null;
  servings: number | null;
  notes: string | null;
  photo_url: string | null;
  /** A JSON array as text (or already parsed); older rows only photo_url */
  photos?: string | string[] | null;
  created_at: string | null;
  recipe_name: string | null;
  recipe_img_url: string | null;
  cooked_by_username: string | null;
  cooked_by_full_name: string | null;
}

export interface CookStats {
  cooks_this_week: number;
  cooks_this_month: number;
  total_cooks: number;
  top_recipe: { id: number; name: string; count: number } | null;
  current_streak: number;
  longest_streak: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export const diaryApi = {
  list: (from: string, to: string) =>
    api.ct.get<CookEntry[]>("/cook-diary", { query: { from, to } }),
  stats: () => api.ct.get<CookStats>("/cook-diary/stats"),
  heatmap: (days: number) =>
    api.ct.get<HeatmapDay[]>("/cook-diary/heatmap", { query: { days } }),
  plan: (data: {
    recipe_id: number;
    date: string;
    meal_type: string | null;
    notes?: string | null;
  }) => api.ct.post<CookEntry>("/cook-diary", { ...data, kind: "planned" }),
  markCooked: (id: number) =>
    api.ct.put<{ ok: boolean }>(`/cook-diary/${id}`, { kind: "cooked" }),
  remove: (id: number) => api.ct.delete<{ ok: boolean }>(`/cook-diary/${id}`),
};
