/** Browsing an outside recipe opens it in the matching editor */
import type { NavigateFunction } from "react-router";

import { integrationsApi } from "../api";
import type { FoodEditorState, MealEditorState } from "../editorLinks";
import {
  getCooktraceRecipe,
  mapCooktraceRecipe,
} from "../lib/sources/cooktrace";
import { getMealieRecipe, mapMealieRecipe } from "../lib/sources/mealie";
import type { NtSettings } from "../settings";
import type { Entry } from "./entries";
import { cooktraceConfig, mealieConfig } from "./sourceConfig";

export async function importRecipe(
  entry: Entry,
  settings: NtSettings,
  navigate: NavigateFunction,
): Promise<void> {
  if (entry.kind === "mealie") {
    const recipe = await getMealieRecipe(
      integrationsApi.mealie,
      mealieConfig(settings),
      entry.recipe.slug,
    );
    if (!recipe) return;
    const state: FoodEditorState = {
      prefill: mapMealieRecipe(recipe, settings.mealieBaseUrl),
    };
    await navigate("/nutrition/foods/edit", { state });
  }
  if (entry.kind === "ctRecipe") {
    const recipe = await getCooktraceRecipe(
      integrationsApi.cooktrace,
      cooktraceConfig(settings),
      entry.recipe.id,
    );
    if (!recipe) return;
    const state: MealEditorState = { prefill: mapCooktraceRecipe(recipe) };
    await navigate("/nutrition/meals/edit?recipe=1", { state });
  }
}
