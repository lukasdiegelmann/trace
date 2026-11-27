import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  /** The first load of this key is under way */
  isLoading: boolean;
  /** Asks again; what is shown stays until the answer is there */
  reload: () => Promise<void>;
  setData: (update: (current: T) => T) => void;
}

interface Held<T> {
  key: string | null;
  data?: T;
  error: unknown;
}

/** Server state of one screen: loaded when `key` changes, null loads nothing */
export function useResource<T>(
  key: string | null,
  load: () => Promise<T>,
): Resource<T> {
  const [held, setHeld] = useState<Held<T>>({ key: null, error: null });
  const loader = useRef(load);
  const currentKey = useRef(key);
  const asked = useRef(0);
  useEffect(() => {
    loader.current = load;
  });

  const reload = useCallback(async () => {
    const forKey = currentKey.current;
    if (forKey === null) return;
    const question = ++asked.current;
    try {
      const data = await loader.current();
      if (question === asked.current) {
        setHeld({ key: forKey, data, error: null });
      }
    } catch (error) {
      if (question !== asked.current) return;
      setHeld((previous) => ({
        key: forKey,
        data: previous.key === forKey ? previous.data : undefined,
        error,
      }));
    }
  }, []);

  useEffect(() => {
    currentKey.current = key;
    void reload();
  }, [key, reload]);

  const setData = useCallback((update: (current: T) => T) => {
    setHeld((previous) =>
      previous.data === undefined
        ? previous
        : { ...previous, data: update(previous.data) },
    );
  }, []);

  const isCurrent = key !== null && held.key === key;
  return {
    data: isCurrent ? held.data : undefined,
    error: isCurrent ? held.error : null,
    isLoading: key !== null && !isCurrent,
    reload,
    setData,
  };
}
