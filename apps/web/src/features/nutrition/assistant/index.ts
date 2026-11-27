/** NutriTrace's part of the Trace assistant */
import type { AssistantToolset } from "@/features/shared/ai";
import { i18n } from "@/i18n";

import { nutritionContext } from "./context";
import { SmartLog } from "./SmartLog";
import { nutritionTools } from "./tools";

const SUGGESTIONS = ["today", "nextMeal", "recovery", "goals"] as const;

export const nutritionToolset: AssistantToolset = {
  id: "nutrition",
  tools: nutritionTools,
  context: nutritionContext,
  suggestions: () =>
    SUGGESTIONS.map((key) => i18n.t(`nutrition:assistant.suggestions.${key}`)),
  SmartLog,
};
