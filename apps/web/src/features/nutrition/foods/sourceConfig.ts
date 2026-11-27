import { integrationsApi, proxyGet } from "../api";
import {
  searchCooktracePantry,
  searchCooktraceRecipes,
  isCooktraceConfigured,
} from "../lib/sources/cooktrace";
import { isMealieConfigured, searchMealie } from "../lib/sources/mealie";
import { searchOff, type OffOptions } from "../lib/sources/openFoodFacts";
import type { SearchPage } from "../lib/sources/types";
import { searchUsda } from "../lib/sources/usda";
import type { NtSettings } from "../settings";
import {
  ctRecipeEntry,
  externalEntry,
  mealieEntry,
  type Entry,
  type OutsideSource,
  type Tab,
} from "./entries";

export function offOptions(settings: NtSettings): OffOptions {
  return {
    language: settings.offSearchLanguage,
    country: settings.offSearchCountry,
    importPortion: settings.offImportPortion,
  };
}

export const mealieConfig = (settings: NtSettings) => ({
  baseUrl: settings.mealieBaseUrl,
  token: settings.mealieApiToken,
});

export const cooktraceConfig = (settings: NtSettings) => ({
  baseUrl: settings.cooktraceBaseUrl,
  token: settings.cooktraceApiToken,
});

/** The outside sources a tab can search, as the settings switch them on */
export function outsideSources(
  tab: Tab,
  settings: NtSettings,
): OutsideSource[] {
  const sources: OutsideSource[] = [];
  const hasCooktrace =
    settings.cooktraceEnabled &&
    isCooktraceConfigured(cooktraceConfig(settings));
  if (tab === "foods") {
    if (settings.mealieEnabled && isMealieConfigured(mealieConfig(settings))) {
      sources.push("mealie");
    }
    if (hasCooktrace) sources.push("cooktracePantry");
    if (settings.offEnabled) sources.push("off");
    if (settings.usdaEnabled) sources.push("usda");
  }
  if (tab === "recipes" && hasCooktrace) sources.push("cooktrace");
  return sources;
}

/** Page sizes of a source's own list; the "all" view asks for 20 of each */
const PAGE_SIZES: Record<OutsideSource, number> = {
  off: 50,
  usda: 50,
  mealie: 10,
  cooktrace: 25,
  cooktracePantry: 50,
};
export const ALL_PAGE_SIZE = 20;

function mapPage<T>(
  page: SearchPage<T>,
  toEntry: (item: T) => Entry,
): SearchPage<Entry> {
  return { ...page, items: page.items.map(toEntry) };
}

export async function searchSource(
  source: OutsideSource,
  query: string,
  page: number,
  settings: NtSettings,
  isInAll: boolean,
): Promise<SearchPage<Entry>> {
  const size = isInAll ? ALL_PAGE_SIZE : PAGE_SIZES[source];
  switch (source) {
    case "off":
      return mapPage(
        await searchOff(proxyGet, query, page, offOptions(settings), size),
        externalEntry,
      );
    case "usda":
      return mapPage(
        await searchUsda(proxyGet, query, page, settings.usdaApiKey, size),
        externalEntry,
      );
    case "mealie":
      return mapPage(
        await searchMealie(
          integrationsApi.mealie,
          mealieConfig(settings),
          query,
          page,
          size,
        ),
        mealieEntry,
      );
    case "cooktrace":
      return mapPage(
        await searchCooktraceRecipes(
          integrationsApi.cooktrace,
          cooktraceConfig(settings),
          query,
          page,
          size,
        ),
        ctRecipeEntry,
      );
    case "cooktracePantry":
      return mapPage(
        await searchCooktracePantry(
          integrationsApi.cooktrace,
          cooktraceConfig(settings),
          query,
          page,
          size,
        ),
        externalEntry,
      );
  }
}
