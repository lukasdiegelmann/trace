import { useEffect, useState } from "react";

import {
  ntSearch,
  offSearch,
  usdaSearch,
  type ExternalFood,
  type FoodSource,
  type OffPreferences,
} from "../lib/externalFoods";

export const SEARCH_DEBOUNCE_MS = 350;

export type ExternalResults = Record<FoodSource, ExternalFood[]>;

const NONE: ExternalResults = { off: [], usda: [], nt: [] };

/** The chosen external sources for a query, in parallel, debounced */
export function useExternalSearch(
  query: string,
  sources: readonly FoodSource[],
  { language, country }: OffPreferences,
  usdaApiKey: string,
): { results: ExternalResults; isSearching: boolean } {
  const trimmed = query.trim();
  const wanted = trimmed ? sources.join(",") : "";
  const key = wanted
    ? JSON.stringify([trimmed, wanted, language, country, usdaApiKey])
    : "";
  const [answer, setAnswer] = useState<{
    key: string;
    results: ExternalResults;
  }>({ key: "", results: NONE });

  useEffect(() => {
    if (!key) return;
    let isStale = false;
    const timer = setTimeout(() => {
      const has = (source: FoodSource) => wanted.split(",").includes(source);
      const search = async () => {
        const [off, usda, nt] = await Promise.all([
          has("off") ? offSearch(trimmed, { language, country }) : [],
          has("usda") ? usdaSearch(trimmed, usdaApiKey) : [],
          has("nt") ? ntSearch(trimmed) : [],
        ]);
        if (!isStale) setAnswer({ key, results: { off, usda, nt } });
      };
      // The sources answer [] on failure; only a lost session rejects.
      search().catch(() => {
        if (!isStale) setAnswer({ key, results: NONE });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [key, wanted, trimmed, language, country, usdaApiKey]);

  const isCurrent = answer.key === key;
  return {
    results: key && isCurrent ? answer.results : NONE,
    isSearching: Boolean(key) && !isCurrent,
  };
}
