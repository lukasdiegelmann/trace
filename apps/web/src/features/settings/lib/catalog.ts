/** Ported from LiftTrace's components/settings/SettingsCatalog.svelte */

export type CatalogParseError = "invalid" | "notAList" | "empty";

export type CatalogParse =
  { exercises: unknown[] } | { error: CatalogParseError; detail?: string };

/** A custom catalog: a bare array or `{ "exercises": [...] }` */
export function parseCatalogJson(text: string): CatalogParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (caught) {
    return {
      error: "invalid",
      detail: caught instanceof Error ? caught.message : undefined,
    };
  }
  const list = Array.isArray(parsed)
    ? (parsed as unknown[])
    : (parsed as { exercises?: unknown } | null)?.exercises;
  if (!Array.isArray(list)) return { error: "notAList" };
  return list.length === 0
    ? { error: "empty" }
    : { exercises: list as unknown[] };
}

/** "my_push-pull.json" -> "my push pull", at most 60 characters */
export function catalogNameFromFile(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Runs `task` over the items with `size` of them at a time */
export async function inPool<T>(
  items: readonly T[],
  size: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, worker),
  );
}

/**
 * What each exercise source's data is licensed under (Wizard.svelte). The
 * names are not translated; `note` is a key of `catalog.licenseNotes`.
 */
export const SOURCE_LICENSES = {
  wger: { label: "CC-BY-SA 4.0", note: "shareAlike" },
  "free-db": { label: "Public Domain", note: "free" },
  exercisedb: { label: "Commercial", note: "rapidApi" },
  "exercisedb-oss": { label: "AGPL-3.0", note: "community" },
} as const;

export function sourceLicense(
  id: string,
): (typeof SOURCE_LICENSES)[keyof typeof SOURCE_LICENSES] | null {
  return id in SOURCE_LICENSES
    ? SOURCE_LICENSES[id as keyof typeof SOURCE_LICENSES]
    : null;
}
