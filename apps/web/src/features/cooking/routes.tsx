import type { RouteObject } from "react-router";

import { CookbookViewPage } from "./cookbooks/CookbookViewPage";
import { pantryRoutes } from "./pantryRoutes";
import { RecipeEditorPage } from "./recipes/editor/RecipeEditorPage";
import { RecipesPage } from "./recipes/RecipesPage";
import { RecipeViewPage } from "./recipes/view/RecipeViewPage";

/** Mounted under /cooking by src/router.tsx */
export const cookingRoutes: RouteObject[] = [
  { index: true, element: <RecipesPage /> },
  { path: "recipes/new", element: <RecipeEditorPage /> },
  { path: "recipes/:id", element: <RecipeViewPage /> },
  { path: "recipes/:id/edit", element: <RecipeEditorPage /> },
  { path: "cookbooks/:id", element: <CookbookViewPage /> },
  ...pantryRoutes,
];
