import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDraftStore,
  DRAFT_TTL_MS,
  draftKey,
  overlayDraft,
  pickIdentity,
  type DraftImageStore,
  type DraftStorage,
} from "./editorDraft";

function memory() {
  const map = new Map<string, string>();
  const storage: DraftStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
  const photos = new Map<string, unknown>();
  const images: DraftImageStore = {
    put: (key, value) => {
      photos.set(key, value);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(photos.get(key) ?? null),
    delete: (key) => {
      photos.delete(key);
      return Promise.resolve();
    },
  };
  return { map, storage, photos, images };
}

afterEach(() => {
  vi.useRealTimers();
});

// Upstream editor-draft-keys.test.js
describe("draft keys", () => {
  it("separates saved items, picks and a new item", () => {
    expect(draftKey("meal", 12)).toBe("nt:meal:draft:edit:12");
    expect(draftKey("food", null)).toBe("nt:food:draft:new");
    const cases: [Parameters<typeof draftKey>[2], string][] = [
      [
        { name: "S", source_app: "cooktrace", source_external_id: "recipe:1" },
        "cooktrace:recipe:1",
      ],
      [{ name: "Soup", mealieSlug: "soup" }, "mealie:soup"],
      [{ name: "Oats", barcode: "301" }, "barcode:301"],
      [{ name: "Trace Omelette", brand: "" }, "name:trace omelette|"],
    ];
    for (const [prefill, identity] of cases) {
      expect(draftKey("food", null, prefill)).toBe(
        `nt:food:draft:pick:${identity}`,
      );
    }
  });

  it("prefers an id and keeps barcode-only scans on the blank draft", () => {
    const pick = { source_app: "cooktrace", source_external_id: "recipe:1" };
    expect(draftKey("meal", 7, pick)).toBe("nt:meal:draft:edit:7");
    expect(draftKey("meal", "undefined", pick)).toBe(
      "nt:meal:draft:pick:cooktrace:recipe:1",
    );
    expect(pickIdentity(null)).toBeNull();
    expect(pickIdentity({})).toBeNull();
    expect(draftKey("food", null, { barcode: "0123" })).toBe(
      "nt:food:draft:new",
    );
  });

  it("carries the account", () => {
    expect(draftKey("food", null, null, 7)).toBe("nt:u7:food:draft:new");
  });
});

describe("draft store", () => {
  it("splits the photo off and removes it again", async () => {
    const { map, storage, photos, images } = memory();
    const drafts = createDraftStore({ storage, images });
    drafts.save("nt:food:draft:new", { name: "a", imgUrl: "data:x" });
    expect(map.get("nt:food:draft:new")).not.toContain("data:x");
    expect(drafts.load("nt:food:draft:new")).toEqual({ name: "a" });
    expect(await drafts.loadImage("nt:food:draft:new")).toBe("data:x");
    drafts.save("nt:food:draft:new", { name: "a", imgUrl: "" });
    expect(photos.size).toBe(0);
    drafts.clear("nt:food:draft:new");
    expect(map.size).toBe(0);
  });

  it("sweeps expired drafts of any account", () => {
    const { map, storage, images } = memory();
    const drafts = createDraftStore({ storage, images });
    const old = JSON.stringify({
      at: Date.now() - DRAFT_TTL_MS - 1000,
      state: { name: "old" },
    });
    drafts.save("nt:u1:food:draft:new", { name: "fresh" });
    map.set("nt:u2:meal:draft:edit:3", old);
    map.set("nt:meal:draft:pick:cooktrace:recipe:2", old);
    map.set("nt:food:draft:edit:1", '{"state":1}');
    map.set("trace.settings.nt.x", "1");
    drafts.sweep();
    expect([...map.keys()].sort()).toEqual([
      "nt:u1:food:draft:new",
      "trace.settings.nt.x",
    ]);
  });

  it("expires photos too and survives broken text", async () => {
    const { map, storage, images, photos } = memory();
    let time = 1000;
    const drafts = createDraftStore({ storage, images, now: () => time });
    drafts.save("k", { imgUrl: "data:x" });
    time += DRAFT_TTL_MS + 1;
    expect(await drafts.loadImage("k")).toBeNull();
    expect(photos.size).toBe(0);
    map.set("bad", "{");
    expect(drafts.load("bad")).toBeNull();
  });

  it("debounces and cancels", () => {
    vi.useFakeTimers();
    const { storage, images } = memory();
    const drafts = createDraftStore({ storage, images });
    const persist = drafts.debounced<{ name: string }>("k");
    persist({ name: "a" });
    persist({ name: "ab" });
    vi.advanceTimersByTime(400);
    expect(drafts.load("k")).toEqual({ name: "ab" });
    persist({ name: "abc" });
    persist.cancel();
    vi.advanceTimersByTime(400);
    expect(drafts.load("k")).toEqual({ name: "ab" });
  });

  it("works without IndexedDB or storage", async () => {
    const drafts = createDraftStore({ storage: null });
    drafts.save("k", { name: "a" });
    expect(drafts.load("k")).toBeNull();
    expect(await drafts.loadImage("k")).toBeNull();
  });
});

describe("overlayDraft", () => {
  const baseline = { name: "", barcode: "1" };

  it("lays a draft over the loaded form", () => {
    expect(overlayDraft(baseline, { name: "typed" }, "1")).toEqual({
      state: { name: "typed", barcode: "1" },
      isRestored: true,
    });
    expect(overlayDraft(baseline, null).isRestored).toBe(false);
    expect(overlayDraft(baseline, {}).isRestored).toBe(false);
  });

  it("leaves out another scan's draft", () => {
    expect(overlayDraft(baseline, { barcode: "2" }, "1").isRestored).toBe(
      false,
    );
  });
});
