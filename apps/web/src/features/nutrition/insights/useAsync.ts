import { useEffect, useState } from "react";

export interface AsyncState<T> {
  /** The last loaded data; stays while a newer load runs */
  data: T | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * Runs `load` whenever its identity changes (memoise it with `useCallback`);
 * an answer of an older `load` is dropped.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{
    load: () => Promise<T>;
    data: T | undefined;
    error: Error | undefined;
  }>();

  useEffect(() => {
    let isStale = false;
    load().then(
      (data) => {
        if (!isStale) setState({ load, data, error: undefined });
      },
      (caught: unknown) => {
        if (isStale) return;
        const error =
          caught instanceof Error ? caught : new Error(String(caught));
        setState({ load, data: undefined, error });
      },
    );
    return () => {
      isStale = true;
    };
  }, [load]);

  return {
    data: state?.data,
    error: state?.load === load ? state.error : undefined,
    isLoading: state?.load !== load,
  };
}
