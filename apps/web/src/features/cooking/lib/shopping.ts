/** The shopping list's merging, grouping and restock (Shopping.svelte) */
import type { PantryCategory, PantryItem, PantryPatch } from "../pantryApi";
import type {
  ShoppingItem,
  ShoppingOrder,
  ShoppingPatch,
} from "../shoppingApi";

export type GroupMode = "aisle" | "recipe" | "flat";

export const NO_AISLE = "__uncat__";
export const NO_RECIPE = "other";

/** A shown row; merged ones carry the real rows as `members` */
export interface ShoppingRow extends ShoppingItem {
  members?: ShoppingItem[];
  recipeNames?: string[];
}

export function asGroupMode(value: string): GroupMode {
  return value === "recipe" || value === "flat" ? value : "aisle";
}

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

function mergeKey(item: ShoppingItem, isByAisle: boolean): string {
  const base = `${normalize(item.name)}|${normalize(item.unit)}|${item.checked ? 1 : 0}`;
  return isByAisle ? `${base}|${(item.aisle ?? "").trim()}` : base;
}

/**
 * Rows with the same name, unit and checked state show as one: quantities
 * summed (unknown if any is unknown), recipe names collected. The database
 * keeps one row per recipe; actions fan out to the members.
 */
export function mergeRows(
  rows: readonly ShoppingItem[],
  isByAisle = false,
): ShoppingRow[] {
  const groups = new Map<string, ShoppingItem[]>();
  for (const row of rows) {
    const key = mergeKey(row, isByAisle);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((members): ShoppingRow => {
    const first = members[0];
    if (members.length === 1) return first;
    const isKnown = members.every((member) => member.quantity != null);
    const quantity = isKnown
      ? Math.round(
          members.reduce((sum, member) => sum + Number(member.quantity), 0) *
            100,
        ) / 100
      : null;
    const recipeNames = [
      ...new Set(
        members
          .map((member) => member.recipe_name)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    return { ...first, quantity, recipeNames, members };
  });
}

export function membersOf(row: ShoppingRow): ShoppingItem[] {
  return row.members ?? [row];
}

export function memberIds(row: ShoppingRow): number[] {
  return membersOf(row).map((member) => member.id);
}

/** Unchecked first, then the saved order, then the name */
export function compareShopping(a: ShoppingItem, b: ShoppingItem): number {
  if (a.checked !== b.checked) return a.checked ? 1 : -1;
  if (a.sort_order != null && b.sort_order != null) {
    return a.sort_order - b.sort_order;
  }
  if (a.sort_order != null) return -1;
  if (b.sort_order != null) return 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export interface ShoppingGroup {
  /** Aisle label or NO_AISLE; recipe id or NO_RECIPE; "all" in flat */
  key: string;
  /** The aisle name or recipe name; null: unnamed (by key) */
  title: string | null;
  aisle: string | null;
  recipeId: number | null;
  rows: ShoppingRow[];
}

/** The groups of the three modes; the unnamed group comes last */
export function groupShopping(
  items: readonly ShoppingItem[],
  mode: GroupMode,
): ShoppingGroup[] {
  if (mode === "flat") {
    const rows = mergeRows([...items].sort(compareShopping));
    return [{ key: "all", title: null, aisle: null, recipeId: null, rows }];
  }
  const groups = new Map<string, ShoppingGroup>();
  for (const item of items) {
    const aisle = (item.aisle ?? "").trim() || null;
    const key =
      mode === "recipe"
        ? item.recipe_id != null
          ? String(item.recipe_id)
          : NO_RECIPE
        : (aisle ?? NO_AISLE);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title: mode === "recipe" ? (item.recipe_name ?? null) : aisle,
        aisle: mode === "aisle" ? aisle : null,
        recipeId: mode === "recipe" ? item.recipe_id : null,
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(item);
  }
  for (const group of groups.values()) {
    group.rows.sort(compareShopping);
    if (mode === "aisle") group.rows = mergeRows(group.rows);
  }
  const isUnnamed = (group: ShoppingGroup) =>
    group.key === NO_AISLE || group.key === NO_RECIPE;
  return [...groups.values()].sort(
    (a, b) =>
      Number(isUnnamed(a)) - Number(isUnnamed(b)) ||
      (a.title ?? "").localeCompare(b.title ?? "", undefined, {
        sensitivity: "base",
      }),
  );
}

/** The rows the progress and "N remaining" count (merged as shown) */
export function displayRows(
  items: readonly ShoppingItem[],
  mode: GroupMode,
): ShoppingRow[] {
  return mode === "recipe" ? [...items] : mergeRows(items, mode === "aisle");
}

/** Category default aisles (else their names) plus aisles in use */
export function knownAisles(
  categories: readonly PantryCategory[],
  items: readonly ShoppingItem[],
): string[] {
  const aisles = new Map<string, string>();
  const add = (raw: string | null | undefined) => {
    const aisle = (raw ?? "").trim();
    if (aisle && !aisles.has(aisle.toLowerCase())) {
      aisles.set(aisle.toLowerCase(), aisle);
    }
  };
  for (const category of categories) {
    add(category.default_aisle || category.name);
  }
  for (const item of items) add(item.aisle);
  return [...aisles.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/**
 * Move a shown row one step in its group: every member gets the new
 * position, and in aisle mode the group's aisle. Checked and unchecked
 * rows don't pass each other (the list sorts them apart).
 */
export function moveShoppingRow(
  group: ShoppingGroup,
  index: number,
  delta: -1 | 1,
  mode: GroupMode,
): ShoppingOrder[] | null {
  const rows = [...group.rows];
  const target = index + delta;
  if (index < 0 || index >= rows.length) return null;
  if (target < 0 || target >= rows.length) return null;
  const row = rows[index];
  const other = rows[target];
  if (row.checked !== other.checked) return null;
  rows[index] = other;
  rows[index + delta] = row;
  return rows.flatMap((entry, position) =>
    membersOf(entry).map((member) => ({
      id: member.id,
      sort_order: position,
      aisle: mode === "aisle" ? group.aisle : member.aisle,
    })),
  );
}

export interface ShoppingEdit {
  name: string;
  quantity: string;
  unit: string;
}

export interface EditPlan {
  updates: { id: number; patch: ShoppingPatch }[];
  removes: number[];
}

/**
 * Saving the edit dialog. A merged row's quantity is a total: changing it
 * folds the rows into the first; otherwise each keeps its own amount and
 * only name and unit change.
 */
export function planEdit(row: ShoppingRow, edit: ShoppingEdit): EditPlan {
  const typed = edit.quantity.trim().replace(",", ".");
  const quantity =
    typed === "" || !Number.isFinite(Number(typed)) ? null : Number(typed);
  const payload = {
    name: edit.name.trim() || row.name,
    quantity,
    unit: edit.unit.trim() || null,
  };
  const members = membersOf(row);
  const [first, ...rest] = members;
  if (rest.length === 0) {
    return {
      updates: [{ id: first.id, patch: { ...payload, _base: first } }],
      removes: [],
    };
  }
  if ((row.quantity ?? null) !== quantity) {
    return {
      updates: [{ id: first.id, patch: { ...payload, _base: first } }],
      removes: rest.map((member) => member.id),
    };
  }
  return {
    updates: members.map((member) => ({
      id: member.id,
      patch: { name: payload.name, unit: payload.unit },
    })),
    removes: [],
  };
}

export interface RestockRow {
  key: string;
  label: string;
  /** Variants to choose from, for a generic */
  options: { id: number; name: string }[] | null;
  selectedId: number;
}

/**
 * What "Clear Checked" offers to mark back in stock. Strict: the row's
 * pantry link, else a name that fits exactly one pantry item. A generic is
 * restocked through a variant (its nutrition source, else the first);
 * anything already in stock is left out.
 */
export function restockRows(
  items: readonly ShoppingItem[],
  pantry: readonly PantryItem[],
): RestockRow[] {
  const byId = new Map(pantry.map((item) => [item.id, item]));
  const byName = new Map<string, PantryItem[]>();
  const children = new Map<number, PantryItem[]>();
  for (const item of pantry) {
    const key = normalize(item.name);
    byName.set(key, [...(byName.get(key) ?? []), item]);
    if (item.generic_parent_id != null) {
      children.set(item.generic_parent_id, [
        ...(children.get(item.generic_parent_id) ?? []),
        item,
      ]);
    }
  }
  const rows: RestockRow[] = [];
  const seen = new Set<string>();
  for (const item of items.filter((entry) => entry.checked)) {
    let target = item.pantry_id != null ? byId.get(item.pantry_id) : undefined;
    if (!target) {
      const matches = byName.get(normalize(item.name)) ?? [];
      if (matches.length === 1) target = matches[0];
    }
    if (!target) continue;
    const variants = [...(children.get(target.id) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    if (variants.length > 0) {
      const key = `g${target.id}`;
      if (seen.has(key) || variants.some((variant) => variant.in_stock)) {
        continue;
      }
      seen.add(key);
      const preferred = variants.find(
        (variant) => variant.id === target.nutrition_source_variant_id,
      );
      rows.push({
        key,
        label: target.name,
        options: variants.map((variant) => ({
          id: variant.id,
          name: variant.brand || variant.name,
        })),
        selectedId: (preferred ?? variants[0]).id,
      });
      continue;
    }
    const key = `p${target.id}`;
    if (seen.has(key) || target.in_stock) continue;
    seen.add(key);
    const parent =
      target.generic_parent_id != null
        ? byId.get(target.generic_parent_id)
        : undefined;
    rows.push({
      key,
      label: parent
        ? `${parent.name}, ${target.brand || target.name}`
        : target.name,
      options: null,
      selectedId: target.id,
    });
  }
  return rows;
}

/** The pantry update that restocks, and the one that undoes it */
export function restockPatch(item: PantryItem): {
  patch: PantryPatch;
  undo: PantryPatch;
} {
  const patch: PantryPatch = { in_stock: 1 };
  const undo: PantryPatch = { in_stock: item.in_stock ? 1 : 0 };
  // At 0 it would still read as out: give it the card button's 1.
  if (item.quantity === 0) {
    patch.quantity = 1;
    undo.quantity = item.quantity;
  }
  return { patch, undo };
}
