import { describe, expect, it } from "vitest";

import { liveImageFor, sourceRowId } from "./itemSource";

describe("sourceRowId", () => {
  it("reads the server id as the web did", () => {
    expect(sourceRowId({ id: 5, food_server_id: 9 })).toBe(9);
    expect(sourceRowId({ id: 5, food_server_id: null })).toBeNull();
    expect(sourceRowId({ id: 5 })).toBe(5);
    expect(sourceRowId({})).toBeNull();
  });
});

describe("liveImageFor", () => {
  const library = [
    { id: 1, name: "Bread", brand: "Mill", img_url: "bread-new.jpg" },
    { id: 2, name: "Jam", brand: "Orchard", img_url: "jam.jpg" },
    { id: 3, name: "Milk", brand: null, img_url: null },
  ];

  it("takes the source's current picture by id", () => {
    expect(
      liveImageFor({ id: 1, name: "Old name", imgUrl: "old.jpg" }, library),
    ).toBe("bread-new.jpg");
  });

  it("falls back to name and brand, ignoring the brand's case", () => {
    expect(
      liveImageFor({ name: "Jam", brand: "ORCHARD ", imgUrl: "x" }, library),
    ).toBe("jam.jpg");
  });

  it("matches by name alone only for an entry without a brand", () => {
    expect(liveImageFor({ name: "Jam" }, library)).toBe("jam.jpg");
    expect(
      liveImageFor({ name: "Jam", brand: "Other", imgUrl: "own" }, library),
    ).toBe("own");
  });

  it("keeps the entry's own picture when the source has none", () => {
    expect(liveImageFor({ id: 3, name: "Milk", imgUrl: "own" }, library)).toBe(
      "own",
    );
  });
});
