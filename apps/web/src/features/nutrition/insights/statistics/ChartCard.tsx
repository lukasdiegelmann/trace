import {
  Button,
  Checkbox,
  EmptyState,
  Legend,
  Meter,
  Row,
  ScrollArea,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
  TimeSeriesChart,
} from "@monocircuit/monolithium/components";
import { ChartColumn, ChartLine, Download } from "lucide-react";

import { formatDay, parseDay, localDateStr } from "../../lib/insights/dates";
import {
  chartBaseline,
  displayRows,
  emptyAlternatives,
  hasValue,
  isPhysiologicalMetric,
  toCsv,
  trendLine,
  type DayValue,
  type StatsMetric,
  type Summary,
} from "../../lib/insights/statistics";
import { isNutriment } from "../../lib/insights/nutrition";
import type { InsightSettings } from "../useNtSettings";
import { useInsightsT } from "../useInsightsT";
import { metricLabel } from "./labels";

export interface ChartCardProps {
  metric: string;
  metrics: StatsMetric[];
  range: string;
  unit: string;
  rows: DayValue[];
  summary: Summary | null;
  goalValue: number | null;
  /** Days marked complete in the range, when the setting is on */
  completedDays: Set<string> | null;
  isLoading: boolean;
  settings: InsightSettings;
  onPickMetric: (metric: string) => void;
}

const AVERAGE_COLOR = "var(--color-muted)";
const GOAL_COLOR = "var(--color-success)";
const TREND_COLOR = "var(--color-warning)";
const VALUE_COLOR = "var(--color-accent)";

