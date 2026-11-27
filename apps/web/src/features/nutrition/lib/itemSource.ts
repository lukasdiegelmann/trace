/**
 * Which food, meal or recipe a diary item was logged from: the web half of
 * nutritrace/src/lib/item-source.js.
 */

/**
 * The source row's server id, or null. `food_server_id: null` means logged on
 * a phone before the source was synced, so `id` means nothing here; items
 * without the key are old and their `id` is the server's.
 */
export function sourceRowId(item: {
  id?: unknown;
  food_server_id?: unknown;
}): number | null {
  if (typeof item.food_server_id === "number") return item.food_server_id;
  if (typeof item.id !== "number" || item.food_server_id === null) return null;
  return item.id;
}

/** A food, meal or recipe of the library, as far as its picture needs it */
export interface PicturedSource {
  id: number;
  name: string;
  brand?: string | null;
  img_url?: string | null;
}

interface LoggedItem {
  id?: unknown;
  food_server_id?: unknown;
  name?: string;
  brand?: string | null;
  imgUrl?: string;
}

function brandKey(brand: string | null | undefined): string {
  return (brand ?? "").toLowerCase().trim();
}

/**
 * The picture the source has today, so a re-logged entry doesn't keep a stale
 * one (Foods.svelte `liveImgFor`): by id, then by name and brand, then by name
 * for an entry without a brand, else the entry's own.
 */
export function liveImageFor(
  item: LoggedItem,
  library: readonly PicturedSource[],
): string | undefined {
  const rowId = sourceRowId(item);
  const byId =
    rowId === null ? undefined : library.find((source) => source.id === rowId);
  if (byId?.img_url) return byId.img_url;
  const name = (item.name ?? "").trim();
  if (!name) return item.imgUrl;
  const brand = brandKey(item.brand);
  const pictured = (matches: PicturedSource[]) =>
    matches.find((source) => source.img_url)?.img_url;
  const named = library.filter((source) => source.name === name);
  return (
    pictured(named.filter((source) => brandKey(source.brand) === brand)) ??
    (brand ? undefined : pictured(named)) ??
    item.imgUrl
  );
}
