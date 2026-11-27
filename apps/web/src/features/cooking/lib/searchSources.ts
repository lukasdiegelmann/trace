/* eslint-disable @typescript-eslint/naming-convention -- the names of CookTrace's JSON and settings */
/** The pantry's source chips (Pantry.svelte, as NutriTrace Foods) */
import type { FoodSource } from "./externalFoods";

export type SearchSource = "local" | "all" | FoodSource;

export interface SourceSettings {
  offEnabled: boolean;
  usdaEnabled: boolean;
  usdaApiKey: string;
  ntFederationEnabled: boolean;
}

export interface SourceSelection {
  source: SearchSource;
  /** Several chips pinned: `source` is "all", limited to these */
  pinned: ReadonlySet<SearchSource>;
}

export function isSourceEnabled(
  source: FoodSource,
  settings: SourceSettings,
): boolean {
  if (source === "off") return settings.offEnabled;
  if (source === "usda") {
    return settings.usdaEnabled && Boolean(settings.usdaApiKey);
  }
  return settings.ntFederationEnabled;
}

/** "All" only when at least two sources are to choose from */
export function availableSources(settings: SourceSettings): SearchSource[] {
  const single: SearchSource[] = [
    "local",
    ...(["off", "usda", "nt"] as const).filter((source) =>
      isSourceEnabled(source, settings),
    ),
  ];
  return single.length >= 2 ? ["all", ...single] : single;
}

/** `pantryDefaultSource`, falling back to the pantry if unavailable */
export function defaultSource(
  setting: string,
  settings: SourceSettings,
): SearchSource {
  const available = availableSources(settings);
  return available.find((source) => source === setting) ?? "local";
}

/** The external sources a query goes to */
export function sourcesToSearch(
  { source, pinned }: SourceSelection,
  settings: SourceSettings,
): FoodSource[] {
  return (["off", "usda", "nt"] as const).filter(
    (candidate) =>
      isSourceEnabled(candidate, settings) &&
      (source === candidate ||
        (source === "all" && (pinned.size === 0 || pinned.has(candidate)))),
  );
}

/** Long press: pin a chip beside the current one, or unpin it */
export function togglePinned(
  selection: SourceSelection,
  value: SearchSource,
): SourceSelection {
  if (value === "all" || value === "local") return selection;
  const pinned = new Set(selection.pinned);
  if (pinned.has(value)) pinned.delete(value);
  else {
    if (
      pinned.size === 0 &&
      selection.source !== "all" &&
      selection.source !== value
    ) {
      pinned.add(selection.source);
    }
    pinned.add(value);
  }
  if (pinned.size > 1) return { source: "all", pinned };
  const source = pinned.size === 1 ? [...pinned][0] : selection.source;
  return { source, pinned: new Set() };
}

/** A quality filter toggle that never hides everything */
export function toggleTier(
  active: ReadonlySet<string>,
  tier: string,
): Set<string> {
  const next = new Set(active);
  if (next.has(tier)) next.delete(tier);
  else next.add(tier);
  if (next.size === 0) next.add(tier);
  return next;
}
