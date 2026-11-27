import { appConfigApi, foodsApi, mealsApi, type SharingConfig } from "../api";
import { useResource } from "../useResource";

/** The user's foods, meals and recipes, and what others share with them */
export function useLibrary() {
  const own = useResource("library", async () => {
    const [foods, meals, recipes] = await Promise.all([
      foodsApi.list(),
      mealsApi.list(),
      mealsApi.recipes(),
    ]);
    return {
      foods,
      meals: meals.filter((meal) => !meal.is_recipe),
      recipes,
    };
  });
  const sharing = useResource<SharingConfig>("sharing", () =>
    appConfigApi.sharing(),
  );
  return { own, sharing };
}

/** Others' entries, loaded only once asked for and only while sharing is on */
export function useShared(isWanted: boolean) {
  return useResource(isWanted ? "shared" : null, async () => {
    const [foods, meals, recipes] = await Promise.all([
      foodsApi.shared(),
      mealsApi.shared(),
      mealsApi.sharedRecipes(),
    ]);
    // Rows without an owner name are the user's own
    return {
      foods: foods.filter((row) => row._shared_by),
      meals: meals.filter((row) => row._shared_by),
      recipes: recipes.filter((row) => row._shared_by),
    };
  });
}
