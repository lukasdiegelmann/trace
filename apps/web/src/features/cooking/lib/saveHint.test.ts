import { describe, expect, it } from "vitest";

import { changedFields, syncHint } from "./saveHint";

describe("save hint", () => {
  it("names only what really changed", () => {
    const base = {
      name: "A",
      description: null,
      tags: [],
      favorite: false,
      servings: 2,
      nutrition: { a: 1, b: 2 },
    };
    expect(
      changedFields(
        {
          name: "A",
          description: "",
          tags: [],
          favorite: true,
          servings: "2",
          nutrition: { b: 2, a: 1 },
        },
        base,
      ),
    ).toEqual(["favorite"]);
  });

  it("carries the base's stamp and the time", () => {
    const now = new Date("2026-01-02T03:04:05Z");
    expect(syncHint({ synced_at: "x" }, ["name"], now)).toEqual({
      base_synced_at: "x",
      changed: ["name"],
      edited_at: "2026-01-02T03:04:05.000Z",
      client_now: "2026-01-02T03:04:05.000Z",
    });
  });
});
