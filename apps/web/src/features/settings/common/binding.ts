import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import type { BackendId } from "@/api";
import {
  settingsStores,
  type BackendSettings,
  type SettingsStore,
} from "@/features/shared/settings";

/** How one backend stores a value that the UI shows in another form */
export interface ValueMap<T> {
  // Method syntax on purpose: a ValueMap<string> fits into a SettingRef.
  fromBackend(raw: unknown): T;
  toBackend(value: T): unknown;
}

/** `["nt", "dateFormat"]`: one backend's key, optionally with a mapping */
export type SettingRef = {
  [B in BackendId]:
    | readonly [B, keyof BackendSettings[B] & string]
    | readonly [B, keyof BackendSettings[B] & string, ValueMap<unknown>];
}[BackendId];

type LooseStore = SettingsStore<Record<string, unknown>>;

export function looseStore(backend: BackendId): LooseStore {
  return settingsStores[backend] as unknown as LooseStore;
}

export function readRef(ref: SettingRef): unknown {
  const [backend, key, map] = ref;
  const raw = looseStore(backend).getSnapshot().values[key];
  return map ? map.fromBackend(raw) : raw;
}

export function writeRef(ref: SettingRef, value: unknown): void {
  const [backend, key, map] = ref;
  looseStore(backend).set(key, map ? map.toBackend(value) : value);
}

/**
 * One control over the same setting in several backends: it shows the first
 * ref's value and writes every ref, so a preference chosen once holds in the
 * whole of Trace while each backend keeps its own key and value form.
 */
export function useShared<T>(
  ...refs: [SettingRef, ...SettingRef[]]
): [T, (value: T) => void] {
  const [first] = refs;
  const store = looseStore(first[0]);
  const backends = refs.map((ref) => ref[0]).join(",");
  useEffect(() => {
    for (const backend of backends.split(",")) {
      void looseStore(backend as BackendId).ensureLoaded();
    }
  }, [backends]);
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  // The refs are literals at the call site; the setter reads the latest.
  const latest = useRef(refs);
  useEffect(() => {
    latest.current = refs;
  });
  const setValue = useCallback((value: T) => {
    for (const ref of latest.current) writeRef(ref, value);
  }, []);
  return [readRef(first) as T, setValue];
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && value !== 0;
}

/**
 * Like useShared, for data each app may have collected on its own (body
 * data): it shows the first ref that has a value, so what only one app
 * knows doesn't look empty. A change is written to every ref.
 */
export function useFirstSet<T>(
  ...refs: [SettingRef, ...SettingRef[]]
): [T, (value: T) => void] {
  const [value, setValue] = useShared<T>(...refs);
  const backends = refs.map((ref) => ref[0]).join(",");
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = backends
        .split(",")
        .map((backend) => looseStore(backend as BackendId).subscribe(listener));
      return () => {
        for (const stop of stops) stop();
      };
    },
    [backends],
  );
  const found = useSyncExternalStore(subscribe, () => {
    const ref = refs.find((candidate) => isSet(readRef(candidate)));
    return ref ? JSON.stringify(readRef(ref)) : "";
  });
  return [found ? (JSON.parse(found) as T) : value, setValue];
}

/** Sends every waiting change of these backends, before the server reads them */
export async function flushSettings(...backends: BackendId[]): Promise<void> {
  await Promise.all(backends.map((backend) => looseStore(backend).flush()));
}

/** The loading and error state of several backends' settings at once */
export function useSettingsState(backends: readonly BackendId[]): {
  failed: BackendId[];
  error: Error | null;
  isLoading: boolean;
  reload: () => void;
} {
  const joined = backends.join(",");
  const list = useMemo(
    () => joined.split(",").filter(Boolean) as BackendId[],
    [joined],
  );
  useEffect(() => {
    for (const backend of list) void looseStore(backend).ensureLoaded();
  }, [list]);
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = list.map((backend) =>
        looseStore(backend).subscribe(listener),
      );
      return () => {
        for (const stop of stops) stop();
      };
    },
    [list],
  );
  // Rerenders when any backend's status or error changes.
  useSyncExternalStore(subscribe, () =>
    list
      .map((backend) => {
        const snapshot = looseStore(backend).getSnapshot();
        return `${backend}:${snapshot.status}:${snapshot.error?.message ?? ""}`;
      })
      .join("|"),
  );
  const snapshots = list.map(
    (backend) => [backend, looseStore(backend).getSnapshot()] as const,
  );
  const broken = snapshots.filter(([, snapshot]) => snapshot.error);
  return {
    failed: broken.map(([backend]) => backend),
    error: broken[0]?.[1].error ?? null,
    isLoading: snapshots.some(
      ([, snapshot]) =>
        snapshot.status === "idle" || snapshot.status === "loading",
    ),
    reload: () => {
      for (const backend of list) void looseStore(backend).reload();
    },
  };
}
