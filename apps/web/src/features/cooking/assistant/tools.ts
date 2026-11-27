/**
 * What the cooking tools do, ported from the tool handler in
 * cooktrace/src/components/ai/Trace.svelte. The results are what the model
 * reads, so their shapes are the old ones.
 */
import type { AssistantTool } from "@/features/shared/ai";

import { announceCookingChange } from "../common/dataChanged";
import { addToCookbook, getCookbook, getCookbooks } from "../cookbooksApi";
import { diaryApi } from "../diaryApi";
import { entryPhotos, type MealType } from "../lib/cookDiary";
import { readImportAnswer } from "../lib/importing";
import { aggregateStock, buildVariantsByParent } from "../lib/pantryVariants";
import { foldText, includesFolded } from "../lib/searchText";
import { pantryApi, type PantryItem } from "../pantryApi";
import { scrapeRecipe } from "../recipes/importers/importApi";
import {
  createRecipe,
  getCategories,
  getRecipe,
  getRecipes,
  logCook,
  type CookInput,
  type IngredientGroup,
  type Recipe,
  type RecipeStep,
} from "../recipesApi";
import { shoppingApi } from "../shoppingApi";

import { COOKING_TOOL_SPECS, type CookingToolName } from "./catalog";

type Args = Record<string, unknown>;

interface Executor {
  /** The error the model reads when a failure says nothing itself */
  fallback: string;
  run: (args: Args) => Promise<unknown>;
}

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

const integer = (value: unknown): number => Number.parseInt(text(value), 10);

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** `category` is the joined row on reads, a slug on legacy rows */
function categoryOf(item: Pick<PantryItem, "category">) {
  return typeof item.category === "object" ? item.category : null;
}

function isInCategory(
  category: { name: string; slug: string } | null,
  wanted: string,
): boolean {
  return (
    foldText(category?.name) === wanted || foldText(category?.slug) === wanted
  );
}

function summariseRecipe(recipe: Recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description || null,
    servings: recipe.servings,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    rest_minutes: recipe.rest_minutes,
    total_minutes:
      recipe.total_minutes ??
      (recipe.prep_minutes || 0) +
        (recipe.cook_minutes || 0) +
        (recipe.rest_minutes || 0),
    rating: recipe.rating,
    favorite: recipe.favorite,
    last_cooked_at: recipe.last_cooked_at,
    cook_count: recipe.cook_count,
    category: recipe.category?.name || null,
    tags: recipe.tags,
    pantry_match: recipe.pantry_match || null,
  };
}

function fullRecipe(recipe: Recipe) {
  return {
    ...summariseRecipe(recipe),
    yield_text: recipe.yield_text,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tools: recipe.tools,
    source_url: recipe.source_url,
    notes: recipe.notes,
    nutrition: recipe.nutrition,
  };
}

const variantShape = (variant: PantryItem) => ({
  id: variant.id,
  brand: variant.brand || null,
  name: variant.name,
  in_stock: Boolean(variant.in_stock),
  quantity: variant.quantity ?? null,
  unit: variant.unit ?? null,
  barcode: variant.barcode || null,
  expires_on: variant.expires_on ?? null,
});

/**
 * Variants ride along under their parent, so "Milk" and its three brands
 * aren't four rows. `in_stock_only` applies after that: a generic with one
 * stocked variant counts, whatever its own row says. That is why stock and
 * name are filtered here and not by `GET /pantry`'s parameters.
 */
