/**
 * Recipes read by the AI from a photo, a PDF or extracted text. The old UI
 * (components/recipe/{File,Cookbook}ImportDialog.svelte) let the model
 * call a `create_recipe` tool; the shared client asks one question, so the
 * model answers with one JSON object per recipe in the tool's shape.
 */
import type { IngredientGroup, RecipeInput, RecipeStep } from "../recipesApi";

const SHAPE = `{"name": string, "description"?: string, "servings"?: integer, "yield_text"?: string, "prep_minutes"?: integer, "cook_minutes"?: integer, "ingredients": [{"name": string (group name, "" for the only group), "items": [{"qty"?: string, "unit"?: string, "name": string, "note"?: string}]}], "steps": [{"title"?: string, "text": string}], "tags"?: string[], "tools"?: string[] (kitchen gear), "source_url"?: string, "notes"?: string}`;

const RULES = `- Pull a clean recipe name (drop magazine flourishes, page numbers, chapter labels).
- Ingredients: split into qty / unit / name / note. qty stays a string ("1", "1/2", "1 1/2").
- Steps: numbered. Use a short title only when the source has one.
- Don't fabricate. If a field isn't visible, omit it.
- Answer with JSON only, no commentary, no markdown. Each recipe is one object of this shape:
${SHAPE}`;

export const SINGLE_RECIPE_PROMPT = `You are a recipe-import assistant. The user has attached a recipe (as an image, a PDF or text extracted from a file). Extract it.
- Answer with exactly one recipe object. If the input isn't a recipe or is illegible, answer with a stub named "Imported Recipe" and one step explaining what you saw, so the user can clean it up.
${RULES}`;

export const COOKBOOK_PROMPT = `You are a cookbook-import assistant. The user has attached a cookbook with several recipes. Identify each distinct recipe.
- Answer with one object per recipe, one after the other. If you find 8 recipes, answer with 8 objects.
- Skip sections that are not recipes (introductions, forewords, index, glossary). Never combine recipes.
${RULES}`;

export const PHOTO_PROMPT = "Extract the recipe in this photo.";
export const DOCUMENT_PROMPT = "Extract the recipes in this document.";

export const wrapText = (kind: "RECIPE" | "COOKBOOK", text: string) =>
  `----- BEGIN ${kind} TEXT -----\n${text}\n----- END ${kind} TEXT -----`;

/**
 * Every complete top-level `{…}` in the reply. A reply cut off at the
 * token limit still gives the recipes before the cut.
 */
export function jsonObjects(reply: string): {
  objects: unknown[];
  isCutOff: boolean;
} {
  const objects: unknown[] = [];
  let depth = 0;
  let start = -1;
  let isInString = false;
  for (let i = 0; i < reply.length; i++) {
    const char = reply[i];
    if (isInString) {
      if (char === "\\") i++;
      else if (char === '"') isInString = false;
    } else if (char === '"') {
      if (depth > 0) isInString = true;
    } else if (char === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        try {
          objects.push(JSON.parse(reply.slice(start, i + 1)));
        } catch {
          // not JSON: prose with braces
        }
      }
    }
  }
  return { objects, isCutOff: depth > 0 };
}

const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

const minutes = (value: unknown) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function ingredient(value: unknown) {
  const raw = typeof value === "string" ? { name: value } : record(value);
  return {
    qty: text(raw.qty),
    unit: text(raw.unit),
    name: text(raw.name),
    note: text(raw.note),
  };
}

/** Grouped ingredients; a flat list becomes one unnamed group */
function groups(value: unknown): IngredientGroup[] {
  const entries = list(value);
  const isGrouped = entries.some((entry) => Array.isArray(record(entry).items));
  const raw = isGrouped ? entries.map(record) : [{ name: "", items: entries }];
  return raw
    .map((group) => ({
      name: text(group.name),
      items: list(group.items)
        .map(ingredient)
        .filter((item) => item.name),
    }))
    .filter((group) => group.items.length > 0 || group.name);
}

function step(value: unknown): RecipeStep {
  if (typeof value === "string") return { title: "", text: value.trim() };
  const raw = record(value);
  return { title: text(raw.title), text: text(raw.text) };
}

/** One answered object as a recipe to create; null without a name */
export function toRecipeInput(value: unknown): RecipeInput | null {
  const raw = record(value);
  const name = text(raw.name);
  if (!name || (!raw.ingredients && !raw.steps)) return null;
  const strings = (entry: unknown) => list(entry).map(text).filter(Boolean);
  return {
    name,
    description: text(raw.description) || null,
    servings: minutes(raw.servings),
    yield_text: text(raw.yield_text) || null,
    prep_minutes: minutes(raw.prep_minutes),
    cook_minutes: minutes(raw.cook_minutes),
    ingredients: groups(raw.ingredients),
    steps: list(raw.steps)
      .map(step)
      .filter((entry) => entry.text || entry.title),
    tags: strings(raw.tags),
    tools: strings(raw.tools),
    source_url: text(raw.source_url) || null,
    notes: text(raw.notes) || null,
  };
}

export function recipesFromReply(reply: string): {
  recipes: RecipeInput[];
  isCutOff: boolean;
} {
  const { objects, isCutOff } = jsonObjects(reply);
  // A model may wrap the recipes: {"recipes": [...]}.
  const flat = objects.flatMap((object) => {
    const wrapped = record(object).recipes;
    return Array.isArray(wrapped) ? (wrapped as unknown[]) : [object];
  });
  return {
    recipes: flat.flatMap((entry) => toRecipeInput(entry) ?? []),
    isCutOff,
  };
}
