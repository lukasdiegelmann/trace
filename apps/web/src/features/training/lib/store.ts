/** A minimal external store for React's `useSyncExternalStore` */
export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** localStorage that never throws (private mode, quota, no storage) */
export const safeStorage = {
  /** The stored JSON; the caller says what it expects */
  read(key: string): unknown {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  },
  write(key: string, value: unknown): void {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The value just doesn't survive a reload
    }
  },
};
