/**
 * Drafts of the two editors, ported from nutritrace/src/lib/editor-draft.js
 * (#157, #260), with its keys: text in localStorage, the photo in IndexedDB,
 * gone after four hours. The one-time move of pre-account drafts is not
 * ported.
 */

export const DRAFT_TTL_MS = 4 * 60 * 60 * 1000;
/** Upstream's debounce for persisting while typing */
export const DRAFT_DELAY_MS = 400;

export type DraftKind = "food" | "meal";

/** What identifies a pick that has no id yet */
export interface DraftPrefill {
  name?: string | null;
  brand?: string | null;
  barcode?: string | null;
  source_app?: string | null;
  source_external_id?: string | null;
  mealieSlug?: string | null;
}

/**
 * Null for nothing to tell it apart by. A scan of an unknown barcode (only a
 * barcode) deliberately shares the blank draft (#157).
 */
export function pickIdentity(
  prefill: DraftPrefill | null | undefined,
): string | null {
  if (!prefill) return null;
  if (prefill.source_app && prefill.source_external_id) {
    return `${prefill.source_app}:${prefill.source_external_id}`;
  }
  if (prefill.mealieSlug) return `mealie:${prefill.mealieSlug}`;
  const name = (prefill.name ?? "").trim().toLowerCase();
  if (!name) return null;
  if (prefill.barcode) return `barcode:${prefill.barcode}`;
  return `name:${name}|${(prefill.brand ?? "").trim().toLowerCase()}`;
}

/** `u<id>:` for a signed-in account, "" without one */
export function draftScope(userId: number | string | null | undefined): string {
  return userId === null || userId === undefined || userId === ""
    ? ""
    : `u${userId}:`;
}

/**
 * Work it out once, when the editor opens. `id` is the route's or the
 * prefill's id.
 */
export function draftKey(
  kind: DraftKind,
  id: number | string | null | undefined,
  prefill: DraftPrefill | null = null,
  userId: number | string | null = null,
): string {
  const start = `nt:${draftScope(userId)}${kind}:draft:`;
  if (id != null && id !== "" && id !== "undefined") {
    return `${start}edit:${id}`;
  }
  const pick = pickIdentity(prefill);
  return pick ? `${start}pick:${pick}` : `${start}new`;
}

const DRAFT_KEY = /^nt:(u[^:]*:)?(food|meal):draft:/;

export type DraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

/** Best effort: a failing store resolves quietly */
export interface DraftImageStore {
  put: (key: string, value: unknown) => Promise<void>;
  get: (key: string) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
}

/** The `nt-editor-drafts` database; does nothing without IndexedDB */
export function indexedDbImageStore(): DraftImageStore {
  let opened: Promise<IDBDatabase | null> | null = null;
  const open = () => {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    opened ??= new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = indexedDB.open("nt-editor-drafts", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("imgs");
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = request.onblocked = () => {
          opened = null;
          resolve(null);
        };
      } catch {
        opened = null;
        resolve(null);
      }
    });
    return opened;
  };
  const run = async (
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
  ): Promise<unknown> => {
    const database = await open();
    if (!database) return null;
    return new Promise((resolve) => {
      try {
        const transaction = database.transaction("imgs", mode);
        const request = action(transaction.objectStore("imgs"));
        transaction.oncomplete = () => {
          resolve(request.result);
        };
        transaction.onerror = transaction.onabort = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  };
  return {
    put: async (key, value) => {
      await run("readwrite", (store) => store.put(value, key));
    },
    get: (key) => run("readonly", (store) => store.get(key)),
    delete: async (key) => {
      await run("readwrite", (store) => store.delete(key));
    },
  };
}

export interface DebouncedSave<T> {
  (state: T): void;
  /** Drops a waiting write (before clearing on save or discard) */
  cancel: () => void;
}

export interface DraftStore {
  /** The photo (`imgUrl`) goes to the image store, the rest to storage */
  save: (key: string, state: object) => void;
  /** The text half, without the photo; expired or broken drafts are removed */
  load: <T>(key: string) => Partial<T> | null;
  loadImage: (key: string) => Promise<string | null>;
  clear: (key: string) => void;
  /** Removes every expired draft; call when an editor opens */
  sweep: () => void;
  debounced: <T extends object>(
    key: string,
    delayMs?: number,
  ) => DebouncedSave<T>;
}

export interface DraftStoreOptions {
  storage?: DraftStorage | null;
  images?: DraftImageStore;
  now?: () => number;
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function createDraftStore(options: DraftStoreOptions = {}): DraftStore {
  const storage =
    options.storage === undefined ? browserStorage() : options.storage;
  const images = options.images ?? indexedDbImageStore();
  const now = options.now ?? Date.now;
  const imageKey = (key: string) => `${key}::img`;

  function remove(key: string): void {
    try {
      storage?.removeItem(key);
    } catch {
      // storage unavailable
    }
  }

  function clear(key: string): void {
    remove(key);
    void images.delete(imageKey(key));
  }

  function save(key: string, state: object): void {
    if (!storage) return;
    const { imgUrl, ...rest } = state as { imgUrl?: unknown };
    // Always one or the other, so a removed photo doesn't come back
    if (imgUrl) {
      void images.put(imageKey(key), { at: now(), dataUrl: imgUrl });
    } else {
      void images.delete(imageKey(key));
    }
    try {
      storage.setItem(key, JSON.stringify({ at: now(), state: rest }));
    } catch {
      // over quota: drop this write
    }
  }

  function load<T>(key: string): Partial<T> | null {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        at?: number;
        state?: Partial<T>;
      } | null;
      if (!parsed?.at || !parsed.state) {
        remove(key);
        return null;
      }
      if (now() - parsed.at > DRAFT_TTL_MS) {
        clear(key);
        return null;
      }
      return parsed.state;
    } catch {
      return null;
    }
  }

  return {
    save,
    load,
    clear,
    async loadImage(key) {
      const record = (await images.get(imageKey(key))) as {
        at?: number;
        dataUrl?: string;
      } | null;
      if (!record?.dataUrl) return null;
      if (record.at && now() - record.at > DRAFT_TTL_MS) {
        await images.delete(imageKey(key));
        return null;
      }
      return record.dataUrl;
    },
    sweep() {
      if (!storage) return;
      try {
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && DRAFT_KEY.test(key)) keys.push(key);
        }
        for (const key of keys) load(key);
      } catch {
        // storage unavailable
      }
    },
    debounced<T extends object>(key: string, delayMs = DRAFT_DELAY_MS) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const persist = ((state: T) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          save(key, state);
        }, delayMs);
      }) as DebouncedSave<T>;
      persist.cancel = () => {
        clearTimeout(timer);
      };
      return persist;
    },
  };
}

/**
 * A draft laid over what was just loaded. A draft of another barcode is left
 * out: two scans of unknown products share the blank draft. Apply the photo
 * (`loadImage`) afterwards, only while `imgUrl` is still empty.
 */
export function overlayDraft<T extends object>(
  baseline: T,
  draft: Partial<T> | null,
  prefillBarcode: string | null = null,
): { state: T; isRestored: boolean } {
  const draftBarcode = (draft as { barcode?: unknown } | null)?.barcode;
  const isOtherScan = Boolean(
    prefillBarcode && draftBarcode && draftBarcode !== prefillBarcode,
  );
  if (!draft || Object.keys(draft).length === 0 || isOtherScan) {
    return { state: baseline, isRestored: false };
  }
  return { state: { ...baseline, ...draft }, isRestored: true };
}
