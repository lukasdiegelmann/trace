import { useCallback, useEffect, useRef, useState } from "react";

export interface Loaded<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  /** Loads again; the old data stays on screen meanwhile */
  reload: () => Promise<void>;
  setData: (data: T) => void;
}

interface State<T> {
  key: string;
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

/**
 * Server state for a screen: `useLoad(() => api.nt.get(...), [id])`. New
 * deps start empty, and an answer that arrives after they changed is
 * dropped.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly (string | number | boolean | null | undefined)[],
): Loaded<T> {
  const key = JSON.stringify(deps);
  const empty: State<T> = { key, data: null, error: null, isLoading: true };
  const [stored, setStored] = useState<State<T>>(empty);
  const state = stored.key === key ? stored : empty;
  const loader = useRef(load);
  const generation = useRef(0);
  useEffect(() => {
    loader.current = load;
  });

  const run = useCallback(async (forKey: string) => {
    const mine = ++generation.current;
    const patch = (next: Partial<State<T>>) => {
      setStored((previous) => ({
        ...(previous.key === forKey
          ? previous
          : { key: forKey, data: null, error: null, isLoading: true }),
        ...next,
      }));
    };
    await Promise.resolve();
    if (mine !== generation.current) return;
    patch({ isLoading: true });
    try {
      const data = await loader.current();
      if (mine === generation.current) {
        patch({ data, error: null, isLoading: false });
      }
    } catch (caught) {
      if (mine === generation.current) {
        patch({ error: toError(caught), isLoading: false });
      }
    }
  }, []);

  useEffect(() => {
    void run(key);
  }, [key, run]);

  const reload = useCallback(() => run(key), [key, run]);
  const setData = useCallback(
    (data: T) => {
      setStored({ key, data, error: null, isLoading: false });
    },
    [key],
  );

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reload,
    setData,
  };
}
