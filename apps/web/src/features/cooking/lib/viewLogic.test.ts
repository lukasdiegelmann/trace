import { describe, expect, it } from "vitest";

import type { Recipe } from "../recipesApi";

import { commentThreads } from "./commentThreads";
import { linkedIngredients } from "./linkedIngredients";
import { mealTypeAt } from "./mealType";
import { versionDiffers } from "./recipeVersions";
import { videoEmbed } from "./videoEmbed";

describe("videoEmbed", () => {
  it("embeds uploads, files, YouTube and Vimeo", () => {
    expect(videoEmbed("/uploads/a.mp4")).toEqual({
      kind: "video",
      src: "/ct/uploads/a.mp4",
    });
    expect(videoEmbed("https://x.test/a.webm?1")?.kind).toBe("video");
    expect(videoEmbed("https://youtu.be/abcdef123")?.src).toBe(
      "https://www.youtube.com/embed/abcdef123",
    );
    expect(videoEmbed("https://vimeo.com/123456")?.src).toBe(
      "https://player.vimeo.com/video/123456",
    );
    expect(videoEmbed("https://x.test/page")?.kind).toBe("link");
  });

  it("drops anything that is no web link", () => {
    expect(videoEmbed("javascript:alert(1)")).toBeNull();
    expect(videoEmbed("")).toBeNull();
  });
});

describe("commentThreads", () => {
  const comment = (id: number, parent: number | null, at = `${id}`) => ({
    id,
    parent_id: parent,
    created_at: at,
  });

  it("folds nested replies under the top comment, in time order", () => {
    const threads = commentThreads([
      comment(1, null),
      comment(2, null),
      comment(4, 3, "9"),
      comment(3, 1, "5"),
      comment(5, 99),
    ]);
    expect(threads.map((t) => [t.root.id, t.replies.map((r) => r.id)])).toEqual(
      [
        [1, [3, 4]],
        [2, []],
        [5, []],
      ],
    );
  });
});

describe("versionDiffers", () => {
  const recipe = {
    name: "Soup",
    ingredients: [{ name: "", items: [{ name: "Water", qty: "1" }] }],
    steps: [{ title: "", text: "Boil" }],
    notes: null,
    category_id: 1,
    img_url: "/ct/uploads/a.jpg?x",
    nutrition: { calories: 1, _derived: {} },
    tags: [],
    tools: [],
    servings: 2,
  } as unknown as Recipe;

  it("is empty for the same content written differently", () => {
    expect(
      versionDiffers(
        {
          ...recipe,
          steps: ["Boil"],
          img_url: "/uploads/a.jpg",
          nutrition: { calories: 1 },
        },
        recipe,
      ),
    ).toEqual([]);
  });

  it("names the parts that differ", () => {
    expect(
      versionDiffers(
        { ...recipe, name: "Stew", servings: 4, category_id: null },
        recipe,
      ),
    ).toEqual(["title", "category", "details"]);
  });
});

describe("mealTypeAt", () => {
  it("follows the time of day", () => {
    expect([8, 11, 15, 22].map(mealTypeAt)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
  });
});

describe("linkedIngredients", () => {
  it("resolves ids to list positions and drops dangling ones", () => {
    const groups = [
      { name: "", items: [{ id: "a", name: "A" }] },
      { name: "x", items: [{ id: "b", name: "B" }] },
    ];
    expect(
      linkedIngredients(groups, ["b", "gone", "a"]).map((l) => l.key),
    ).toEqual(["1-0", "0-0"]);
    expect(linkedIngredients(groups, undefined)).toEqual([]);
  });
});
