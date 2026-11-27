import { useCallback, useEffect, useRef, useState } from "react";

import { useNtSettings } from "../settings";
import type { Entry, OutsideSource } from "./entries";
import { searchSource } from "./sourceConfig";

export interface SourceResult {
  items: Entry[];
  page: number;
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const EMPTY: SourceResult = {
  items: [],
  page: 0,
  total: 0,
  hasMore: false,
  isLoading: true,
  error: null,
};

const DEBOUNCE_MS = 400;

export interface ExternalSearch {
  results: Partial<Record<OutsideSource, SourceResult>>;
  isSearching: boolean;
  loadMore: () => void;
}

/**
 * Searches several outside sources at once, each on its own: one failing
 * doesn't stop the others. Answers to an older query are dropped.
 */
export function useExternalSearch(
  sources: OutsideSource[],
  query: string,
  isInAll: boolean,
): ExternalSearch {
  const { settings } = useNtSettings();
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const wanted = debounced.trim();
  const key =
    wanted && sources.length > 0
      ? [
          sources.join(","),
          wanted,
          String(isInAll),
          settings.offSearchCountry,
          settings.offSearchLanguage,
        ].join("|")
      : "";
  const [state, setState] = useState<{
    key: string;
    results: Partial<Record<OutsideSource, SourceResult>>;
  }>({ key: "", results: {} });
  const currentKey = useRef(key);
  const latest = useRef({ settings, sources, wanted, isInAll, state });
  useEffect(() => {
    currentKey.current = key;
    latest.current = { settings, sources, wanted, isInAll, state };
  });

  const fetchPage = useCallback(
    (forKey: string, source: OutsideSource, page: number) => {
      const input = latest.current;
      const update = (change: (before: SourceResult) => SourceResult) => {
        if (currentKey.current !== forKey) return;
        setState((before) =>
          before.key === forKey
            ? {
                key: forKey,
                results: {
                  ...before.results,
                  [source]: change(before.results[source] ?? EMPTY),
                },
              }
            : before,
        );
      };
      update((before) => ({ ...before, isLoading: true, error: null }));
      searchSource(
        source,
        input.wanted,
        page,
        input.settings,
        input.isInAll,
      ).then(
        (result) => {
          update((before) => {
            const known = new Set(before.items.map((entry) => entry.key));
            const added = result.items.filter((entry) => !known.has(entry.key));
            return {
              items: page === 1 ? result.items : [...before.items, ...added],
              page,
              total: result.totalHits,
              // A page of nothing new ends the paging
              hasMore: result.hasMore && (page === 1 || added.length > 0),
              isLoading: false,
              error: null,
            };
          });
        },
        (caught: unknown) => {
          update((before) => ({
            ...before,
            isLoading: false,
            hasMore: false,
            error: caught instanceof Error ? caught.message : String(caught),
          }));
        },
      );
    },
    [],
  );

  useEffect(() => {
    if (!key) return;
    currentKey.current = key;
    const wantedSources = latest.current.sources;
    const start = setTimeout(() => {
      setState({
        key,
        results: Object.fromEntries(
          wantedSources.map((source) => [source, EMPTY]),
        ),
      });
      for (const source of wantedSources) fetchPage(key, source, 1);
    }, 0);
    return () => {
      clearTimeout(start);
    };
  }, [key, fetchPage]);

  const loadMore = useCallback(() => {
    const { state: current } = latest.current;
    for (const [source, result] of Object.entries(current.results)) {
      if (result.hasMore && !result.isLoading) {
        fetchPage(current.key, source as OutsideSource, result.page + 1);
      }
    }
  }, [fetchPage]);

  const isCurrent = state.key === key;
  const results = isCurrent && key ? state.results : {};
  const isSearching =
    (query.trim() !== "" &&
      sources.length > 0 &&
      (query.trim() !== wanted || !isCurrent)) ||
    Object.values(results).some((result) => result.isLoading);
  return { results, isSearching, loadMore };
}
