import { describe, expect, it } from "vitest";

import { jsonObjects, recipesFromReply, toRecipeInput } from "./recipeAi";

describe("AI recipe replies", () => {
  it("reads fenced and wrapped answers", () => {
    const reply =
      '```json\n{"recipes":[{"name":"A","steps":["Mix {well}"]},{"name":"B","ingredients":[]}]}\n```';
    expect(recipesFromReply(reply).recipes.map((r) => r.name)).toEqual([
      "A",
      "B",
    ]);
  });

  it("keeps the recipes before a cut-off", () => {
    const reply = '{"name":"A","steps":["x \\" }"]}\n{"name":"B","steps":["';
    const result = recipesFromReply(reply);
    expect(result.recipes.map((r) => r.name)).toEqual(["A"]);
    expect(result.isCutOff).toBe(true);
    expect(jsonObjects("no json {here}").objects).toEqual([]);
  });

  it("normalises flat ingredients, strings and numbers", () => {
    expect(
      toRecipeInput({
        name: " Soup ",
        servings: "4",
        ingredients: [{ qty: 2, name: "Leek" }, "Salt", { qty: "1" }],
        steps: ["Boil"],
      }),
    ).toMatchObject({
      name: "Soup",
      servings: 4,
      ingredients: [
        {
          name: "",
          items: [
            { qty: "2", unit: "", name: "Leek", note: "" },
            { qty: "", unit: "", name: "Salt", note: "" },
          ],
        },
      ],
      steps: [{ title: "", text: "Boil" }],
    });
    expect(toRecipeInput({ name: "" })).toBeNull();
    expect(toRecipeInput({ name: "No content" })).toBeNull();
  });
});
