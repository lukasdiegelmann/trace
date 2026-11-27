/** Rows for the lib tests */
import type { CookEntry } from "../diaryApi";
import type { PantryCategory, PantryItem } from "../pantryApi";
import type { ShoppingItem } from "../shoppingApi";

export function pantryItem(
  fields: Partial<PantryItem> & Pick<PantryItem, "id" | "name">,
): PantryItem {
  return {
    brand: null,
    barcode: null,
    in_stock: true,
    quantity: null,
    unit: null,
    expires_on: null,
    img_url: null,
    notes: null,
    category: null,
    category_id: null,
    serving_size: null,
    serving_unit: null,
    serving_label: null,
    g_per_cup: null,
    nutrition: {},
    generic_parent_id: null,
    nutrition_source_variant_id: null,
    ...fields,
  };
}

export function pantryCategory(
  fields: Partial<PantryCategory> &
    Pick<PantryCategory, "id" | "name" | "slug">,
): PantryCategory {
  return {
    icon: null,
    color: null,
    default_aisle: null,
    sort_order: fields.id,
    ...fields,
  };
}

export function shoppingItem(
  fields: Partial<ShoppingItem> & Pick<ShoppingItem, "id" | "name">,
): ShoppingItem {
  return {
    quantity: null,
    unit: null,
    aisle: null,
    checked: false,
    pantry_id: null,
    recipe_id: null,
    recipe_name: null,
    sort_order: null,
    ...fields,
  };
}

export function cookEntry(
  fields: Partial<CookEntry> & Pick<CookEntry, "id" | "date">,
): CookEntry {
  return {
    recipe_id: 1,
    kind: "cooked",
    meal_type: null,
    rating: null,
    servings: null,
    notes: null,
    photo_url: null,
    created_at: null,
    recipe_name: "Soup",
    recipe_img_url: null,
    cooked_by_username: null,
    cooked_by_full_name: null,
    ...fields,
  };
}
