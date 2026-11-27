/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON shapes */
/** The cookbook calls of the cooking feature (server/routes/cookbooks.js) */
import { api } from "@/api";

import type { SmartFilter } from "./lib/smartCookbook";
import type { KitchenShareResult, Recipe } from "./recipesApi";

export interface Cookbook {
  id: number;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_smart: boolean;
  smart_filter: SmartFilter | null;
  recipe_count: number;
  synced_at?: string | null;
  shared_with_me?: boolean;
  shared_by?: string | null;
  via_kitchen_name?: string | null;
}

/** A recipe in a cookbook; one not shared with the viewer shows only its name */
export type CookbookRecipe = (Recipe & { locked?: false }) | LockedRecipe;

export interface LockedRecipe {
  id: number;
  name: string;
  locked: true;
}

export type CookbookDetail = Cookbook & {
  recipes: CookbookRecipe[];
  can_edit: boolean;
};

export interface CookbookGrant {
  user_id: number;
  username: string;
  full_name: string | null;
  via_kitchen_name: string | null;
}

export const getCookbooks = () => api.ct.get<Cookbook[]>("/cookbooks");

export const getSharedCookbooks = () =>
  api.ct.get<Cookbook[]>("/cookbooks/shared-with-me");

export const getCookbook = (id: number) =>
  api.ct.get<CookbookDetail>(`/cookbooks/${id}`);

export const setCookbookCover = (cookbook: Cookbook, url: string | null) =>
  api.ct.put<Cookbook>(`/cookbooks/${cookbook.id}`, {
    name: cookbook.name,
    description: cookbook.description,
    cover_image_url: url,
  });

export const deleteCookbook = (id: number) => api.ct.delete(`/cookbooks/${id}`);

export const addToCookbook = (id: number, recipeIds: number[]) =>
  api.ct.post<{ added: number }>(`/cookbooks/${id}/recipes`, {
    recipe_ids: recipeIds,
  });

export const removeFromCookbook = (id: number, recipeId: number) =>
  api.ct.delete(`/cookbooks/${id}/recipes/${recipeId}`);

export const orderCookbookRecipes = (id: number, recipeIds: number[]) =>
  api.ct.put(`/cookbooks/${id}/recipes/order`, { recipe_ids: recipeIds });

export const getCookbooksForRecipe = (recipeId: number) =>
  api.ct.get<{ id: number }[]>(`/cookbooks/by-recipe/${recipeId}`);

export const getCookbookShares = (id: number) =>
  api.ct.get<CookbookGrant[]>(`/cookbooks/${id}/shares`);

export const shareCookbook = (id: number, userId: number) =>
  api.ct.post(`/cookbooks/${id}/shares`, { user_ids: [userId] });

export const unshareCookbook = (id: number, userId: number) =>
  api.ct.delete(`/cookbooks/${id}/shares/${userId}`);

export const shareCookbookWithKitchen = (
  kitchenId: number,
  cookbookId: number,
) =>
  api.ct.post<KitchenShareResult>(`/kitchens/${kitchenId}/share-cookbook`, {
    cookbook_id: cookbookId,
  });
