/** Pantry, shopping, cook diary and manage (issue #6), under /cooking */
import type { RouteObject } from "react-router";

const pantryItem = (shouldEdit: boolean) => async () => {
  const { PantryItemPage } = await import("./pantry/PantryItemPage");
  return { element: <PantryItemPage shouldEdit={shouldEdit} /> };
};

const manage = async () => ({
  Component: (await import("./manage/ManagePage")).ManagePage,
});

export const pantryRoutes: RouteObject[] = [
  {
    path: "pantry",
    lazy: async () => ({
      Component: (await import("./pantry/PantryPage")).PantryPage,
    }),
  },
  { path: "pantry/new", lazy: pantryItem(true) },
  { path: "pantry/:id", lazy: pantryItem(false) },
  { path: "pantry/:id/edit", lazy: pantryItem(true) },
  {
    path: "shopping",
    lazy: async () => ({
      Component: (await import("./shopping/ShoppingPage")).ShoppingPage,
    }),
  },
  {
    path: "diary",
    lazy: async () => ({
      Component: (await import("./diary/DiaryPage")).DiaryPage,
    }),
  },
  { path: "manage", lazy: manage },
  { path: "manage/:section", lazy: manage },
];
