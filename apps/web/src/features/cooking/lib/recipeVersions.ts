/**
 * What an earlier version of a recipe has that the recipe doesn't, as the
 * parts of the page (cooktrace/src/routes/RecipeView.svelte).
 */
import type { Recipe, RecipeStep } from "../recipesApi";

export const VERSION_PARTS = [
  "title",
  "ingredients",
  "steps",
  "notes",
  "category",
  "photo",
  "nutrition",
  "details",
] as const;
export type VersionPart = (typeof VERSION_PARTS)[number];

const stepText = (step: string | RecipeStep) =>
  (typeof step === "string"
    ? step
    : `${step.title ?? ""}\n${step.text ?? ""}`
  ).trim();

const ingredientText = (groups: Recipe["ingredients"] | undefined) =>
  JSON.stringify(
    (groups ?? []).map((group) => [
      group.name || "",
      group.items.map((item) => [
        item.qty ?? "",
        item.unit ?? "",
        item.name.trim(),
      ]),
    ]),
  );

const isSame = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A picture's address the same however it's written */
function imageKey(url: string | null | undefined): string {
  if (!url) return "";
  const uploads = url.indexOf("/uploads/");
  const path = uploads >= 0 ? url.slice(uploads) : url;
  return path.split(/[?#]/)[0];
}

const nutritionKey = (nutrition: Record<string, unknown> | undefined) =>
  Object.entries(nutrition ?? {})
    .filter(
      ([key, value]) => key !== "_derived" && value !== null && value !== "",
    )
    .sort(([a], [b]) => a.localeCompare(b));

const DETAILS = [
  "description",
  "servings",
  "prep_minutes",
  "cook_minutes",
  "rest_minutes",
  "total_minutes",
  "yield_text",
  "source_url",
  "video_url",
] as const;

export function versionDiffers(
  version: Partial<Recipe>,
  recipe: Recipe,
): VersionPart[] {
  const differs: Record<VersionPart, boolean> = {
    title: (version.name ?? "").trim() !== recipe.name.trim(),
    ingredients:
      ingredientText(version.ingredients) !==
      ingredientText(recipe.ingredients),
    steps: !isSame(
      (version.steps ?? []).map(stepText),
      recipe.steps.map(stepText),
    ),
    notes: (version.notes ?? "") !== (recipe.notes ?? ""),
    category: (version.category_id ?? null) !== (recipe.category_id ?? null),
    photo: imageKey(version.img_url) !== imageKey(recipe.img_url),
    nutrition: !isSame(
      nutritionKey(version.nutrition),
      nutritionKey(recipe.nutrition),
    ),
    details:
      DETAILS.some((key) => (version[key] ?? "") !== (recipe[key] ?? "")) ||
      !isSame(version.tags ?? [], recipe.tags) ||
      !isSame(version.tools ?? [], recipe.tools),
  };
  return VERSION_PARTS.filter((part) => differs[part]);
}
