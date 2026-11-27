import type { Ingredient, IngredientGroup } from "../recipesApi";

export interface LinkedIngredient {
  item: Ingredient;
  /** The same key the ingredient list ticks */
  key: string;
}

/** The ingredients a step names; ids that no longer exist are dropped */
export function linkedIngredients(
  groups: IngredientGroup[],
  refIds: string[] | undefined,
): LinkedIngredient[] {
  if (!refIds?.length) return [];
  const byId = new Map<string, LinkedIngredient>();
  groups.forEach((group, groupIndex) => {
    group.items.forEach((item, itemIndex) => {
      if (item.id) {
        byId.set(item.id, { item, key: `${groupIndex}-${itemIndex}` });
      }
    });
  });
  return refIds.flatMap((id) => byId.get(id) ?? []);
}
