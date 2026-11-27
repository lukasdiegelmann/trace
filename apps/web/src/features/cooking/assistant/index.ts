/** CookTrace's part of the Trace assistant */
import type { AssistantToolset } from "@/features/shared/ai";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";

import { cookingContext, SMART_LOG_PREAMBLE } from "./prompt";
import { cookingTools } from "./tools";

const CHIPS = ["pantry", "suggestion", "recent", "shopping"] as const;

export const cookingToolset: AssistantToolset = {
  id: "cooking",
  tools: cookingTools,
  context: async () => {
    await settingsStores.ct.ensureLoaded();
    return cookingContext(settingsStores.ct.getSnapshot().values);
  },
  suggestions: () =>
    CHIPS.map((chip) =>
      i18n.t(`assistant.suggestions.${chip}`, { ns: "cooking" }),
    ),
  smartLogPreamble: SMART_LOG_PREAMBLE,
};
