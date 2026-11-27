/** The catalogue with its executors, and which of it a turn offers */
import type { AssistantTool, TurnContext } from "@/features/shared/ai";

import type { Args } from "./args";
import { TOOL_SPECS } from "./catalog";
import { FOOD_CARD, proposalTools, QUICK_CARD } from "./proposals";
import { readTools } from "./readTools";
import { writeTools } from "./writeTools";

type Executor = (args: Args, turn: TurnContext) => Promise<unknown>;

const EXECUTORS: Partial<Record<string, Executor>> = {
  ...readTools,
  ...writeTools,
  ...proposalTools,
};

/**
 * Small models can't be trusted to pick the reviewing tool from prose, so a
 * turn leaves out what it must not call (Trace.svelte `toolsForRound`):
 *
 * - With a photo there is no `log_quick_calories`: the photo goes through a
 *   review card.
 * - Text only has no `propose_quick_calories`, the photo estimate's path.
 *   `propose_food` stays, being the one way to create a food without logging
 *   it, except while a card waits: models re-call it from the chat history.
 */
export function isToolOffered(name: string, turn: TurnContext): boolean {
  if (turn.hasImage) return name !== "log_quick_calories";
  if (name === "propose_quick_calories") return false;
  return !(
    name === "propose_food" &&
    (turn.hasPendingCard(FOOD_CARD) || turn.hasPendingCard(QUICK_CARD))
  );
}

export function nutritionTools(turn: TurnContext): AssistantTool[] {
  return TOOL_SPECS.filter((spec) => isToolOffered(spec.name, turn)).map(
    (spec) => ({
      ...spec,
      run: async (args) => {
        const execute = EXECUTORS[spec.name];
        if (!execute) return { error: `Unknown tool: ${spec.name}` };
        return execute(args, turn);
      },
    }),
  );
}
