import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/api";
import { fakeFetch, type FakeResponse, type FakeCall } from "@/test/fakeFetch";

import { ltDefaults, ltSyncedKeys, type LtSettings } from "./definitions/lt";
import { ntDefaults, ntSyncedKeys, type NtSettings } from "./definitions/nt";
import { createSettingsStore } from "./store";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

function setup<B extends "nt" | "lt">(
  backend: B,
  handler: (call: FakeCall) => FakeResponse,
  storage = memoryStorage(),
) {
  const { fetch, calls } = fakeFetch((call) =>
    call.url.endsWith("/auth/me")
      ? { body: { user: { id: 1 }, csrf: "t" } }
      : handler(call),
  );
  const client = createApiClient(backend, { fetch });
  const options = {
    nt: [ntDefaults, ntSyncedKeys],
    lt: [ltDefaults, ltSyncedKeys],
  }[backend] as unknown as [Defaults[B], ReadonlySet<keyof Defaults[B]>];
  const store = createSettingsStore<Defaults[B]>({
    client,
    defaults: options[0],
    syncedKeys: options[1],
    storage,
  });
  const writes = () =>
    calls.filter((call) => call.method !== "GET").map((call) => call.body);
  return { store, calls, writes, storage };
}

interface Defaults {
  nt: NtSettings;
  lt: LtSettings;
}

describe("createSettingsStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has the old UI's defaults before the backend answers", () => {
    const { store } = setup("nt", () => ({ body: {} }));
    expect(store.getSnapshot().status).toBe("idle");
    expect(store.getSnapshot().values.energyUnit).toBe("kcal");
    expect(store.getSnapshot().values.mealNames).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
    ]);
  });

  it("loads GET /api/settings once over the defaults", async () => {
    const { store, calls } = setup("nt", () => ({
      body: { energyUnit: "kJ", someNewKey: 3 },
    }));
    await Promise.all([store.ensureLoaded(), store.ensureLoaded()]);
    expect(calls.filter((c) => c.url === "/nt/api/settings")).toHaveLength(1);
    expect(store.getSnapshot().status).toBe("ready");
    expect(store.get("energyUnit")).toBe("kJ");
    expect(store.get("diaryShowBrands")).toBe(true);
    // Keys this UI doesn't know yet survive as they are
    expect(
      (store.getSnapshot().values as unknown as Record<string, unknown>)
        .someNewKey,
    ).toBe(3);
  });

  it("ignores stale server rows of device-only keys", async () => {
    const { store } = setup("nt", () => ({
      body: { sidebarPersistent: true },
    }));
    await store.ensureLoaded();
    expect(store.get("sidebarPersistent")).toBe(false);
  });

  it("debounces a change per key and sends { key, value }", async () => {
    const { store, writes } = setup("nt", () => ({ body: { ok: true } }));
    store.set("energyUnit", "kJ");
    store.set("energyUnit", "kcal");
    store.set("energyUnit", "kJ");
    expect(store.get("energyUnit")).toBe("kJ");
    expect(writes()).toEqual([]);
    await vi.advanceTimersByTimeAsync(600);
    expect(writes()).toEqual([{ key: "energyUnit", value: "kJ" }]);
  });

  it("keeps an unsent change over a reload", async () => {
    const { store } = setup("nt", () => ({ body: { energyUnit: "kcal" } }));
    store.set("energyUnit", "kJ");
    await store.reload();
    expect(store.get("energyUnit")).toBe("kJ");
  });

  it("keeps device-only keys in storage, never on the server", async () => {
    const { store, writes, storage } = setup("nt", () => ({ body: {} }));
    store.set("navStyle", "sidebar");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes()).toEqual([]);
    expect(storage.items.get("trace.settings.nt.navStyle")).toBe('"sidebar"');
    expect(store.get("navStyle")).toBe("sidebar");
  });

  it("takes lt's winning value from its answer", async () => {
    const { store } = setup("lt", () => ({
      body: { ok: true, value: "lbs" },
    }));
    store.set("weightUnit", "kg");
    await vi.advanceTimersByTimeAsync(600);
    expect(store.get("weightUnit")).toBe("lbs");
  });

  it("writes many keys with one bulk call on nt", async () => {
    const { store, calls } = setup("nt", () => ({ body: { ok: true } }));
    await store.setMany({ energyUnit: "kJ", goals: { calories: 2000 } });
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => c.url)).toEqual(["/nt/api/settings/bulk"]);
    expect(puts[0]?.body).toEqual({
      settings: { energyUnit: "kJ", goals: { calories: 2000 } },
    });
    expect(store.get("goals")).toEqual({ calories: 2000 });
  });

  it("writes key by key on lt, which has no bulk route", async () => {
    const { store, calls } = setup("lt", () => ({ body: { ok: true } }));
    await store.setMany({ weightUnit: "lbs", trackRpe: true });
    expect(calls.filter((c) => c.method === "PUT").map((c) => c.body)).toEqual([
      { key: "weightUnit", value: "lbs" },
      { key: "trackRpe", value: true },
    ]);
  });

  it("sends waiting changes at once on flush", async () => {
    const { store, writes } = setup("nt", () => ({ body: { ok: true } }));
    store.set("energyUnit", "kJ");
    await store.flush();
    expect(writes()).toEqual([{ key: "energyUnit", value: "kJ" }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes()).toHaveLength(1);
  });

  it("reports a failed load and a failed save", async () => {
    const { store } = setup("nt", () => ({
      status: 500,
      body: { error: "boom" },
    }));
    await store.ensureLoaded();
    expect(store.getSnapshot().status).toBe("error");
    expect(store.getSnapshot().error?.message).toBe("boom");

    store.set("energyUnit", "kJ");
    await vi.advanceTimersByTimeAsync(600);
    expect(store.getSnapshot().error?.message).toBe("boom");
    expect(store.get("energyUnit")).toBe("kcal");
  });

  it("tells subscribers about every change", async () => {
    const { store } = setup("nt", () => ({ body: {} }));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set("energyUnit", "kJ");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    store.set("energyUnit", "kcal");
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
  });
});
