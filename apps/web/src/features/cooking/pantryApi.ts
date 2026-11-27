/* eslint-disable @typescript-eslint/naming-convention -- the names of CookTrace's JSON and settings */
/** CookTrace's pantry endpoints (cooktrace/server/routes/pantry.js) */
import { api, ApiError } from "@/api";

import type { Nutrition } from "./lib/nutriments";

/** A category as joined onto a pantry row */
export interface PantryCategoryRef {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

export interface PantryCategory extends PantryCategoryRef {
  default_aisle: string | null;
  sort_order: number | null;
  pantry_count?: number;
}

export interface PantryItem {
  id: number;
  name: string;
  brand: string | null;
  barcode: string | null;
  in_stock: boolean | number;
  quantity: number | null;
  unit: string | null;
  expires_on: string | null;
  img_url: string | null;
  notes: string | null;
  /** The joined row on reads; a slug on legacy rows */
  category: PantryCategoryRef | string | null;
  category_id: number | null;
  serving_size: number | null;
  serving_unit: string | null;
  serving_label: string | null;
  g_per_cup: number | null;
  nutrition: Nutrition | null;
  generic_parent_id: number | null;
  nutrition_source_variant_id: number | null;
  updated_at?: string | null;
  /** On the list only */
  recipe_count?: number;
}

/** What `POST /pantry` and `PUT /pantry/:id` take */
export type PantryPatch = Partial<
  Omit<PantryItem, "id" | "category" | "recipe_count">
> & {
  category?: string | null;
  /** The row as opened, so the server merges only what changed */
  _base?: PantryItem;
};

export interface UsedInRecipe {
  id: number;
  name: string;
  img_url: string | null;
}

export interface PantryCategoryPatch {
  name: string;
  icon?: string | null;
  default_aisle?: string | null;
  _base?: PantryCategory;
}

export const pantryApi = {
  list: () => api.ct.get<PantryItem[]>("/pantry"),
  get: (id: number) => api.ct.get<PantryItem>(`/pantry/${id}`),
  recipes: (id: number) => api.ct.get<UsedInRecipe[]>(`/pantry/${id}/recipes`),
  /** null when no row has this barcode (404) */
  byBarcode: async (code: string): Promise<PantryItem | null> => {
    try {
      return await api.ct.get<PantryItem>(
        `/pantry/by-barcode/${encodeURIComponent(code)}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  create: (data: PantryPatch) => api.ct.post<PantryItem>("/pantry", data),
  update: (id: number, data: PantryPatch) =>
    api.ct.put<PantryItem>(`/pantry/${id}`, data),
  /**
   * A new variant. `POST /pantry` answers an existing top-level row of the
   * same name instead of creating one, variants included (cooktrace
   * server/routes/pantry.js, the dedupe in `POST /`). A variant usually has
   * its parent's name, so it would silently not be created. `PUT` doesn't
   * dedupe: create under a one-off name, then rename.
   */
  createVariant: async (
    data: PantryPatch & { name: string },
  ): Promise<PantryItem> => {
    const created = await pantryApi.create({
      ...data,
      name: `${data.name} (${crypto.randomUUID()})`,
    });
    try {
      return await pantryApi.update(created.id, { name: data.name });
    } catch (error) {
      await pantryApi.remove(created.id).catch(() => undefined);
      throw error;
    }
  },
  setStock: (id: number, isInStock: boolean) =>
    api.ct.patch<{ ok: boolean; in_stock: boolean }>(`/pantry/${id}/stock`, {
      in_stock: isInStock,
    }),
  /** `cascade` removes a generic's variants too, else they become flat */
  remove: (id: number, shouldCascade = false) =>
    api.ct.delete<{ ok: boolean }>(`/pantry/${id}`, {
      query: { cascade: shouldCascade ? 1 : undefined },
    }),
  categories: () => api.ct.get<PantryCategory[]>("/pantry/categories"),
  createCategory: (data: PantryCategoryPatch) =>
    api.ct.post<PantryCategory>("/pantry/categories", data),
  updateCategory: (id: number, data: PantryCategoryPatch) =>
    api.ct.put<PantryCategory>(`/pantry/categories/${id}`, data),
  removeCategory: (id: number) =>
    api.ct.delete<{ ok: boolean }>(`/pantry/categories/${id}`),
  reorderCategories: (ids: number[]) =>
    api.ct.put<{ ok: boolean }>("/pantry/categories/order", { ids }),
};