async function readPantry(args: Args) {
  const rows = await pantryApi.list();
  const category = foldText(args.category).trim();
  const filtered = rows.filter(
    (row) =>
      includesFolded(row.name, args.query) &&
      (!category || isInCategory(categoryOf(row), category)),
  );
  const variantsByParent = buildVariantsByParent(filtered);
  return filtered
    .filter((row) => row.generic_parent_id == null)
    .map((row) => {
      const variants = variantsByParent.get(row.id) ?? [];
      const { stocked } = aggregateStock(row, variantsByParent);
      // A generic has no expiry of its own: the earliest of its variants.
      const earliest =
        variants
          .flatMap((variant) => variant.expires_on || [])
          .sort()
          .at(0) ?? null;
      return {
        id: row.id,
        name: row.name,
        brand: row.brand || null,
        in_stock: stocked > 0,
        quantity: row.quantity ?? null,
        unit: row.unit ?? null,
        expires_on: row.expires_on ?? earliest,
        category: categoryOf(row)?.name || null,
        serving: row.serving_size
          ? `${row.serving_size} ${row.serving_unit || "g"}`
          : null,
        has_nutrition: Object.keys(row.nutrition ?? {}).length > 0,
        barcode: row.barcode || null,
        notes: row.notes || null,
        ...(variants.length > 0
          ? { variants: variants.map(variantShape) }
          : {}),
      };
    })
    .filter((row) => !args.in_stock_only || row.in_stock);
}

