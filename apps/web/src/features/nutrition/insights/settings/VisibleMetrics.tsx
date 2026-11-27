import { Checkbox, Stack, Text } from "@monocircuit/monolithium/components";

import { SETTINGS_VISIBILITY_IDS } from "../../lib/insights/visibility";
import { isMetricVisible, toggleMetric } from "../../lib/insights/wellness";
import type { InsightSettings } from "../useNtSettings";
import { useInsightsT } from "../useInsightsT";

/** Which of a provider's metrics Wellness shows (`wellnessMetrics`) */
export function VisibleMetrics({
  ids,
  settings,
}: {
  ids: readonly string[];
  settings: InsightSettings;
}) {
  const { t } = useInsightsT();
  return (
    <Stack gap={2}>
      <Text variant="label">{t("wellnessSettings.visibleMetrics")}</Text>
      <div
        role="group"
        aria-label={t("wellnessSettings.visibleMetrics")}
        className="flex flex-wrap gap-2"
      >
        {ids.map((id) => (
          <Checkbox
            key={id}
            label={t(`wellness.metrics.${id}`)}
            checked={isMetricVisible(settings.wellnessMetrics, id)}
            onChange={() => {
              settings.set(
                "wellnessMetrics",
                toggleMetric(
                  settings.wellnessMetrics,
                  id,
                  SETTINGS_VISIBILITY_IDS,
                ),
              );
            }}
          />
        ))}
      </div>
    </Stack>
  );
}
