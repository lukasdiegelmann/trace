import {
  DataTable,
  EmptyState,
  Text,
} from "@monocircuit/monolithium/components";
import { Scale } from "lucide-react";

import {
  BODY_METRICS,
  BODY_SCORE_METRICS,
  formatMetricValue,
  formatWeight,
  isMetricVisible,
  numberOf,
  SEGMENTS,
  type DayMetrics,
  type FormatSettings,
  type SimpleMetric,
} from "../../lib/insights/wellness";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";
import { MetricGrid, MetricTile } from "./MetricTile";

export interface BodyTabProps {
  /** Withings' values of the day, then the fitbit family's */
  withings: DayMetrics;
  fitbit: DayMetrics;
  wellnessMetrics: string[] | null;
  format: FormatSettings;
  celebrating: string[];
  isLoading: boolean;
  /** Said when the day has no body data at all */
  emptyText: string;
}

export function BodyTab(props: BodyTabProps) {
  const { t } = useInsightsT();
  const read = (key: string) =>
    numberOf(props.withings[key] ?? props.fitbit[key]);
  const isVisible = (id: string) => isMetricVisible(props.wellnessMetrics, id);

  const tile = (metric: SimpleMetric) => {
    const formatted = formatMetricValue(metric, read(metric.id), props.format);
    return (
      <MetricTile
        key={metric.id}
        id={metric.id}
        isLoading={props.isLoading}
        isCelebrating={props.celebrating.includes(metric.id)}
        value={
          formatted && metric.format === "afib"
            ? { value: t(`wellness.afib.${formatted.value}`), unit: "" }
            : formatted
        }
      />
    );
  };

  const scores = BODY_SCORE_METRICS.filter(
    (m) => isVisible(m.id) && read(m.id) !== null,
  );
  const weight = (key: string) => {
    const kg = read(key);
    if (kg === null) return "—";
    const w = formatWeight(kg, props.format.weightUnit, props.format.locale);
    return `${w.value} ${w.unit}`;
  };
  const segments = isVisible("segmental_analysis")
    ? SEGMENTS.filter((s) => read(s.muscle) !== null || read(s.lean) !== null)
    : [];
  const isEmpty =
    Object.keys(props.withings).length === 0 &&
    !BODY_METRICS.some((m) => numberOf(props.fitbit[m.id]) !== null);

  return (
    <>
      <MetricGrid>
        {BODY_METRICS.filter((m) => isVisible(m.id)).map(tile)}
      </MetricGrid>
      {scores.length ? (
        <SectionCard title={t("wellness.body.scores")}>
          <MetricGrid>{scores.map(tile)}</MetricGrid>
        </SectionCard>
      ) : null}
      {segments.length ? (
        <SectionCard
          title={t("wellness.body.segmental")}
          hint={t("wellness.body.segmentalNote")}
        >
          <DataTable
            aria-label={t("wellness.body.segmental")}
            columns={[
              {
                key: "segment",
                header: t("wellness.body.segment"),
                cell: (row) => (
                  <Text as="span" variant="small">
                    {t(`wellness.body.segments.${row.id}`)}
                  </Text>
                ),
              },
              {
                key: "muscle",
                header: t("wellness.body.muscle"),
                cell: (row) => weight(row.muscle),
              },
              {
                key: "lean",
                header: t("wellness.body.lean"),
                cell: (row) => weight(row.lean),
              },
            ]}
            rows={[...segments]}
            getRowKey={(row) => row.id}
          />
        </SectionCard>
      ) : null}
      {!props.isLoading && isEmpty ? (
        <EmptyState
          icon={<Scale aria-hidden size={40} />}
          text={props.emptyText}
        />
      ) : null}
    </>
  );
}
