import { describe, expect, it } from "vitest";

import { resources } from "@/i18n/resources";

import { BODY_STAT_KEYS } from "../lib/insights/bodyStats";
import { NUTRIMENTS } from "../lib/insights/nutrition";
import { WELLNESS_STATS_METRICS } from "../lib/insights/statistics";
import { SETTINGS_VISIBILITY_IDS } from "../lib/insights/visibility";
import {
  BODY_METRICS,
  BODY_SCORE_METRICS,
  GARMIN_METRICS,
  WELLNESS_METRICS,
} from "../lib/insights/wellness";

// Labels are looked up by id, which the type checker cannot see
describe("metric strings", () => {
  const { insights } = resources.en.nutrition;

  it("labels every statistics metric", () => {
    const keys = [
      ...NUTRIMENTS.map((n) => n.id),
      ...BODY_STAT_KEYS,
      "water",
      ...WELLNESS_STATS_METRICS.map((m) => m.key),
    ];
    for (const key of keys) {
      expect(insights.metrics).toHaveProperty([key]);
    }
  });

  it("labels and describes every wellness card", () => {
    const tiles = [
      ...WELLNESS_METRICS,
      ...BODY_METRICS,
      ...BODY_SCORE_METRICS,
      ...GARMIN_METRICS,
    ];
    for (const { id } of tiles) {
      expect(insights.wellness.metrics).toHaveProperty([id]);
      expect(insights.wellness.descriptions).toHaveProperty([id]);
    }
  });

  it("labels every metric the settings can hide", () => {
    for (const id of SETTINGS_VISIBILITY_IDS) {
      expect(insights.wellness.metrics).toHaveProperty([id]);
    }
  });
});
