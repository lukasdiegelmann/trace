/**
 * The recipe editor's state and what is saved from it, ported from
 * cooktrace/src/routes/RecipeEditor.svelte.
 */
import type { Recipe, RecipeInput, RecipeStep } from "../recipesApi";

import { normaliseQtyForUnit } from "./qty";

export interface DraftIngredient {
  id: string;
  qty: string;
  unit: string;
  name: string;
  note: string;
  pantry_item_id?: number;
}

export interface DraftGroup {
  /** Only for React: stays with the group while it is edited */
  key: string;
  name: string;
  items: DraftIngredient[];
}

export interface DraftStep {
  key: string;
  title: string;
  text: string;
  refIds: string[];
  imgUrl: string;
}

export interface EditorState {
  name: string;
  description: string;
  imgUrl: string;
  rating: number | null;
  yieldText: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  restMinutes: string;
  totalMinutes: string;
  ingredientGroups: DraftGroup[];
  steps: DraftStep[];
  tags: string[];
  tools: string[];
  categoryId: number | null;
  /** As editable markers; stored as HTML */
  notes: string;
  videoUrl: string;
  sourceUrl: string;
  nutrition: Record<string, string>;
}

export function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ing_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export const blankIngredient = (): DraftIngredient => ({
  id: newId(),
  qty: "",
  unit: "",
  name: "",
  note: "",
});

export const blankStep = (): DraftStep => ({
  key: newId(),
  title: "",
  text: "",
  refIds: [],
  imgUrl: "",
});

const blankGroup = (): DraftGroup => ({
  key: newId(),
  name: "",
  items: [blankIngredient()],
});

export function emptyState(servings: number): EditorState {
  return {
    name: "",
    description: "",
    imgUrl: "",
    rating: null,
    yieldText: "",
    servings: String(servings || 2),
    prepMinutes: "",
    cookMinutes: "",
    restMinutes: "",
    totalMinutes: "",
    ingredientGroups: [blankGroup()],
    steps: [blankStep()],
    tags: [],
    tools: [],
    categoryId: null,
    notes: "",
    videoUrl: "",
    sourceUrl: "",
    nutrition: {},
  };
}

const asText = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** `notes` comes converted to markers (lib/richText) */
export function stateOf(recipe: Recipe, notes: string): EditorState {
  const groups = recipe.ingredients.map((group) => ({
    key: newId(),
    name: group.name || "",
    items: group.items.map((item) => ({
      id: item.id || newId(),
      qty: item.qty ?? "",
      unit: item.unit ?? "",
      name: item.name || "",
      note: item.note ?? "",
      ...(item.pantry_item_id === undefined
        ? {}
        : { pantry_item_id: item.pantry_item_id }),
    })),
  }));
  const steps = recipe.steps.map((step) => {
    const raw: RecipeStep = typeof step === "string" ? { text: step } : step;
    return {
      key: newId(),
      title: raw.title ?? "",
      text: raw.text ?? "",
      refIds: raw.refIds ?? [],
      imgUrl: raw.imgUrl ?? "",
    };
  });
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    imgUrl: recipe.img_url ?? "",
    rating: recipe.rating,
    yieldText: recipe.yield_text ?? "",
    servings: String(recipe.servings || 2),
    prepMinutes: asText(recipe.prep_minutes),
    cookMinutes: asText(recipe.cook_minutes),
    restMinutes: asText(recipe.rest_minutes),
    totalMinutes: asText(recipe.total_minutes),
    ingredientGroups: groups.length ? groups : [blankGroup()],
    steps: steps.length ? steps : [blankStep()],
    tags: [...recipe.tags],
    tools: [...recipe.tools],
    categoryId: recipe.category_id,
    notes,
    videoUrl: recipe.video_url ?? "",
    sourceUrl: recipe.source_url ?? "",
    nutrition: Object.fromEntries(
      Object.entries(recipe.nutrition)
        // "_derived" (an object) is the server's note, not a value.
        .flatMap(([key, value]) =>
          typeof value === "number" ? [[key, String(value)]] : [],
        ),
    ),
  };
}

