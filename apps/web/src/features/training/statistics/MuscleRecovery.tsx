import {
  Dot,
  Panel,
  Row,
  Stack,
  Text,
  type DotTone,
} from "@monocircuit/monolithium/components";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  CUT,
  FRONT,
  BACK,
  SOLID,
  type FigureRegion,
} from "../lib/statisticsFigure";
import {
  type Freshness,
  freshnessFor,
  type RecoveryGroup,
  type RecoveryState,
} from "../lib/statisticsMuscles";

const FILL: Record<Freshness, string> = {
  fatigued: "fill-destructive",
  recovering: "fill-warning",
  ready: "fill-accent",
  fresh: "fill-success",
  untrained: "fill-fg/35",
};
const DOT: Record<Exclude<Freshness, "untrained">, DotTone> = {
  fatigued: "danger",
  recovering: "warning",
  ready: "accent",
  fresh: "success",
};

export interface MuscleRecoveryProps {
  recovery: Record<RecoveryGroup, RecoveryState>;
  windowDays: number;
}

/** How rested each muscle group is, on a front and a back figure */
// TODO(monolithium): the recovery figure (same need as the body map)
export function MuscleRecovery({ recovery, windowDays }: MuscleRecoveryProps) {
  const { t } = useTranslation("training");
  const clip = useId();
  const [focused, setFocused] = useState<RecoveryGroup | null>(null);

  const since = (hours: number | null): string => {
    if (hours === null) return t("statistics.recovery.noWork");
    if (hours < 1) return t("statistics.recovery.justNow");
    if (hours < 24) return t("statistics.recovery.hoursAgo", { count: hours });
    return t("statistics.recovery.daysAgo", {
      count: Math.round(hours / 24),
    });
  };
  const describe = (group: RecoveryGroup): string => {
    const state = recovery[group];
    return [
      t(`statistics.recovery.groups.${group}`),
      t(`statistics.recovery.states.${freshnessFor(state.hoursAgo)}`),
      since(state.hoursAgo),
      t("statistics.recovery.sets", { count: state.sets }),
    ].join(" · ");
  };

  const silhouette = (
    <>
      {SOLID.map((shape, index) =>
        shape.t === "ellipse" ? (
          <ellipse
            key={index}
            cx={shape.cx}
            cy={shape.cy}
            rx={shape.rx}
            ry={shape.ry}
          />
        ) : (
          <path key={index} d={shape.d} />
        ),
      )}
    </>
  );

  const figure = (regions: FigureRegion[], offset: number) => (
    <g transform={`translate(${offset},0)`}>
      <g clipPath={`url(#${clip})`}>
        <g className="fill-fg/15">{silhouette}</g>
        <g className="fill-fg/15 stroke-bg">
          {CUT.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
        {regions.map((region) => {
          const group = region.key as RecoveryGroup;
          const show = () => {
            setFocused(group);
          };
          return (
            <path
              key={group}
              d={region.d}
              className={`cursor-pointer outline-none focus-visible:stroke-fg ${FILL[freshnessFor(recovery[group].hoursAgo)]}`}
              role="button"
              tabIndex={0}
              aria-label={describe(group)}
              onMouseEnter={show}
              onMouseLeave={() => {
                setFocused(null);
              }}
              onClick={show}
              onFocus={show}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                show();
              }}
            />
          );
        })}
      </g>
    </g>
  );

  return (
    <Panel
      title={t("statistics.recovery.title")}
      description={t("statistics.recovery.subtitle", { count: windowDays })}
    >
      <Stack gap={3}>
        <Row gap={3} className="flex-wrap">
          {(["fatigued", "recovering", "ready", "fresh"] as const).map(
            (state) => (
              <Row key={state} gap={1} align="center">
                <Dot tone={DOT[state]} />
                <Text variant="caption">
                  {t(`statistics.recovery.states.${state}`)}
                </Text>
              </Row>
            ),
          )}
        </Row>
        <svg viewBox="0 0 240 270" className="mx-auto max-h-80 w-full">
          <defs>
            <clipPath id={clip}>
              {silhouette}
              {CUT.map((d, index) => (
                <path key={index} d={d} />
              ))}
            </clipPath>
          </defs>
          {figure(FRONT, 0)}
          {figure(BACK, 120)}
        </svg>
        <Text variant="small" tone="muted" aria-live="polite">
          {focused ? describe(focused) : t("statistics.recovery.hint")}
        </Text>
      </Stack>
    </Panel>
  );
}
