import type { RouteObject } from "react-router";

import { DiaryAlias } from "./diary/DiaryAlias";
import { DiaryPage } from "./diary/DiaryPage";
import { insightRoutes } from "./insights/routes";
import { NutritionLayout } from "./NutritionLayout";

/**
 * Mounted under /nutrition by src/router.tsx:
 *
 * - `/nutrition?date=YYYY-MM-DD`            the diary (NutriTrace's home);
 *   `/nutrition/diary?date=…` leads there too
 * - `/nutrition/foods?tab=foods|meals|recipes`  the library; with
 *   `pick=1&meal=<slot>&date=<day>[&replace=<uuid>]` it picks for the diary
 * - `/nutrition/foods/edit[/:id]`           the food editor
 * - `/nutrition/meals/edit[/:id][?recipe=1]` the meal and recipe editor
 * - `/nutrition/goals`                      goals
 * - `/nutrition/statistics`, `/nutrition/wellness` and their settings
 *   (`insights/routes.ts`)
 *
 * The diary comes with the app; the other screens load when first opened.
 */
export const nutritionRoutes: RouteObject[] = [
  {
    element: <NutritionLayout />,
    children: [
      { index: true, element: <DiaryPage /> },
      { path: "diary", element: <DiaryAlias /> },
      {
        path: "foods",
        lazy: {
          Component: async () => (await import("./foods/FoodsPage")).FoodsPage,
        },
      },
      {
        path: "foods/edit/:id?",
        lazy: {
          Component: async () =>
            (await import("./foodEditor/FoodEditorPage")).FoodEditorPage,
        },
      },
      {
        path: "meals/edit/:id?",
        lazy: {
          Component: async () =>
            (await import("./mealEditor/MealEditorPage")).MealEditorPage,
        },
      },
      {
        path: "goals",
        lazy: {
          Component: async () => (await import("./goals/GoalsPage")).GoalsPage,
        },
      },
      ...insightRoutes,
    ],
  },
];
