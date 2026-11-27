import { useCallback, useEffect, useRef, useState } from "react";

import { SessionExpiredError } from "@/api";

export interface Loaded<T> {
  /** The last good answer; undefined until the first one */
  data: T | undefined;
  /** The message of the last failed load (a quiet reload says nothing) */
  error: string | null;
  isLoading: boolean;
  /** Loads again; `isQuiet` keeps what's shown while and if it fails */
  reload: (options?: { isQuiet?: boolean }) => Promise<void>;
  /** Changes the shown data in place (optimistic updates) */
  setData: (update: (previous: T) => T) => void;
}

/**
 * Loads on mount and whenever `loader` changes (memoise it). Of two loads
 * at once only the later one's answer counts.
 */
export function useLoad<T>(loader: () => Promise<T>): Loaded<T> {
  const [data, setValue] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sequence = useRef(0);

  const reload = useCallback(
    async ({ isQuiet = false }: { isQuiet?: boolean } = {}) => {
      const current = ++sequence.current;
      if (!isQuiet) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const next = await loader();
        if (current !== sequence.current) return;
        setValue(() => next);
        setError(null);
      } catch (caught) {
        if (current !== sequence.current || isQuiet) return;
        // AuthProvider shows the sign-in page.
        if (caught instanceof SessionExpiredError) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (current === sequence.current) setIsLoading(false);
      }
    },
    [loader],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a load's own states
    void reload();
  }, [reload]);

  const setData = useCallback((update: (previous: T) => T) => {
    setValue((previous) =>
      previous === undefined ? previous : update(previous),
    );
  }, []);

  return { data, error, isLoading, reload, setData };
}
