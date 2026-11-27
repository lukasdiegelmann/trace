import { describe, expect, it } from "vitest";

import {
  buildRecipeCardPages,
  cardFilename,
  MAX_PAGES,
  wrapText,
  type CardTexts,
} from "./recipeCard";

const texts: CardTexts = {
  untitled: "Recipe",
  ingredients: "Ingredients",
  steps: "Steps",
  continued: "continued",
  serves: (count) => `Serves ${count}`,
  page: (page, total) => `Page ${page} of ${total}`,
  more: (count) => `+${count} more`,
};

describe("recipe card", () => {
  it("escapes the recipe's text", () => {
    const [page] = buildRecipeCardPages(
      { name: "<b>&</b>", servings: 2, prep_minutes: 5 },
      texts,
      null,
    );
    expect(page.svg).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
    expect(page.svg).toContain("5m · Serves 2");
  });

  it("splits long recipes and stops at the page limit", () => {
    const pages = buildRecipeCardPages(
      { name: "Long", steps: Array.from({ length: 500 }, () => "Stir well") },
      texts,
      null,
    );
    expect(pages).toHaveLength(MAX_PAGES);
    expect(pages[pages.length - 1].svg).toContain("more");
  });

  it("leaves the step markers out and keeps the subtitle on the card", () => {
    const [page] = buildRecipeCardPages(
      {
        name: "A very long recipe name that needs all three of its lines",
        servings: 4,
        steps: ["**Stir** *well*"],
      },
      texts,
      null,
    );
    expect(page.svg).toContain("Stir well");
    expect(page.svg).not.toContain("**");
    // Three title lines end at 380 + 108; the subtitle stays above 520.
    expect(page.svg).toContain('y="516"');
  });

  it("wraps and names files", () => {
    expect(wrapText("a bb ccc dddd", 4, 2)).toEqual(["a bb", "ccc…"]);
    expect(cardFilename("Mom's Pasta!")).toBe("mom-s-pasta.png");
    expect(cardFilename("", 2, 3)).toBe("recipe-page-2-of-3.png");
  });
});
