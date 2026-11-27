import {
  Button,
  Sparkline,
  Text,
  Tile,
} from "@monocircuit/monolithium/components";
import { TrendingUp } from "lucide-react";

import type { FormattedValue } from "../../lib/insights/wellness";
import { unitLabel } from "../statistics/labels";
import { useInsightsT } from "../useInsightsT";
import { METRIC_ICONS } from "./icons";

export interface MetricTileProps {
  id: string;
  value: FormattedValue | null;
  isLoading: boolean;
  /** The last 7 days, oldest first */
  history?: (number | null)[];
  /** A second line below the value, e.g. "3 moments" */
  detail?: string;
  onTrend?: () => void;
  /** The metric just crossed its goal */
  isCelebrating?: boolean;
}

export function MetricTile(props: MetricTileProps) {
  const { t } = useInsightsT();
  const label = t(`wellness.metrics.${props.id}`);
  const Icon = METRIC_ICONS[props.id];
  const points = (props.history ?? []).flatMap((value, x) =>
    value === null ? [] : [{ x, value }],
  );
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <Tile
      title={t(`wellness.descriptions.${props.id}`)}
      isHighlighted={props.isCelebrating}
      className="flex h-full flex-col gap-1"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {Icon ? (
            <Icon aria-hidden size={16} className="shrink-0 text-accent-text" />
          ) : null}
          <Text as="span" variant="label" tone="muted" isTruncated>
            {label}
          </Text>
        </span>
        {props.onTrend && props.value ? (
          <Button
            size="sm"
            aria-label={t("wellness.viewTrend", { metric: label })}
            onClick={props.onTrend}
          >
            <TrendingUp aria-hidden size={14} />
          </Button>
        ) : null}
      </span>
      <span className="flex items-baseline gap-1">
        <Text
          as="span"
          variant="title"
          tone={!props.isLoading && props.value ? "default" : "muted"}
        >
          {!props.isLoading && props.value ? props.value.value : "—"}
        </Text>
        {!props.isLoading && props.value?.unit ? (
          <Text as="span" variant="caption">
            {unitLabel(props.value.unit, t)}
          </Text>
        ) : null}
      </span>
      {props.detail ? (
        <Text as="span" variant="caption">
          {props.detail}
        </Text>
      ) : null}
      {points.length > 1 ? (
        <Sparkline
          points={points}
          from={0}
          until={6}
          min={min}
          max={max > min ? max : min + 1}
          height={24}
        />
      ) : null}
    </Tile>
  );
}

/** The grid the metric tiles sit in */
export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{children}</div>
  );
}
