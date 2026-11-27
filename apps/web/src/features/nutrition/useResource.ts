import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  reload: () => void;
  /** Replaces the data without asking the backend, e.g. after a write */
  setData: (data: T) => void;
}

/**
 * Loads `load()` whenever `key` changes; `null` as key loads nothing. An
 * answer that arrives after the key moved on is dropped.
 */
export function useResource<T>(
  key: string | null,
  load: () => Promise<T>,
): Resource<T> {
  const [state, setState] = useState<{
    key: string | null;
    data: T | null;
    error: Error | null;
    done: number;
  }>({ key: null, data: null, error: null, done: -1 });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let isCurrent = true;
    latest.current().then(
      (data) => {
        if (isCurrent) setState({ key, data, error: null, done: attempt });
      },
      (caught: unknown) => {
        const error =
          caught instanceof Error ? caught : new Error(String(caught));
        if (isCurrent) setState({ key, data: null, error, done: attempt });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [key, attempt]);

  const reload = useCallback(() => {
    setAttempt((count) => count + 1);
  }, []);
  const setData = useCallback((data: T) => {
    setState((current) => ({ ...current, data, error: null }));
  }, []);
  const isSameKey = state.key === key;
  return {
    data: isSameKey ? state.data : null,
    error: isSameKey ? state.error : null,
    isLoading: key !== null && (!isSameKey || state.done !== attempt),
    reload,
    setData,
  };
}