function downloadCsv(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ChartCard(props: ChartCardProps) {
  const { metric, metrics, rows, unit, summary, goalValue, settings } = props;
  const { t, locale } = useInsightsT();
  const { values } = settings;
  const isBar = values.statsChartType === "bar";
  const label = metricLabel(metric, t);
  const logged = rows.filter(hasValue);
  const shown = displayRows(rows, values.statsShowEmptyDays);

  const isGoalShown = values.statsGoalLine && !!goalValue;
  const isBaseGoal =
    metric === "calories" &&
    (values.calorieGoalMode === "dynamic" ||
      values.calorieGoalMode === "adaptive");
  const goalLabel = t(
    isBaseGoal ? "statistics.chart.baseGoal" : "statistics.chart.goal",
  );

  // A goal outside the data widens the auto-fitted axis of body metrics, so
  // the way towards it stays visible (#67).
  const isPhysiological = isPhysiologicalMetric(metric);
  const trend = values.statsTrendLine
    ? trendLine(logged.map((r) => r.val))
    : null;
  const axisValues = [
    ...logged.map((r) => r.val),
    ...(trend ?? []),
    ...(isPhysiological && goalValue ? [goalValue] : []),
    ...(isGoalShown ? [goalValue] : []),
  ];
  const baseline = chartBaseline(
    axisValues,
    values.statsYZero && !isPhysiological,
  );

  const format = (n: number) =>
    n.toLocaleString(locale, { maximumFractionDigits: 1 });
  const formatValue = (offset: number) => format(offset + baseline);
  const series = (value: (index: number) => number) =>
    logged.map((row, i) => ({
      x: parseDay(row.date),
      value: value(i) - baseline,
    }));
  const overlays = [
    ...(values.statsAvgLine && summary
      ? [
          {
            label: t("statistics.chart.average"),
            color: AVERAGE_COLOR,
            data: series(() => summary.avg),
          },
        ]
      : []),
    ...(isGoalShown
      ? [{ label: goalLabel, color: GOAL_COLOR, data: series(() => goalValue) }]
      : []),
    ...(trend
      ? [
          {
            label: t("statistics.chart.trend"),
            color: TREND_COLOR,
            data: series((i) => trend[i]),
          },
        ]
      : []),
  ];
  const emptyDays = shown.length - logged.length;
  const barMax = Math.max(...axisValues, baseline + 1) - baseline;

  const emptyHint = isNutriment(metric)
    ? "statistics.empty.food"
    : metric.startsWith("wl_")
      ? "statistics.empty.wellness"
      : "statistics.empty.other";

  return (
    <section
      aria-label={label}
      className="flex min-w-0 flex-col gap-3 rounded-container border border-border bg-level-1 p-4"
    >
      <Row gap={2} align="center" justify="between" shouldWrap>
        <Text variant="heading" as="h2">
          {unit ? `${label} (${unit})` : label}
        </Text>
        <Row gap={2} align="center">
          <SegmentedControl
            aria-label={t("statistics.chart.type")}
            value={isBar ? "bar" : "line"}
            onChange={(next) => {
              settings.set("statsChartType", next);
            }}
            options={[
              {
                value: "bar",
                label: (
                  <ChartColumn
                    aria-label={t("statistics.chart.bar")}
                    size={16}
                  />
                ),
              },
              {
                value: "line",
                label: (
                  <ChartLine
                    aria-label={t("statistics.chart.line")}
                    size={16}
                  />
                ),
              },
            ]}
          />
          {logged.length ? (
            <Button
              size="sm"
              variant="secondary"
              aria-label={t("statistics.chart.exportCsv")}
              onClick={() => {
                downloadCsv(`${metric}-${props.range}.csv`, toCsv(rows));
              }}
            >
              <Download aria-hidden size={16} />
            </Button>
          ) : null}
        </Row>
      </Row>

      {props.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner label={t("common.loading")} />
        </div>
      ) : logged.length === 0 ? (
        <Stack gap={2} align="center">
          <EmptyState
            icon={<ChartLine aria-hidden size={32} />}
            text={`${t("statistics.empty.title")} ${t(emptyHint)}`}
          />
          {emptyAlternatives(metric, metrics).length ? (
            <Row gap={1} align="center" justify="center" shouldWrap>
              <Text variant="small" tone="muted">
                {t("statistics.empty.try")}
              </Text>
              {emptyAlternatives(metric, metrics).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant="secondary"
                  text={metricLabel(key, t)}
                  onClick={() => {
                    props.onPickMetric(key);
                  }}
                />
              ))}
            </Row>
          ) : null}
        </Stack>
      ) : isBar ? (
        // TODO(monolithium): a bar chart (TimeSeriesChart draws lines only);
        // a Meter per day until then.
        <ScrollArea maxHeight="tall" gap={2} shouldFollowEnd>
          {shown.map((row) => (
            <Meter
              key={row.date}
              size="sm"
              label={formatDay(row.date, "natural", locale)}
              value={row.val === null ? 0 : Math.max(0, row.val - baseline)}
              max={barMax}
              valueText={
                row.val === null ? "—" : `${format(row.val)} ${unit}`.trim()
              }
            />
          ))}
        </ScrollArea>
      ) : (
        // TODO(monolithium): TimeSeriesChart: gaps for empty days, dashed
        // overlay lines, a click on a point, per-day markers and a Y axis
        // that need not start at zero (the baseline offset stands in).
        <Stack gap={2}>
          <TimeSeriesChart
            ariaLabel={t("statistics.chart.ariaLabel", { metric: label })}
            valueLabel={unit ? `${label} (${unit})` : label}
            height={260}
            color={VALUE_COLOR}
            data={series((i) => logged[i].val)}
            series={overlays}
            formatValue={formatValue}
            formatX={(date) => formatDay(localDateStr(date), "natural", locale)}
          />
          <Legend
            items={[
              { label, color: VALUE_COLOR },
              ...overlays.map((o) => ({ label: o.label, color: o.color })),
            ]}
          />
          {values.statsShowEmptyDays && emptyDays > 0 ? (
            <Text variant="caption">
              {t("statistics.chart.emptyDays", { count: emptyDays })}
            </Text>
          ) : null}
        </Stack>
      )}

      {isBar && isGoalShown && logged.length ? (
        <Text variant="caption">
          {`${goalLabel}: ${format(goalValue)} ${unit}`}
        </Text>
      ) : null}

      <Row gap={2} shouldWrap>
        <Checkbox
          label={t("statistics.chart.average")}
          checked={values.statsAvgLine}
          onChange={(isOn) => {
            settings.set("statsAvgLine", isOn);
          }}
        />
        <Checkbox
          label={t("statistics.chart.goal")}
          checked={values.statsGoalLine}
          onChange={(isOn) => {
            settings.set("statsGoalLine", isOn);
          }}
        />
        <Checkbox
          label={t("statistics.chart.trend")}
          checked={values.statsTrendLine}
          onChange={(isOn) => {
            settings.set("statsTrendLine", isOn);
          }}
        />
      </Row>
    </section>
  );
}
