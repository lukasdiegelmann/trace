import {
  formatMetricValue,
  GARMIN_METRICS,
  isMetricVisible,
  numberOf,
  resilienceCategory,
  type DayMetrics,
  type Readiness,
  type ReadinessCalibrating,
} from "../../lib/insights/wellness";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";
import { MetricGrid, MetricTile } from "./MetricTile";
import { MetricTiles } from "./MetricTiles";
import { ReadinessCard, ResilienceCard } from "./ScoreCards";
import type { MetricTabProps } from "./tabProps";

export interface HeartTabProps extends MetricTabProps {
  /** Garmin's values of the day, when Garmin is connected */
  garmin: DayMetrics | null;
  readiness: Readiness | ReadinessCalibrating | null;
}

export function HeartTab(props: HeartTabProps) {
  const { t } = useInsightsT();
  const { data, garmin } = props;
  const garminMetrics =
    garmin && props.sources.isGarminEnabled
      ? GARMIN_METRICS.filter(
          (m) =>
            isMetricVisible(props.wellnessMetrics, m.id) &&
            numberOf(garmin[m.id]) !== null,
        )
      : [];
  const category = resilienceCategory(data.resilience_category);

  return (
    <>
      <MetricTiles {...props} group="heart" />
      {garminMetrics.length ? (
        <SectionCard title={t("wellness.garminTitle")}>
          <MetricGrid>
            {garminMetrics.map((m) => (
              <MetricTile
                key={m.id}
                id={m.id}
                isLoading={props.isLoading}
                value={formatMetricValue(
                  m,
                  numberOf(garmin?.[m.id]),
                  props.format,
                )}
              />
            ))}
          </MetricGrid>
        </SectionCard>
      ) : null}
      {props.readiness ? <ReadinessCard readiness={props.readiness} /> : null}
      {category ? (
        <ResilienceCard
          category={category}
          score={numberOf(data.resilience_score) ?? 0}
          calmness={numberOf(data.resilience_calmness) ?? 0}
          activity={numberOf(data.resilience_activity) ?? 0}
          sleep={numberOf(data.resilience_sleep) ?? 0}
        />
      ) : null}
    </>
  );
}
