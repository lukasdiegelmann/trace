import { Text } from "@monocircuit/monolithium/components";

import {
  formatMetricValue,
  isSourceEnabled,
  numberOf,
  sleepStages,
  WELLNESS_METRICS,
  type Chronotype,
  type SleepDebt,
} from "../../lib/insights/wellness";
import { useInsightsT } from "../useInsightsT";
import { MetricGrid, MetricTile } from "./MetricTile";
import { MetricTiles } from "./MetricTiles";
import { ChronotypeCard, SleepDebtCard, SleepStagesCard } from "./SleepCards";
import type { MetricTabProps } from "./tabProps";

export interface SleepTabProps extends MetricTabProps {
  debt: SleepDebt | null;
  debtRange: number;
  onDebtRangeChange: (range: number) => void;
  chronotype: Chronotype | null;
  timeFormat: string;
}

/** Fitbit's sleep quality values, shown once the day has any of them */
function SleepQuality(props: MetricTabProps) {
  const { t } = useInsightsT();
  const metrics = WELLNESS_METRICS.filter(
    (m) => m.group === "sleep_quality" && isSourceEnabled(m, props.sources),
  );
  if (!metrics.some((m) => props.data[m.id] != null)) return null;
  const awakenings = Math.round(
    numberOf(props.data.sleep_full_awakenings) ?? 0,
  );
  return (
    <>
      <Text variant="heading" as="h2">
        {t("wellness.sleepQuality")}
      </Text>
      <MetricGrid>
        {metrics
          .filter((m) => !m.isTileHidden)
          .map((m) => (
            <MetricTile
              key={m.id}
              id={m.id}
              isLoading={props.isLoading}
              history={props.series[m.id]}
              value={formatMetricValue(
                m,
                numberOf(props.data[m.id]),
                props.format,
              )}
              detail={
                m.id === "sleep_interruptions_min" && awakenings > 0
                  ? t("wellness.moments", { count: awakenings })
                  : undefined
              }
            />
          ))}
      </MetricGrid>
    </>
  );
}

export function SleepTab(props: SleepTabProps) {
  const duration = numberOf(props.data.sleep_duration_min);
  const { total, stages } = sleepStages(props.data);
  return (
    <>
      {!props.isLoading && duration !== null ? (
        <SleepStagesCard duration={duration} total={total} stages={stages} />
      ) : null}
      <MetricTiles {...props} group="sleep" />
      <SleepQuality {...props} />
      {props.debt ? (
        <SleepDebtCard
          debt={props.debt}
          range={props.debtRange}
          onRangeChange={props.onDebtRangeChange}
        />
      ) : null}
      {props.chronotype ? (
        <ChronotypeCard
          chronotype={props.chronotype}
          timeFormat={props.timeFormat}
        />
      ) : null}
    </>
  );
}
