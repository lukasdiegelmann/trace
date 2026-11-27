import { Button, Input, Text } from "@monocircuit/monolithium/components";
import { useEffect, useRef, useState } from "react";

import { groupMetrics, type StatsMetric } from "../../lib/insights/statistics";
import { useInsightsT } from "../useInsightsT";
import { metricLabel } from "./labels";

export interface MetricPickerProps {
  metrics: StatsMetric[];
  metric: string;
  onPick: (metric: string) => void;
}

/** Accent- and case-insensitive, like the original's foldText */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * The metrics by group: a row to swipe through on phones, a rail with a
 * filter on wide screens.
 */
export function MetricPicker({ metrics, metric, onPick }: MetricPickerProps) {
  const { t } = useInsightsT();
  const [query, setQuery] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // The picked metric may sit far off the swipe row (deep links)
  useEffect(() => {
    list.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [metric]);
  const groups = groupMetrics(metrics)
    .map((g) => ({
      ...g,
      metrics: g.metrics.filter((m) =>
        fold(metricLabel(m.key, t)).includes(fold(query)),
      ),
    }))
    .filter((g) => g.metrics.length > 0);

  return (
    <nav
      aria-label={t("statistics.metricPicker")}
      className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto"
    >
      <div className="hidden lg:block">
        <Input
          name="metric-filter"
          label={t("statistics.filterMetrics")}
          fieldSize="sm"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      <div
        ref={list}
        className="flex min-w-0 gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
      >
        {groups.map((g) => (
          <div key={g.group} className="flex shrink-0 gap-1 lg:flex-col">
            <div className="hidden px-2 pt-2 lg:block">
              <Text variant="label" tone="muted">
                {t(`statistics.groups.${g.group}`)}
              </Text>
            </div>
            {g.metrics.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={m.key === metric ? "secondary" : "ghost"}
                aria-pressed={m.key === metric}
                text={metricLabel(m.key, t)}
                onClick={() => {
                  onPick(m.key);
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
