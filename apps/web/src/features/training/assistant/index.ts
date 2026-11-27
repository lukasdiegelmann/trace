/** The training part of the Trace assistant: LiftTrace's tools and prompt */
import i18next from "i18next";

import type { AssistantToolset } from "@/features/shared/ai";

import { TOOL_SPECS } from "./catalog";
import { trainingContext } from "./context";
import { extractPlan } from "./plan";
import { runTool } from "./runTool";
import { TrainingSmartLog } from "./SmartLog";

export const trainingToolset: AssistantToolset = {
  id: "training",
  tools: () =>
    TOOL_SPECS.map((spec) => ({
      ...spec,
      run: (args) => runTool(spec.name, args),
    })),
  context: trainingContext,
  suggestions: () => [
    i18next.t("training:assistant.suggestions.generate"),
    i18next.t("training:assistant.suggestions.warmup"),
    i18next.t("training:assistant.suggestions.overload"),
    i18next.t("training:assistant.suggestions.plateau"),
  ],
  SmartLog: TrainingSmartLog,
  replyAction: (reply) => {
    const plan = extractPlan(reply);
    return plan
      ? { label: i18next.t("training:assistant.usePlan"), text: plan }
      : null;
  },
};
