/**
 * The `_sync` hint of a save: which copy it was made on and what it
 * changed, so the server merges field by field instead of replacing the
 * row (cooktrace/src/lib/offline-edits.js, server/lib/rest-merge.js).
 */
export const RECIPE_FIELDS = [
  "name",
  "description",
  "ingredients",
  "steps",
  "tags",
  "tools",
  "notes",
  "servings",
  "prep_minutes",
  "cook_minutes",
  "total_minutes",
  "rest_minutes",
  "nutrition",
  "category_id",
  "img_url",
  "source_url",
  "video_url",
  "yield_text",
  "rating",
  "favorite",
  "visibility",
] as const;

export type RecipeField = (typeof RECIPE_FIELDS)[number];

/** Empty, false/true and numeric strings compare as the server stores them */
function normalise(value: unknown): unknown {
  if (value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return value.length ? value : null;
  if (value && typeof value === "object") {
    return Object.keys(value).length ? value : null;
  }
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }
  return value;
}

function stable(value: unknown): string {
  const normal = normalise(value);
  if (Array.isArray(normal)) return `[${normal.map(stable).join(",")}]`;
  if (normal && typeof normal === "object") {
    const record = normal as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(normal);
}

/** The fields the save sends that differ from the copy it was made on */
export function changedFields(
  body: Partial<Record<RecipeField, unknown>>,
  base: Partial<Record<RecipeField, unknown>>,
): RecipeField[] {
  return RECIPE_FIELDS.filter(
    (field) =>
      body[field] !== undefined && stable(body[field]) !== stable(base[field]),
  );
}

export interface SyncHint {
  base_synced_at: string | null;
  changed: string[];
  edited_at: string;
  client_now: string;
}

export function syncHint(
  base: { synced_at?: string | null },
  changed: string[],
  now: Date = new Date(),
): SyncHint {
  return {
    base_synced_at: base.synced_at ?? null,
    changed,
    edited_at: now.toISOString(),
    client_now: now.toISOString(),
  };
}
