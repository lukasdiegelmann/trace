import type { ApiClient } from "@/api";

/** How long a change waits for the next one before it goes (the old UIs' 600 ms) */
export const SAVE_DELAY_MS = 600;

export type SettingsStatus = "idle" | "loading" | "ready" | "error";

export interface SettingsSnapshot<S extends object> {
  /** The server's values, this device's values and the defaults, merged */
  values: S;
  status: SettingsStatus;
  /** The last failed load or save */
  error: Error | null;
}

export interface SettingsStoreOptions<S extends object> {
  client: ApiClient;
  defaults: S;
  /** Keys that go to `PUT /api/settings`; the others stay on this device */
  syncedKeys: ReadonlySet<keyof S>;
  /** Where device-only keys live (localStorage in the app) */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** Whether the backend has `PUT /api/settings/bulk` (nt, ct; lt hasn't) */
  hasBulk?: boolean;
  saveDelayMs?: number;
}

export interface SettingsStore<S extends object> {
  getSnapshot: () => SettingsSnapshot<S>;
  subscribe: (listener: () => void) => () => void;
  /** Loads once; later calls return the same promise until `reload` */
  ensureLoaded: () => Promise<void>;
  /** `GET /api/settings` again; values with an unsent change stay */
  reload: () => Promise<void>;
  get: <K extends keyof S>(key: K) => S[K];
  /** Shows the value at once and sends it after SAVE_DELAY_MS */
  set: <K extends keyof S>(key: K, value: S[K]) => void;
  /** Several keys in one request (the Wizard's `bulkSet`) */
  setMany: (values: Partial<S>) => Promise<void>;
  /** Sends every waiting change now (before a sign-out) */
  flush: () => Promise<void>;
}

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

/**
 * The settings of one backend, compatible with the old UI's
 * `src/stores/settings.js`: the same keys and JSON values in
 * `/api/settings`, the same split into synced keys and device-only keys,
 * the same debounce per key.
 */
export function createSettingsStore<S extends object>(
  options: SettingsStoreOptions<S>,
): SettingsStore<S> {
  const {
    client,
    defaults,
    syncedKeys,
    storage = null,
    hasBulk = client.backend !== "lt",
    saveDelayMs = SAVE_DELAY_MS,
  } = options;
  const storagePrefix = `trace.settings.${client.backend}.`;
  const listeners = new Set<() => void>();
  const timers = new Map<keyof S, ReturnType<typeof setTimeout>>();
  const waiting = new Map<keyof S, unknown>();

  let server: Record<string, unknown> = {};
  let snapshot: SettingsSnapshot<S> = {
    values: merge(),
    status: "idle",
    error: null,
  };
  let loading: Promise<void> | null = null;

  function isSynced(key: keyof S): boolean {
    return syncedKeys.has(key);
  }

  function readDevice(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!storage) return out;
    for (const key of Object.keys(defaults) as (keyof S & string)[]) {
      if (isSynced(key)) continue;
      try {
        const raw = storage.getItem(storagePrefix + key);
        if (raw !== null) out[key] = JSON.parse(raw) as unknown;
      } catch {
        // unreadable or blocked storage: the default stays
      }
    }
    return out;
  }

  function merge(): S {
    const values: Record<string, unknown> = { ...defaults, ...readDevice() };
    for (const [key, value] of Object.entries(server)) {
      if (!isSynced(key as keyof S) && key in defaults) continue;
      values[key] = value;
    }
    for (const [key, value] of waiting) values[key as string] = value;
    return values as S;
  }

  function publish(patch: Partial<SettingsSnapshot<S>>): void {
    snapshot = { ...snapshot, values: merge(), ...patch };
    for (const listener of listeners) listener();
  }

  async function load(): Promise<void> {
    publish({ status: "loading" });
    try {
      server =
        (await client.get<Record<string, unknown> | undefined>("/settings")) ??
        {};
      publish({ status: "ready", error: null });
    } catch (caught) {
      publish({ status: "error", error: toError(caught) });
      throw caught;
    }
  }

  function ensureLoaded(): Promise<void> {
    loading ??= load().catch(() => {
      // The error is in the snapshot; a later reload may try again.
    });
    return loading;
  }

  function reload(): Promise<void> {
    loading = load().catch(() => {});
    return loading;
  }

  async function send(key: keyof S, value: unknown): Promise<void> {
    timers.delete(key);
    try {
      const answer = await client.put<{ value?: unknown } | undefined>(
        "/settings",
        { key, value },
      );
      // lt answers with the value that won (newer-wins.js); nt and ct with ok.
      const stays =
        answer && "value" in answer && answer.value !== undefined
          ? answer.value
          : value;
      if (waiting.get(key) === value) waiting.delete(key);
      server = { ...server, [key]: stays };
      publish({ error: null });
    } catch (caught) {
      if (waiting.get(key) === value) waiting.delete(key);
      publish({ error: toError(caught) });
    }
  }

  function set<K extends keyof S>(key: K, value: S[K]): void {
    if (!isSynced(key)) {
      try {
        storage?.setItem(storagePrefix + String(key), JSON.stringify(value));
      } catch {
        // full or blocked storage: the value lasts for this session only
      }
      if (!storage) waiting.set(key, value);
      publish({});
      return;
    }
    waiting.set(key, value);
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => void send(key, value), saveDelayMs),
    );
    publish({});
  }

  async function setMany(values: Partial<S>): Promise<void> {
    const entries = Object.entries(values).filter(
      ([, value]) => value !== undefined,
    ) as [keyof S & string, unknown][];
    const synced: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      if (isSynced(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
        waiting.set(key, value);
        synced[key] = value;
      } else {
        set(key, value as S[typeof key]);
      }
    }
    publish({});
    const keys = Object.keys(synced) as (keyof S & string)[];
    if (keys.length === 0) return;
    try {
      if (hasBulk) {
        await client.put("/settings/bulk", { settings: synced });
        server = { ...server, ...synced };
        for (const key of keys) {
          if (waiting.get(key) === synced[key]) waiting.delete(key);
        }
        publish({ error: null });
      } else {
        await Promise.all(keys.map((key) => send(key, synced[key])));
      }
    } catch (caught) {
      for (const key of keys) {
        if (waiting.get(key) === synced[key]) waiting.delete(key);
      }
      publish({ error: toError(caught) });
      throw caught;
    }
  }

  async function flush(): Promise<void> {
    const pending = [...timers.keys()];
    for (const key of pending) clearTimeout(timers.get(key));
    await Promise.all(pending.map((key) => send(key, waiting.get(key))));
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ensureLoaded,
    reload,
    get: (key) => snapshot.values[key],
    set,
    setMany,
    flush,
  };
}
