import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  /** undefined until the first answer for this key */
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  /** Loads again; what is on screen stays until the answer is in */
  reload: () => void;
  /** Changes the loaded data in place (optimistic updates) */
  mutate: (change: (data: T) => T) => void;
}

interface State<T> {
  key: string;
  data: T | undefined;
  error: Error | null;
  /** The request that was answered last */
  settled: number;
}

/**
 * One request per `key` (and per reload). Only the newest request writes,
 * so a slow answer never replaces a newer one.
 */
export function useResource<T>(
  key: string,
  load: () => Promise<T>,
): Resource<T> {
  const [round, setRound] = useState(0);
  const [state, setState] = useState<State<T>>({
    key,
    data: undefined,
    error: null,
    settled: -1,
  });
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    let isCurrent = true;
    loader.current().then(
      (data) => {
        if (isCurrent) setState({ key, data, error: null, settled: round });
      },
      (caught: unknown) => {
        if (!isCurrent) return;
        const error =
          caught instanceof Error ? caught : new Error(String(caught));
        setState((previous) => ({
          key,
          data: previous.key === key ? previous.data : undefined,
          error,
          settled: round,
        }));
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [key, round]);

  const reload = useCallback(() => {
    setRound((value) => value + 1);
  }, []);
  const mutate = useCallback((change: (data: T) => T) => {
    setState((previous) =>
      previous.data === undefined
        ? previous
        : { ...previous, data: change(previous.data) },
    );
  }, []);

  const isCurrentKey = state.key === key;
  return {
    data: isCurrentKey ? state.data : undefined,
    error: isCurrentKey ? state.error : null,
    isLoading: !isCurrentKey || state.settled !== round,
    reload,
    mutate,
  };
}
