import { Stat } from "@monocircuit/monolithium/components";

import {
  isDeltaGood,
  type CompletionStats,
  type Summary,
} from "../../lib/insights/statistics";
import { useInsightsT } from "../useInsightsT";

export interface SummaryStatsProps {
  summary: Summary;
  unit: string;
  /** Average vs goal in %, null without a goal */
  delta: number | null;
  /** A floor goal: above is good */
  isMinimumGoal: boolean;
  hasGoal: boolean;
  completion: CompletionStats | null;
  /** Last 7 logged days vs the 7 before, in % */
  trend: number | null;
}

function signed(value: number): string {
  return value > 0 ? `+${value} %` : `${value} %`;
}

export function SummaryStats({
  summary,
  unit,
  delta,
  isMinimumGoal,
  hasGoal,
  completion,
  trend,
}: SummaryStatsProps) {
  const { t, locale } = useInsightsT();
  const number = (n: number) => n.toLocaleString(locale);
  const isTrendBad =
    trend !== null && hasGoal && !isDeltaGood(trend, isMinimumGoal);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat
        label={t("statistics.summary.average")}
        value={number(summary.avg)}
        hint={
          delta === null
            ? unit
            : `${unit} · ${t("statistics.summary.vsGoal", { delta: signed(delta) })}`
        }
        tone={
          delta !== null && !isDeltaGood(delta, isMinimumGoal)
            ? "warning"
            : "default"
        }
      />
      <Stat
        label={t("statistics.summary.min")}
        value={number(summary.min)}
        hint={unit}
      />
      <Stat
        label={t("statistics.summary.max")}
        value={number(summary.max)}
        hint={unit}
      />
      <Stat
        label={t("statistics.summary.logged")}
        value={number(summary.daysWithData)}
        hint={t("statistics.summary.days", { count: summary.daysWithData })}
      />
      {completion ? (
        <Stat
          label={t("statistics.summary.completed")}
          value={`${completion.marked} / ${completion.total}`}
          hint={`${completion.pct} %`}
        />
      ) : null}
      {trend !== null ? (
        <Stat
          label={t("statistics.summary.weeklyTrend")}
          value={`${trend > 0 ? "↑" : trend < 0 ? "↓" : "·"} ${Math.abs(trend)} %`}
          hint={t("statistics.summary.weeklyTrendHint")}
          tone={isTrendBad ? "warning" : "default"}
        />
      ) : null}
    </div>
  );
}
