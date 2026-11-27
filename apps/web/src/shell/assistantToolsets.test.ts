import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { cookingToolset } from "@/features/cooking/assistant";
import { nutritionToolset } from "@/features/nutrition/assistant";
import type { TurnContext } from "@/features/shared/ai";
import { trainingToolset } from "@/features/training/assistant";

const toolsets = [nutritionToolset, cookingToolset, trainingToolset];

/** The turns that change which tools are offered */
const turns: TurnContext[] = [false, true].map((hasImage) => ({
  hasImage,
  hasPendingCard: () => false,
  addCard: () => {},
}));

describe("the assistant's toolsets together", () => {
  beforeEach(() => {
    for (const client of [api.nt, api.ct, api.lt]) {
      vi.spyOn(client, "get").mockResolvedValue({});
    }
  });

  it("offers every tool name once, with a schema the providers take", async () => {
    for (const turn of turns) {
      const tools = (
        await Promise.all(toolsets.map(async (set) => set.tools(turn)))
      ).flat();
      const names = tools.map((tool) => tool.name);
      expect(names.length).toBeGreaterThan(40);
      expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
      // OpenAI allows at most 128 tools and names of this form.
      expect(names.length).toBeLessThanOrEqual(128);
      for (const tool of tools) {
        expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
        expect(tool.description).not.toBe("");
        expect(tool.parameters).toMatchObject({ type: "object" });
      }
    }
  });

  it("has a translated welcome chip from every domain", () => {
    for (const set of toolsets) {
      const chips = set.suggestions();
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) expect(chip).not.toMatch(/assistant\./);
    }
  });
});
