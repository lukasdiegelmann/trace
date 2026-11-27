/* eslint-disable @typescript-eslint/naming-convention -- the names of CookTrace's JSON and settings */
/**
 * What the Manage hub edits besides pantry categories: recipe categories,
 * tags, kitchen gear, units and the cookbook catalog.
 */
import { api } from "@/api";

import type { CustomUnit, UnitsOverlay } from "./lib/units";

export interface RecipeCategory {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number | null;
  recipe_count?: number;
}

/** A tag or a piece of kitchen gear: a value used on recipes */
export interface TaxonomyEntry {
  name: string;
  count: number;
}

export type TaxonomyKind = "tags" | "tools";

export interface SmartFilter {
  category_id?: number;
  tags?: string[];
  favorites_only?: boolean;
}

export interface CookbookSummary {
  id: number;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_smart: boolean;
  smart_filter: SmartFilter | null;
  sort_order: number | null;
  recipe_count: number | null;
  synced_at?: string | null;
}

export interface CookbookPatch {
  name?: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_smart?: boolean;
  smart_filter?: SmartFilter;
  _base?: CookbookSummary;
}

/** The fields of `GET /recipes` the pickers show */
export interface RecipeSummary {
  id: number;
  name: string;
  img_url: string | null;
  pantry_match?: { have: number; need: number } | null;
}

export interface CustomUnitPatch {
  abbr: string;
  full_name: string;
  category: string;
  _base?: CustomUnit;
}

export const manageApi = {
  recipes: () => api.ct.get<RecipeSummary[]>("/recipes"),

  recipeCategories: () => api.ct.get<RecipeCategory[]>("/recipes/categories"),
  createRecipeCategory: (data: { name: string; color: string | null }) =>
    api.ct.post<RecipeCategory>("/recipes/categories", data),
  updateRecipeCategory: (
    id: number,
    data: { name: string; color: string | null; _base?: RecipeCategory },
  ) => api.ct.put<RecipeCategory>(`/recipes/categories/${id}`, data),
  removeRecipeCategory: (id: number) =>
    api.ct.delete<{ ok: boolean }>(`/recipes/categories/${id}`),
  reorderRecipeCategories: (ids: number[]) =>
    api.ct.put<{ ok: boolean }>("/recipes/categories/order", { ids }),

  taxonomy: (kind: TaxonomyKind) =>
    api.ct.get<TaxonomyEntry[]>(`/recipes/${kind}`),
  renameTaxonomy: (kind: TaxonomyKind, name: string, next: string) =>
    api.ct.put<{ modified: number }>(
      `/recipes/${kind}/${encodeURIComponent(name)}`,
      { name: next },
    ),
  removeTaxonomy: (kind: TaxonomyKind, name: string) =>
    api.ct.delete<{ modified: number }>(
      `/recipes/${kind}/${encodeURIComponent(name)}`,
    ),

  units: () => api.ct.get<Required<UnitsOverlay>>("/units"),
  setBuiltinUnit: (abbr: string, isDisabled: boolean) =>
    api.ct.patch<{ ok: boolean }>(
      `/units/builtin/${encodeURIComponent(abbr)}`,
      { disabled: isDisabled },
    ),
  createUnit: (data: CustomUnitPatch) =>
    api.ct.post<CustomUnit>("/units", data),
  updateUnit: (id: number, data: CustomUnitPatch) =>
    api.ct.put<CustomUnit>(`/units/${id}`, data),
  removeUnit: (id: number) => api.ct.delete<{ ok: boolean }>(`/units/${id}`),

  cookbooks: () => api.ct.get<CookbookSummary[]>("/cookbooks"),
  createCookbook: (data: CookbookPatch) =>
    api.ct.post<CookbookSummary>("/cookbooks", data),
  updateCookbook: (id: number, data: CookbookPatch) =>
    api.ct.put<CookbookSummary>(`/cookbooks/${id}`, data),
  removeCookbook: (id: number) =>
    api.ct.delete<{ ok: boolean }>(`/cookbooks/${id}`),
  reorderCookbooks: (ids: number[]) =>
    api.ct.put<{ ok: boolean }>("/cookbooks/order", { cookbook_ids: ids }),
};
