import {
  formatMetricValue,
  isMetricVisible,
  isSourceEnabled,
  numberOf,
  STATS_METRIC_OF,
  WELLNESS_METRICS,
  type MetricTabGroup,
} from "../../lib/insights/wellness";
import { MetricGrid, MetricTile } from "./MetricTile";
import type { MetricTabProps } from "./tabProps";

/** The cards of one group: visible, from a source that is on */
export function MetricTiles({
  group,
  ...props
}: MetricTabProps & { group: MetricTabGroup }) {
  const metrics = WELLNESS_METRICS.filter(
    (m) =>
      m.group === group &&
      isMetricVisible(props.wellnessMetrics, m.id) &&
      isSourceEnabled(m, props.sources) &&
      !m.isTileHidden &&
      !(m.isHiddenIfEmpty && props.data[m.id] == null),
  );
  const vo2Range = props.data.vo2_max_range;
  return (
    <MetricGrid>
      {metrics.map((m) => {
        const statsMetric = STATS_METRIC_OF[m.id];
        return (
          <MetricTile
            key={m.id}
            id={m.id}
            isLoading={props.isLoading}
            isCelebrating={props.celebrating.includes(m.id)}
            history={props.series[m.id]}
            onTrend={
              statsMetric
                ? () => {
                    props.onTrend(statsMetric);
                  }
                : undefined
            }
            value={formatMetricValue(
              m,
              numberOf(props.data[m.id]),
              props.format,
              vo2Range == null ? null : String(vo2Range),
            )}
          />
        );
      })}
    </MetricGrid>
  );
}
