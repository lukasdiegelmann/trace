import {
  Button,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Ruler } from "lucide-react";
import { useNavigate } from "react-router";

import { toggleValue } from "../../lib/insights/order";
import { availableMetrics, orderMetrics } from "../../lib/insights/statistics";
import { InsightsHeader } from "../components/InsightsHeader";
import { OrderList } from "../components/OrderList";
import { SectionCard } from "../components/Panel";
import { ToggleRow } from "../components/ToggleRow";
import { metricLabel } from "../statistics/labels";
import { useInsightsT } from "../useInsightsT";
import { useNtSettings } from "../useNtSettings";

const TOGGLES = [
  { key: "statsYZero", id: "yZero", hasHint: true },
  { key: "statsAvgLine", id: "average", hasHint: false },
  { key: "statsGoalLine", id: "goal", hasHint: false },
  { key: "statsTrendLine", id: "trend", hasHint: false },
  { key: "statsIncludeToday", id: "includeToday", hasHint: true },
  { key: "statsShowEmptyDays", id: "emptyDays", hasHint: true },
] as const;

/** routes/settings/Statistics.svelte */
export function StatisticsSettingsPage() {
  const { t } = useInsightsT();
  const navigate = useNavigate();
  const settings = useNtSettings();
  const { values, set } = settings;

  // The same list the Statistics page can show, hidden ones included
  const metrics = orderMetrics(
    availableMetrics({
      hiddenBodyStats: settings.hiddenBodyStats,
      isWaterShownInStats: values.waterShowInStats,
      wellnessMetrics: settings.wellnessMetrics,
      isFitbitFamilyEnabled: settings.isFitbitFamilyEnabled,
      isGarminEnabled: settings.isGarminEnabled,
      isWithingsEnabled: settings.isWithingsEnabled,
    }),
    settings.statsMetricOrder,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <InsightsHeader
        title={t("statisticsSettings.title")}
        backPath="/nutrition/statistics"
      />
      {!settings.isReady ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("common.loading")} />
        </div>
      ) : (
        <>
          <SectionCard
            title={t("statisticsSettings.chart")}
            hint={t("statisticsSettings.chartHint")}
          >
            <Stack gap={1} align="start">
              <Text variant="label">{t("statisticsSettings.chartType")}</Text>
              <SegmentedControl
                aria-label={t("statisticsSettings.chartType")}
                value={values.statsChartType === "bar" ? "bar" : "line"}
                onChange={(next) => {
                  set("statsChartType", next);
                }}
                options={[
                  { value: "bar", label: t("statistics.chart.bar") },
                  { value: "line", label: t("statistics.chart.line") },
                ]}
              />
            </Stack>
            {TOGGLES.map((toggle) => (
              <ToggleRow
                key={toggle.key}
                label={t(`statisticsSettings.toggles.${toggle.id}.label`)}
                hint={
                  toggle.hasHint
                    ? t(`statisticsSettings.toggles.${toggle.id}.hint`)
                    : undefined
                }
                isChecked={values[toggle.key]}
                onChange={(isOn) => {
                  set(toggle.key, isOn);
                }}
              />
            ))}
          </SectionCard>
          <SectionCard
            title={t("statisticsSettings.categories")}
            hint={t("statisticsSettings.categoriesHint")}
          >
            <OrderList
              items={metrics.map((m) => ({
                key: m.key,
                label: metricLabel(m.key, t),
                isVisible: !settings.statsHiddenMetrics.includes(m.key),
              }))}
              onOrderChange={(keys) => {
                set("statsMetricOrder", keys);
              }}
              onVisibilityChange={(key) => {
                set(
                  "statsHiddenMetrics",
                  toggleValue(settings.statsHiddenMetrics, key),
                );
              }}
            />
          </SectionCard>
          <Button
            variant="secondary"
            size="md"
            text={t("bodyStatsSettings.title")}
            onClick={() => void navigate("/nutrition/statistics/body-stats")}
          >
            <Ruler aria-hidden size={16} />
          </Button>
        </>
      )}
    </div>
  );
}