const wholeNumber = (value: string) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(0, number) : null;
};

/** What the total shows while its field is empty */
export function autoTotal(state: EditorState): number {
  return [state.prepMinutes, state.cookMinutes, state.restMinutes].reduce(
    (sum, value) => sum + (wholeNumber(value) ?? 0),
    0,
  );
}

/**
 * The save: trimmed, empty rows and steps dropped (named sections stay),
 * step links to removed ingredients pruned, only positive nutrients.
 * `notesHtml` is the notes converted back to HTML.
 */
export function toRecipeInput(
  state: EditorState,
  notesHtml: string,
): RecipeInput {
  const ingredients = state.ingredientGroups
    .map((group) => ({
      name: group.name.trim(),
      items: group.items
        .map((item) => ({
          id: item.id,
          qty: item.qty.trim(),
          unit: item.unit.trim(),
          name: item.name.trim(),
          note: item.note.trim(),
          ...(item.pantry_item_id === undefined
            ? {}
            : { pantry_item_id: item.pantry_item_id }),
        }))
        .filter((item) => item.name),
    }))
    .filter((group) => group.items.length > 0 || group.name);
  const ids = new Set(
    ingredients.flatMap((group) => group.items.map((item) => item.id)),
  );
  const steps = state.steps
    .map((step) => {
      const refIds = step.refIds.filter((id) => ids.has(id));
      return {
        title: step.title.trim(),
        text: step.text.trim(),
        ...(refIds.length ? { refIds } : {}),
        ...(step.imgUrl ? { imgUrl: step.imgUrl } : {}),
      };
    })
    .filter((step) => step.title || step.text || step.imgUrl);
  const clean = (list: string[]) =>
    list.map((entry) => entry.trim()).filter(Boolean);
  const nutrition = Object.fromEntries(
    Object.entries(state.nutrition)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0),
  );
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    img_url: state.imgUrl || null,
    rating: state.rating,
    yield_text: state.yieldText.trim() || null,
    servings: wholeNumber(state.servings) || null,
    prep_minutes: wholeNumber(state.prepMinutes),
    cook_minutes: wholeNumber(state.cookMinutes),
    rest_minutes: wholeNumber(state.restMinutes),
    total_minutes: wholeNumber(state.totalMinutes),
    ingredients,
    steps,
    tags: clean(state.tags),
    tools: clean(state.tools),
    category_id: state.categoryId,
    nutrition,
    source_url: state.sourceUrl.trim() || null,
    video_url: state.videoUrl.trim() || null,
    notes: notesHtml || null,
  };
}

/* ── Ingredient rows and sections ─────────────────────────── */

export interface RowAt {
  group: number;
  item: number;
}

export function updateIngredient(
  groups: DraftGroup[],
  at: RowAt,
  patch: Partial<DraftIngredient>,
): DraftGroup[] {
  return groups.map((group, g) =>
    g === at.group
      ? {
          ...group,
          items: group.items.map((item, i) => {
            if (i !== at.item) return item;
            const next = { ...item, ...patch };
            // "0.25" becomes "1/4" once a fraction unit is chosen.
            return "unit" in patch
              ? { ...next, qty: normaliseQtyForUnit(next.qty, next.unit) }
              : next;
          }),
        }
      : group,
  );
}

export function unlinkIngredient(
  groups: DraftGroup[],
  at: RowAt,
): DraftGroup[] {
  return groups.map((group, g) =>
    g === at.group
      ? {
          ...group,
          items: group.items.map((item, i) => {
            if (i !== at.item) return item;
            const unlinked = { ...item };
            delete unlinked.pantry_item_id;
            return unlinked;
          }),
        }
      : group,
  );
}

