/** A faked NutriTrace for the assistant's tests */

import { vi } from "vitest";

import { api } from "@/api";
import type { AssistantCard, TurnContext } from "@/features/shared/ai";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";

export interface Write {
  method: "put" | "post";
  path: string;
  body: unknown;
}

export interface Fake {
  /** What the settings answer */
  settings: Record<string, unknown>;
  /** GET answers by path; a function gets the query */
  gets: Record<string, unknown>;
  writes: Write[];
}

export function emptyDay(date: string) {
  return {
    date,
    items: [],
    body_stats: {},
    water: [],
    notes: "",
    completed_at: null,
    completed_meals: [],
  };
}

export async function fakeNutriTrace(
  setup: Partial<Pick<Fake, "settings" | "gets">> = {},
): Promise<Fake> {
  const fake: Fake = { settings: {}, gets: {}, writes: [], ...setup };
  vi.spyOn(api.nt, "get").mockImplementation((path) => {
    if (path === "/settings") return Promise.resolve(fake.settings as never);
    if (path in fake.gets) return Promise.resolve(fake.gets[path] as never);
    const date = /^\/diary\/(.+)$/.exec(path)?.[1];
    if (date) return Promise.resolve(emptyDay(date) as never);
    return Promise.reject(new Error(`no answer for ${path}`));
  });
  vi.spyOn(api.nt, "put").mockImplementation((path, body) => {
    fake.writes.push({ method: "put", path, body });
    return Promise.resolve(
      (path.startsWith("/diary/")
        ? { date: path.slice("/diary/".length), ...(body as object) }
        : { ok: true }) as never,
    );
  });
  vi.spyOn(api.nt, "post").mockImplementation((path, body) => {
    fake.writes.push({ method: "post", path, body });
    return Promise.resolve(
      (path === "/foods" ? { id: 77, ...(body as object) } : {}) as never,
    );
  });
  await settingsStores.nt.reload();
  await i18n.changeLanguage("en");
  return fake;
}

export function fakeTurn(
  options: { hasImage?: boolean; pending?: string[] } = {},
): TurnContext & { cards: AssistantCard[] } {
  const cards: AssistantCard[] = [];
  return {
    cards,
    hasImage: options.hasImage ?? false,
    hasPendingCard: (kind) => options.pending?.includes(kind) ?? false,
    addCard: (card) => {
      cards.push(card);
    },
  };
}

/** The items of the diary writes, in order */
export function writtenItems(fake: Fake): Record<string, unknown>[][] {
  return fake.writes
    .filter((write) => write.method === "put")
    .filter((write) => write.path.startsWith("/diary/"))
    .map((write) => (write.body as { items: Record<string, unknown>[] }).items);
}
