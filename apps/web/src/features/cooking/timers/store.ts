/** A value with subscribers, kept in localStorage, for useSyncExternalStore */
export interface PersistedStore<T> {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
  /** `isSaved: false` for ticks that only change what is shown */
  set: (value: T, options?: { isSaved?: boolean }) => void;
}

export function persistedStore<T>(
  key: string,
  parse: (stored: unknown) => T,
): PersistedStore<T> {
  const listeners = new Set<() => void>();
  let value = parse(readJson(key));
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next, { isSaved = true } = {}) {
      value = next;
      if (isSaved) writeJson(key, next);
      for (const listener of listeners) listener();
    },
  };
}

export function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // blocked or full storage: the value lasts for this page
  }
}