/** The last row of the only unnamed section comes back empty */
export function removeIngredient(
  groups: DraftGroup[],
  at: RowAt,
): DraftGroup[] {
  return groups.map((group, g) => {
    if (g !== at.group) return group;
    const items = group.items.filter((_, i) => i !== at.item);
    return {
      ...group,
      items:
        items.length === 0 && groups.length === 1 && !group.name
          ? [blankIngredient()]
          : items,
    };
  });
}

/** Rows from this one on become a new section; an empty head goes */
export function splitSection(
  groups: DraftGroup[],
  at: RowAt,
  name: string,
): DraftGroup[] {
  return groups.flatMap((group, g) => {
    if (g !== at.group) return [group];
    const head = group.items.slice(0, at.item);
    const tail = {
      key: newId(),
      name,
      items: group.items.slice(at.item),
    };
    return head.length ? [{ ...group, items: head }, tail] : [tail];
  });
}

/** Its rows join the section before it (the first: after it) */
export function removeSection(
  groups: DraftGroup[],
  index: number,
): DraftGroup[] {
  if (groups.length === 1) {
    return [
      {
        ...groups[0],
        name: "",
        items: groups[0].items.length ? groups[0].items : [blankIngredient()],
      },
    ];
  }
  const into = index === 0 ? 1 : index - 1;
  const moved = groups[index].items;
  return groups.flatMap((group, g) => {
    if (g === index) return [];
    if (g !== into) return [group];
    return [
      {
        ...group,
        items:
          index === 0 ? [...moved, ...group.items] : [...group.items, ...moved],
      },
    ];
  });
}

/** One place up (-1) or down (1), across section borders */
export function moveIngredient(
  groups: DraftGroup[],
  at: RowAt,
  direction: -1 | 1,
): DraftGroup[] {
  const next = groups.map((group) => ({ ...group, items: [...group.items] }));
  const items = next[at.group].items;
  const target = at.item + direction;
  if (target >= 0 && target < items.length) {
    [items[at.item], items[target]] = [items[target], items[at.item]];
    return next;
  }
  const other = at.group + direction;
  if (other < 0 || other >= next.length) return groups;
  const [row] = items.splice(at.item, 1);
  if (direction === -1) next[other].items.push(row);
  else next[other].items.unshift(row);
  return next;
}

export function moveEntry<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export interface PantryPick {
  id: number;
  name: string;
  serving_unit: string | null;
}

/** Picked pantry rows go to the last section; a lone blank row gives way */
export function addFromPantry(
  groups: DraftGroup[],
  picks: PantryPick[],
): DraftGroup[] {
  const rows = picks.map((pick) => ({
    ...blankIngredient(),
    unit: pick.serving_unit ?? "",
    name: pick.name,
    pantry_item_id: pick.id,
  }));
  return groups.map((group, g) => {
    if (g !== groups.length - 1) return group;
    const [only] = group.items;
    const isBlank =
      group.items.length === 1 && !only.name && !only.qty && !only.unit;
    return { ...group, items: [...(isBlank ? [] : group.items), ...rows] };
  });
}

/* ── Drafts ───────────────────────────────────────────────── */

export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const draftKey = (id: number | null) =>
  `ct:recipeEditDraft:${id ?? "new"}`;

export interface Draft {
  v: 1;
  ts: number;
  state: EditorState;
}

/** A stored draft younger than two weeks, else null */
export function readDraft(stored: unknown, now = Date.now()): Draft | null {
  const draft = stored as Partial<Draft> | null;
  if (!draft?.state || typeof draft.ts !== "number") return null;
  if (now - draft.ts > DRAFT_MAX_AGE_MS) return null;
  return draft as Draft;
}

/** Only what the form shows decides whether there is something to keep */
export function isSameState(a: EditorState, b: EditorState): boolean {
  const comparable = (state: EditorState) =>
    JSON.stringify(state, (key, value: unknown) =>
      key === "key" || key === "id" ? undefined : value,
    );
  return comparable(a) === comparable(b);
}
