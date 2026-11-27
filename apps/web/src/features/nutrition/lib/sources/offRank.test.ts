/* eslint-disable @typescript-eslint/naming-convention -- OFF's keys */
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/off-search-213.json";
import {
  filterByOffTier,
  hasNutriScore,
  OFF_RELEVANCE_BAND,
  offCompletenessTier,
  rankOffResults,
  type RankEntry,
} from "./offRank";

interface Hit {
  code: string;
  product_name?: string;
  has_image?: boolean;
  completeness?: number;
  nutriscore_grade?: string;
  _score: number;
}
const QUERIES = fixture as unknown as Record<string, { hits: Hit[] }>;

interface Food {
  barcode: string;
  imgUrl: string;
  completeness: number | null;
  nutriscore: string | null;
}

function toEntries(hits: Hit[], isScored = true): RankEntry<Food>[] {
  return hits.map((hit) => ({
    food: {
      barcode: hit.code,
      imgUrl: hit.has_image ? `https://images.example/${hit.code}.jpg` : "",
      completeness: hit.completeness ?? null,
      nutriscore: hit.nutriscore_grade?.toLowerCase() || null,
    },
    score: isScored ? hit._score : undefined,
  }));
}
const position = (foods: Food[], code: string) =>
  foods.findIndex((food) => food.barcode === code) + 1;

describe("rankOffResults", () => {
  it("keeps a clearly best hit first (#213)", () => {
    const { hits } = QUERIES["Blue Label Marie Biscuits"];
    const ranked = rankOffResults(toEntries(hits));
    expect(position(ranked, "6009704170273")).toBe(1);
    expect(ranked).toHaveLength(hits.length);
    expect(
      position(rankOffResults(toEntries(hits, false)), "6009704170273"),
    ).toBeGreaterThan(20);
  });

  it("orders a tied group by photo, then completeness", () => {
    const { hits } = QUERIES.nutella;
    const counts = new Map<number, number>();
    for (const hit of hits) {
      counts.set(hit._score, (counts.get(hit._score) ?? 0) + 1);
    }
    const [score] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const codes = new Set(
      hits.filter((hit) => hit._score === score).map((hit) => hit.code),
    );
    const tied = rankOffResults(toEntries(hits)).filter((food) =>
      codes.has(food.barcode),
    );
    for (let i = 1; i < tied.length; i++) {
      const a = tied[i - 1];
      const b = tied[i];
      const photo = (a.imgUrl ? 1 : 0) - (b.imgUrl ? 1 : 0);
      expect(
        photo > 0 ||
          (photo === 0 && (a.completeness ?? 0) >= (b.completeness ?? 0)),
      ).toBe(true);
    }
  });

  it.each(["Blue Label Marie Biscuits", "nutella", "yogurt", "coca cola"])(
    "never puts a clearly weaker match above a better one: %s",
    (query) => {
      const { hits } = QUERIES[query];
      const scores = new Map(hits.map((hit) => [hit.code, hit._score]));
      const ranked = rankOffResults(toEntries(hits));
      for (let i = 1; i < ranked.length; i++) {
        const below = scores.get(ranked[i].barcode) ?? 0;
        for (let j = 0; j < i; j++) {
          expect(scores.get(ranked[j].barcode)).toBeGreaterThanOrEqual(
            below * OFF_RELEVANCE_BAND,
          );
        }
      }
    },
  );

  it("ranks close scores by quality and sorts unsorted pages", () => {
    const entry = (
      barcode: string,
      score: number | undefined,
      imgUrl: string,
      completeness: number,
      nutriscore: string | null = null,
    ) => ({ food: { barcode, imgUrl, completeness, nutriscore }, score });
    const codes = (foods: Food[]) => foods.map((food) => food.barcode);
    expect(
      codes(
        rankOffResults([
          entry("weak", 10, "x", 1, "a"),
          entry("strong", 50, "", 0.1),
        ]),
      ),
    ).toEqual(["strong", "weak"]);
    expect(
      codes(
        rankOffResults([
          entry("bare", 20, "", 0.9, "a"),
          entry("thin", 19.5, "x", 0.2),
          entry("unknown", 19, "x", 0.8, "unknown"),
          entry("graded", 18.5, "x", 0.8, "c"),
        ]),
      ),
    ).toEqual(["graded", "unknown", "thin", "bare"]);
    const unscored = [
      entry("thin", undefined, "x", 0.2),
      entry("curated", undefined, "", 0.9),
    ];
    expect(codes(rankOffResults(unscored, { isFromMirror: true }))).toEqual([
      "curated",
      "thin",
    ]);
    expect(codes(rankOffResults(unscored))).toEqual(["thin", "curated"]);
    expect(rankOffResults([])).toEqual([]);
  });

  it("knows a real Nutri-Score and the completeness tiers", () => {
    expect(hasNutriScore({ nutriscore: "b" })).toBe(true);
    for (const nutriscore of ["unknown", "not-applicable", null]) {
      expect(hasNutriScore({ nutriscore })).toBe(false);
    }
    expect([0.7, 0.4, 0.39, null].map(offCompletenessTier)).toEqual([
      "high",
      "medium",
      "low",
      "unknown",
    ]);
    expect(
      filterByOffTier(
        [{ completeness: 0.9 }, { completeness: 0.1 }],
        new Set(["low" as const]),
      ),
    ).toEqual([{ completeness: 0.1 }]);
  });
});
