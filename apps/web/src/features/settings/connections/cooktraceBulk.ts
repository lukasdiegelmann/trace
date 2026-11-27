import { api, ApiError } from "@/api";

import { emptyCount, mapRecipe, type BulkCount } from "../lib/cooktraceImport";

export interface CookTraceConnection {
  baseUrl: string;
  token: string;
}

interface Sourced {
  source_app?: string | null;
  source_external_id?: string | null;
}

const PAGE_SIZE = 50;
/** A server that never runs out must not loop forever */
const MAX_RECIPES = 1000;

export function cooktraceGet<T>(
  connection: CookTraceConnection,
  path: string,
): Promise<T> {
  // The proxy passes CookTrace's 401 on: it isn't the end of this session.
  return api.nt.post<T>(
    "/cooktrace/proxy",
    {
      baseUrl: connection.baseUrl.replace(/\/+$/, ""),
      token: connection.token,
      path,
    },
    { shouldVerify401: true },
  );
}

async function importedIds(path: "/foods" | "/meals"): Promise<Set<string>> {
  try {
    const rows = await api.nt.get<Sourced[]>(path, {
      query: path === "/meals" ? { recipes: 1 } : undefined,
    });
    return new Set(
      rows
        .filter((row) => row.source_app === "cooktrace")
        .map((row) => row.source_external_id ?? ""),
    );
  } catch {
    // Only the summary's "new or updated" count depends on this.
    return new Set();
  }
}

function note(count: BulkCount, caught: unknown): void {
  count.skipped += 1;
  count.firstError ??=
    caught instanceof Error ? caught.message : String(caught);
}

export async function listRecipeIds(
  connection: CookTraceConnection,
): Promise<(string | number)[]> {
  // The old UI searched with an empty query, which returned nothing: page
  // the list itself.
  const ids: (string | number)[] = [];
  for (let offset = 0; offset < MAX_RECIPES;) {
    const page = await cooktraceGet<{
      items?: { id?: string | number }[];
      total?: number;
    }>(connection, `/api/v1/recipes?limit=${PAGE_SIZE}&offset=${offset}`);
    const items = page.items ?? [];
    for (const item of items) {
      if (item.id != null) ids.push(item.id);
    }
    offset += items.length;
    const isDone =
      items.length === 0 ||
      (page.total !== undefined
        ? offset >= page.total
        : items.length < PAGE_SIZE);
    if (isDone) break;
  }
  return ids;
}

export async function importRecipes(
  connection: CookTraceConnection,
  onProgress: (done: number, total: number) => void,
): Promise<BulkCount> {
  const existing = await importedIds("/meals");
  const ids = await listRecipeIds(connection);
  const count = emptyCount();
  onProgress(0, ids.length);
  for (const [index, id] of ids.entries()) {
    try {
      const recipe = await cooktraceGet<Record<string, unknown>>(
        connection,
        `/api/v1/recipes/${encodeURIComponent(String(id))}`,
      );
      const meal = mapRecipe(recipe);
      await api.nt.post("/meals", meal);
      if (existing.has(meal.source_external_id)) count.updated += 1;
      else count.imported += 1;
    } catch (caught) {
      note(count, caught);
    }
    onProgress(index + 1, ids.length);
  }
  return count;
}

/** Why CookTrace refused the pantry, as far as its status tells */
export type PantryRefusal = "scope" | "oldServer" | "token";

export function pantryRefusal(caught: unknown): PantryRefusal | null {
  if (!(caught instanceof ApiError)) return null;
  if (caught.status === 403) return "scope";
  if (caught.status === 404) return "oldServer";
  return caught.status === 401 ? "token" : null;
}

export async function importPantry(
  connection: CookTraceConnection,
  onProgress: (done: number, total: number) => void,
): Promise<BulkCount> {
  // Already shaped for POST /foods; generic parents are left out by CookTrace.
  const { items = [] } = await cooktraceGet<{ items?: Sourced[] }>(
    connection,
    "/api/v1/pantry",
  );
  const existing = await importedIds("/foods");
  const count = emptyCount();
  onProgress(0, items.length);
  for (const [index, food] of items.entries()) {
    try {
      const saved = await api.nt.post<Sourced>("/foods", food);
      // A known barcode returns the old row untouched.
      if (saved.source_external_id !== food.source_external_id) {
        count.collided += 1;
      } else if (existing.has(food.source_external_id ?? "")) {
        count.updated += 1;
      } else {
        count.imported += 1;
      }
    } catch (caught) {
      note(count, caught);
    }
    onProgress(index + 1, items.length);
  }
  return count;
}
