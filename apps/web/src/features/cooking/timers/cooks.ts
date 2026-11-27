/**
 * Which recipes are being cooked on this device, ported from
 * cooktrace/src/stores/cooks.js, and the checkboxes that belong to a cook
 * (same localStorage keys as the old UI).
 */
import { persistedStore, readJson, writeJson } from "./store";

export interface Cooking {
  name: string;
  img: string;
  at: number;
}

export type ActiveCooks = Record<string, Cooking | undefined>;

export const cookStore = persistedStore<ActiveCooks>("ct:cooks", (stored) =>
  stored && typeof stored === "object" ? (stored as ActiveCooks) : {},
);

export function startCook(id: number, name: string, img: string): void {
  const all = cookStore.get();
  // Strictly after every running cook, so the order is the start order.
  const latest = Math.max(0, ...Object.values(all).map((c) => c?.at ?? 0));
  cookStore.set({
    ...all,
    [id]: { name, img, at: Math.max(Date.now(), latest + 1) },
  });
}

/** A running cook learns the recipe's current name and image */
export function describeCook(id: number, name: string, img: string): void {
  const all = cookStore.get();
  const cook = all[id];
  if (!cook) return;
  const next = { ...cook, name: name || cook.name, img: img || cook.img };
  if (next.name === cook.name && next.img === cook.img) return;
  cookStore.set({ ...all, [id]: next });
}

export function endCook(id: number): void {
  const entries = Object.entries(cookStore.get()).filter(
    ([key]) => key !== String(id),
  );
  cookStore.set(Object.fromEntries(entries));
  clearChecks(id);
}

export interface ActiveCook extends Cooking {
  id: number;
}

/** Oldest first, so the list doesn't reshuffle when another starts */
export function cookList(all: ActiveCooks): ActiveCook[] {
  return Object.entries(all)
    .flatMap(([id, cook]) => (cook ? [{ ...cook, id: Number(id) }] : []))
    .sort((a, b) => a.at - b.at);
}

export interface Checks {
  /** "group-index" of the ingredient */
  ingredients: string[];
  steps: number[];
  tools: number[];
}

const CHECK_KEYS = {
  ingredients: "ing",
  steps: "step",
  tools: "tool",
} as const;

const checkKey = (id: number, kind: keyof Checks) =>
  `ct:checks:${id}:${CHECK_KEYS[kind]}`;

export function readChecks(id: number): Checks {
  const read = (kind: keyof Checks) => {
    const stored = readJson(checkKey(id, kind));
    return Array.isArray(stored) ? (stored as never[]) : [];
  };
  return {
    ingredients: read("ingredients"),
    steps: read("steps"),
    tools: read("tools"),
  };
}

export function writeChecks(id: number, checks: Checks): void {
  for (const kind of ["ingredients", "steps", "tools"] as const) {
    writeJson(checkKey(id, kind), checks[kind]);
  }
}

export function clearChecks(id: number): void {
  try {
    for (const kind of ["ingredients", "steps", "tools"] as const) {
      window.localStorage.removeItem(checkKey(id, kind));
    }
  } catch {
    // nothing stored then
  }
}
