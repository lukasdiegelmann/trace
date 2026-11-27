/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON shapes */
/** The recipe calls of the cooking feature (server/routes/recipes.js) */
import { api } from "@/api";

import type { MealType } from "./lib/cookDiary";
import type { Nutrition } from "./lib/nutriments";
import { changedFields, syncHint, type RecipeField } from "./lib/saveHint";

export interface Ingredient {
  id?: string;
  qty?: string;
  unit?: string;
  name: string;
  note?: string;
  pantry_item_id?: number;
}

export interface IngredientGroup {
  name: string;
  items: Ingredient[];
}

export interface RecipeStep {
  title?: string;
  text?: string;
  refIds?: string[];
  imgUrl?: string;
}

export interface RecipeCategory {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

export interface Recipe {
  id: number;
  user_id: number | null;
  name: string;
  description: string | null;
  img_url: string | null;
  servings: number | null;
  yield_text: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  rest_minutes: number | null;
  total_minutes: number | null;
  rating: number | null;
  favorite: boolean;
  ingredients: IngredientGroup[];
  steps: (string | RecipeStep)[];
  tags: string[];
  tools: string[];
  nutrition: Nutrition;
  source_url: string | null;
  video_url: string | null;
  notes: string | null;
  category_id: number | null;
  category: RecipeCategory | null;
  visibility?: string;
  share_token?: string | null;
  synced_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_cooked_at: string | null;
  cook_count: number | null;
  created_by_username?: string | null;
  created_by_full_name?: string | null;
  creator_avatar_url?: string | null;
  last_edited_by_name?: string | null;
  can_edit?: boolean;
  pantry_match?: { have: number; need: number };
  shared_with_me?: boolean;
  shared_by?: string | null;
  via_kitchen_name?: string | null;
}

/** What a create or update sends */
export type RecipeInput = Partial<Pick<Recipe, RecipeField>>;

/** Every step as an object (old rows hold plain strings) */
export function stepsOf(recipe: Pick<Recipe, "steps">): RecipeStep[] {
  return recipe.steps.map((step) =>
    typeof step === "string" ? { title: "", text: step } : step,
  );
}

export const getRecipes = () => api.ct.get<Recipe[]>("/recipes");

export const getSharedRecipes = () =>
  api.ct.get<Recipe[]>("/recipes/shared-with-me");

export const getRecipe = (id: number) => api.ct.get<Recipe>(`/recipes/${id}`);

export const createRecipe = (input: RecipeInput) =>
  api.ct.post<Recipe>("/recipes", input);

/**
 * Saves `input` made on the copy `base`. The server replaces the row with
 * the body, so the whole recipe goes along; the hint says what changed.
 */
export function updateRecipe(
  base: Recipe,
  input: RecipeInput,
  changed: string[] = changedFields(input, base),
) {
  return api.ct.put<Recipe>(`/recipes/${base.id}`, {
    ...base,
    ...input,
    _sync: syncHint(base, changed),
  });
}

export const deleteRecipe = (id: number) => api.ct.delete(`/recipes/${id}`);

/** A copy without the original's history, as the old "Duplicate" makes it */
export function duplicateInput(recipe: Recipe, suffix: string): RecipeInput {
  return {
    name: `${recipe.name} ${suffix}`,
    description: recipe.description,
    img_url: recipe.img_url,
    servings: recipe.servings,
    yield_text: recipe.yield_text,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    rest_minutes: recipe.rest_minutes,
    total_minutes: recipe.total_minutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: recipe.tags,
    tools: recipe.tools,
    nutrition: recipe.nutrition,
    source_url: recipe.source_url,
    video_url: recipe.video_url,
    notes: recipe.notes,
    category_id: recipe.category_id,
    visibility: recipe.visibility,
    favorite: false,
    rating: null,
  };
}

/* ── Taxonomy ─────────────────────────────────────────────── */

export interface NameCount {
  name: string;
  count: number;
}

export const getCategories = () =>
  api.ct.get<RecipeCategory[]>("/recipes/categories");

export const createCategory = (name: string, color: string | null) =>
  api.ct.post<RecipeCategory>("/recipes/categories", { name, color });

export const getTags = () => api.ct.get<NameCount[]>("/recipes/tags");

export const getTools = () => api.ct.get<NameCount[]>("/recipes/tools");

/* ── Versions ─────────────────────────────────────────────── */

export interface RecipeVersion {
  id: number;
  reason: string;
  created_at: string;
  seen: boolean;
  data: Partial<Recipe>;
  edited_by: number | null;
  edited_by_name: string | null;
}

export const getVersions = (id: number) =>
  api.ct.get<RecipeVersion[]>(`/recipes/${id}/versions`);

export const markVersionsSeen = (id: number) =>
  api.ct.post(`/recipes/${id}/versions/seen`, {});

export const restoreVersion = (id: number, versionId: number) =>
  api.ct.post<Recipe>(`/recipes/${id}/versions/${versionId}/restore`, {});

/* ── Cook log ─────────────────────────────────────────────── */

export interface Cook {
  id: number;
  date: string;
  notes: string | null;
  photo_url: string | null;
  photos?: string[];
  created_at: string;
  cooked_by_user_id: number | null;
  cooked_by_username: string | null;
  cooked_by_full_name: string | null;
}

export interface CookInput {
  date: string;
  notes: string | null;
  photos: string[];
  photo_url: string | null;
  meal_type?: MealType | null;
  rating?: number | null;
}

export const getCooks = (id: number) =>
  api.ct.get<Cook[]>(`/recipes/${id}/cooks`);

/** A field left out takes the server's default (the date: today) */
export const logCook = (id: number, input: Partial<CookInput>) =>
  api.ct.post<Recipe>(`/recipes/${id}/cooked`, input);

export const updateCook = (id: number, cookId: number, input: CookInput) =>
  api.ct.put(`/recipes/${id}/cooks/${cookId}`, input);

export const deleteCook = (id: number, cookId: number) =>
  api.ct.delete(`/recipes/${id}/cooks/${cookId}`);

/* ── Comments ─────────────────────────────────────────────── */

export interface RecipeComment {
  id: number;
  parent_id: number | null;
  user_id: number | null;
  body: string;
  created_by_username: string | null;
  created_by_full_name: string | null;
  created_by_avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const getComments = (id: number) =>
  api.ct.get<RecipeComment[]>(`/recipes/${id}/comments`);

export const addComment = (id: number, body: string, parentId: number | null) =>
  api.ct.post<RecipeComment>(`/recipes/${id}/comments`, {
    body,
    parent_id: parentId,
  });

export const editComment = (id: number, commentId: number, body: string) =>
  api.ct.put<RecipeComment>(`/recipes/${id}/comments/${commentId}`, { body });

export const deleteComment = (id: number, commentId: number) =>
  api.ct.delete(`/recipes/${id}/comments/${commentId}`);

/* ── Sharing ──────────────────────────────────────────────── */

export interface Peer {
  id: number;
  name: string;
  username: string;
}

export interface Grant {
  user_id: number;
  username: string;
  granted_at: string;
}

export interface Kitchen {
  id: number;
  name: string;
  member_count: number;
}

export interface KitchenShareResult {
  members: number;
  added: number;
}

export const getPeers = () => api.ct.get<Peer[]>("/recipes/peers");

export const getKitchens = () => api.ct.get<Kitchen[]>("/kitchens");

export const getRecipeShares = (id: number) =>
  api.ct.get<Grant[]>(`/recipes/${id}/shares`);

export const shareRecipe = (id: number, userId: number) =>
  api.ct.post(`/recipes/${id}/shares`, { user_ids: [userId] });

export const unshareRecipe = (id: number, userId: number) =>
  api.ct.delete(`/recipes/${id}/shares/${userId}`);

export const shareRecipeWithKitchen = (kitchenId: number, recipeId: number) =>
  api.ct.post<KitchenShareResult>(`/kitchens/${kitchenId}/share-recipe`, {
    recipe_id: recipeId,
  });

export const createShareToken = (id: number) =>
  api.ct.post<{ share_token: string }>(`/recipes/${id}/share`, {});

export const revokeShareToken = (id: number) =>
  api.ct.delete(`/recipes/${id}/share`);

/** The public link; `web` serves it, no sign-in (router.tsx) */
export const publicRecipeUrl = (
  token: string,
  origin: string = window.location.origin,
) => `${origin}/r/${token}`;

/* ── Other cooking data ───────────────────────────────────── */

export const addMissingToShoppingList = (id: number) =>
  api.ct.post<{ added: number }>(`/shopping/from-recipe/${id}`, {});

export interface PantryRow {
  id: number;
  name: string;
  brand: string | null;
  in_stock: boolean | number;
  serving_unit: string | null;
  serving_size: number | null;
  g_per_cup: number | null;
  nutrition: Nutrition | null;
  nutrition_source_variant_id: number | null;
  generic_parent_id: number | null;
}

export const getPantry = () => api.ct.get<PantryRow[]>("/pantry");

export const setPantryDensity = (id: number, gPerCup: number) =>
  api.ct.put(`/pantry/${id}`, { g_per_cup: gPerCup });
