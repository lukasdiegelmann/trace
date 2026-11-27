/* eslint-disable @typescript-eslint/naming-convention -- the names of CookTrace's JSON and settings */
/** CookTrace's shopping list (cooktrace/server/routes/shopping.js) */
import { api } from "@/api";

export interface ShoppingItem {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
  checked: boolean;
  pantry_id: number | null;
  recipe_id: number | null;
  recipe_name?: string | null;
  sort_order: number | null;
}

export type ShoppingPatch = Partial<Omit<ShoppingItem, "id">> & {
  /** The row as opened, so the server merges only what changed */
  _base?: ShoppingItem;
};

export interface ShoppingOrder {
  id: number;
  sort_order: number;
  aisle: string | null;
}

export interface FromPlanResult {
  added: number;
  planned_cooks: number;
}

export const shoppingApi = {
  list: () => api.ct.get<ShoppingItem[]>("/shopping"),
  add: (data: ShoppingPatch) => api.ct.post<ShoppingItem>("/shopping", data),
  update: (id: number, data: ShoppingPatch) =>
    api.ct.put<ShoppingItem>(`/shopping/${id}`, data),
  setChecked: (id: number, isChecked: boolean) =>
    api.ct.patch<{ ok: boolean }>(`/shopping/${id}/check`, {
      checked: isChecked,
    }),
  remove: (id: number) => api.ct.delete<{ ok: boolean }>(`/shopping/${id}`),
  clearChecked: () => api.ct.delete<{ ok: boolean }>("/shopping/checked"),
  clearByRecipe: (recipeId: number) =>
    api.ct.delete<{ removed: number }>(`/shopping/by-recipe/${recipeId}`),
  reorder: (items: ShoppingOrder[]) =>
    api.ct.post<{ updated: number }>("/shopping/reorder", { items }),
  fromRecipe: (recipeId: number, shouldOnlyAddMissing: boolean) =>
    api.ct.post<{ added: number }>(
      `/shopping/from-recipe/${recipeId}`,
      {},
      { query: { only_missing: shouldOnlyAddMissing ? undefined : 0 } },
    ),
  fromPlan: (from: string, to: string, shouldOnlyAddMissing: boolean) =>
    api.ct.post<FromPlanResult>(
      "/shopping/from-plan",
      {},
      {
        query: {
          from,
          to,
          only_missing: shouldOnlyAddMissing ? undefined : 0,
        },
      },
    ),
};