const EXECUTORS: Record<CookingToolName, Executor> = {
  get_recipes: {
    fallback: "Failed",
    run: async (args) => {
      const query = foldText(args.query).trim();
      const category = foldText(args.category).trim();
      const recipes = await getRecipes();
      return recipes
        .filter(
          (recipe) =>
            (!query ||
              [recipe.name, recipe.description, ...recipe.tags].some((value) =>
                foldText(value).includes(query),
              )) &&
            (!category || isInCategory(recipe.category, category)) &&
            (!args.favorite || recipe.favorite),
        )
        .slice(0, 100)
        .map(summariseRecipe);
    },
  },
  list_recipe_categories: {
    fallback: "Failed",
    run: async () => {
      const categories = await getCategories();
      return categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color || null,
        recipe_count:
          (category as { recipe_count?: number }).recipe_count ?? null,
      }));
    },
  },
  list_pantry_categories: {
    fallback: "Failed",
    run: async () => {
      const categories = await pantryApi.categories();
      return categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon || null,
      }));
    },
  },
  get_recipe: {
    fallback: "Not found",
    run: async (args) => fullRecipe(await getRecipe(integer(args.id))),
  },
  get_pantry: { fallback: "Failed", run: readPantry },
  find_recipes_from_pantry: {
    fallback: "Failed",
    run: async (args) => {
      const minRatio = Number.isFinite(args.min_ratio)
        ? (args.min_ratio as number)
        : 0.7;
      const recipes = await getRecipes();
      return recipes
        .map((recipe) => {
          const match = recipe.pantry_match;
          const ratio = match && match.need > 0 ? match.have / match.need : 0;
          return { recipe, ratio };
        })
        .filter(({ ratio }) => ratio >= minRatio)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 30)
        .map(({ recipe, ratio }) => ({
          ...summariseRecipe(recipe),
          pantry_match: recipe.pantry_match || { have: 0, need: 0 },
          ratio: Math.round(ratio * 100) / 100,
        }));
    },
  },
  get_cook_diary: {
    fallback: "Failed",
    run: async (args) => {
      const from = text(args.from);
      const to = text(args.to);
      if (!from || !to) {
        return { error: "from and to are required (YYYY-MM-DD)" };
      }
      const entries = await diaryApi.list(from, to);
      return entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        kind: entry.kind,
        recipe_id: entry.recipe_id,
        recipe_name: entry.recipe_name || null,
        servings: entry.servings,
        meal_type: entry.meal_type || null,
        rating: Number.isFinite(entry.rating) ? entry.rating : null,
        notes: entry.notes || null,
        has_photo: entryPhotos(entry).length > 0,
      }));
    },
  },
  get_shopping_list: {
    fallback: "Failed",
    run: async () => {
      const items = await shoppingApi.list();
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        aisle: item.aisle ?? null,
        checked: item.checked,
        pantry_id: item.pantry_id ?? null,
        recipe_id: item.recipe_id ?? null,
        recipe_name: item.recipe_name ?? null,
      }));
    },
  },
  get_cookbooks: {
    fallback: "Failed",
    run: async () => {
      const cookbooks = await getCookbooks();
      return cookbooks.map((cookbook) => ({
        id: cookbook.id,
        name: cookbook.name,
        slug: (cookbook as { slug?: string }).slug,
        description: cookbook.description,
        recipe_count: cookbook.recipe_count,
        is_smart: cookbook.is_smart,
        smart_filter: cookbook.smart_filter || null,
      }));
    },
  },
  get_cookbook: {
    fallback: "Not found",
    run: async (args) => {
      const cookbook = await getCookbook(integer(args.id));
      return {
        id: cookbook.id,
        name: cookbook.name,
        description: cookbook.description,
        is_smart: cookbook.is_smart,
        smart_filter: cookbook.smart_filter || null,
        // A locked recipe has only its name; the summary's rest stays empty.
        recipes: cookbook.recipes.map((recipe) =>
          summariseRecipe(recipe as Recipe),
        ),
      };
    },
  },

  log_cook: {
    fallback: "Failed",
    run: async (args) => {
      const id = integer(args.recipe_id);
      if (!Number.isFinite(id)) return { error: "recipe_id required" };
      const input: Partial<CookInput> = {};
      if (args.date) input.date = text(args.date);
      if (args.notes) input.notes = text(args.notes);
      if (args.meal_type) input.meal_type = text(args.meal_type) as MealType;
      if (Number.isFinite(args.rating)) input.rating = args.rating as number;
      const recipe = await logCook(id, input);
      announceCookingChange();
      return {
        ok: true,
        recipe: {
          id: recipe.id,
          name: recipe.name,
          cook_count: recipe.cook_count,
          last_cooked_at: recipe.last_cooked_at,
        },
      };
    },
  },
  plan_cook: {
    fallback: "Failed",
    run: async (args) => {
      const id = integer(args.recipe_id);
      const date = text(args.date);
      if (!Number.isFinite(id) || !date) {
        return { error: "recipe_id and date required" };
      }
      const entry = await diaryApi.plan({
        recipe_id: id,
        date,
        notes: text(args.notes) || null,
        meal_type: text(args.meal_type) || null,
      });
      announceCookingChange();
      return { ok: true, entry };
    },
  },
  add_to_shopping: {
    fallback: "Failed",
    run: async (args) => {
      const items = list(args.items) as (Args | null)[];
      if (items.length === 0) return { error: "items array required" };
      const created: { id: number; name: string }[] = [];
      try {
        for (const item of items) {
          if (!item?.name) continue;
          const row = await shoppingApi.add({
            name: text(item.name).trim(),
            quantity: (item.quantity as number | undefined) ?? null,
            unit: text(item.unit) || null,
            aisle: text(item.aisle) || null,
          });
          created.push({ id: row.id, name: row.name });
        }
      } finally {
        // A later item may fail after earlier ones were saved.
        if (created.length > 0) announceCookingChange();
      }
      return { ok: true, added: created.length, items: created };
    },
  },
  add_to_pantry: {
    fallback: "Failed",
    run: async (args) => {
      if (!args.name) return { error: "name required" };
      const row = await pantryApi.create({
        name: text(args.name).trim(),
        in_stock: args.in_stock !== false,
        quantity: (args.quantity as number | undefined) ?? null,
        unit: text(args.unit) || null,
        brand: text(args.brand) || null,
        notes: text(args.notes) || null,
      });
      announceCookingChange();
      return {
        ok: true,
        pantry_item: {
          id: row.id,
          name: row.name,
          in_stock: Boolean(row.in_stock),
        },
      };
    },
  },
  set_pantry_density: {
    fallback: "Failed",
    run: async (args) => {
      const id = integer(args.pantry_id);
      if (!Number.isFinite(id)) return { error: "pantry_id required" };
      const density = args.g_per_cup;
      const next =
        density === null || density === 0 || density === ""
          ? null
          : Number(density);
      if (
        next !== null &&
        (!Number.isFinite(next) || next <= 0 || next > 5000)
      ) {
        return { error: "g_per_cup must be between 0 and 5000" };
      }
      const row = await pantryApi.update(id, { g_per_cup: next });
      announceCookingChange();
      return {
        ok: true,
        pantry_item: {
          id: row.id,
          name: row.name,
          g_per_cup: row.g_per_cup ?? null,
        },
      };
    },
  },
  set_pantry_stock: {
    fallback: "Failed",
    run: async (args) => {
      const id = integer(args.pantry_id);
      if (!Number.isFinite(id)) return { error: "pantry_id required" };
      const row = await pantryApi.setStock(id, Boolean(args.in_stock));
      announceCookingChange();
      // This endpoint answers the new state only, without the row.
      return {
        ok: true,
        pantry_item: { id, in_stock: row.in_stock },
      };
    },
  },
  add_to_cookbook: {
    fallback: "Failed",
    run: async (args) => {
      const cookbookId = integer(args.cookbook_id);
      const ids = list(args.recipe_ids).map(integer).filter(Number.isFinite);
      if (!Number.isFinite(cookbookId) || ids.length === 0) {
        return { error: "cookbook_id and recipe_ids required" };
      }
      const { added } = await addToCookbook(cookbookId, ids);
      announceCookingChange();
      return { ok: true, added };
    },
  },
  import_recipe_from_url: {
    fallback: "Could not import",
    run: async (args) => {
      const url = text(args.url).trim();
      if (!url) return { error: "url required" };
      const answer = await scrapeRecipe(url, {
        addToPantry: args.add_to_pantry !== false,
        applyTags: args.apply_tags === true,
        importCategories: true,
      });
      const read = readImportAnswer(answer);
      if (read.kind === "duplicate") {
        // Already in the library: say which one, there's no new recipe.
        return { ok: true, skipped: true, existing_id: read.existingId };
      }
      announceCookingChange();
      const recipe = answer as Recipe;
      return {
        ok: true,
        recipe: {
          id: recipe.id,
          name: recipe.name,
          source_url: recipe.source_url,
        },
      };
    },
  },
  create_recipe: {
    fallback: "Failed",
    run: async (args) => {
      if (!args.name) return { error: "name required" };
      if (!Array.isArray(args.ingredients)) {
        return { error: "ingredients required" };
      }
      if (!Array.isArray(args.steps)) return { error: "steps required" };
      const recipe = await createRecipe({
        name: text(args.name),
        description: text(args.description) || null,
        servings: (args.servings as number | undefined) || null,
        yield_text: text(args.yield_text) || null,
        prep_minutes: (args.prep_minutes as number | undefined) || null,
        cook_minutes: (args.cook_minutes as number | undefined) || null,
        ingredients: args.ingredients as IngredientGroup[],
        steps: args.steps as RecipeStep[],
        tags: list(args.tags) as string[],
        tools: list(args.tools) as string[],
        source_url: text(args.source_url) || null,
        notes: text(args.notes) || null,
      });
      announceCookingChange();
      return { ok: true, recipe: { id: recipe.id, name: recipe.name } };
    },
  },
};

async function runExecutor(
  { fallback, run }: Executor,
  args: Args,
): Promise<unknown> {
  try {
    return await run(args);
  } catch (caught) {
    return {
      error: (caught instanceof Error && caught.message) || fallback,
    };
  }
}

export function cookingTools(): AssistantTool[] {
  return COOKING_TOOL_SPECS.map((spec) => ({
    ...spec,
    run: (args) => runExecutor(EXECUTORS[spec.name], args),
  }));
}
