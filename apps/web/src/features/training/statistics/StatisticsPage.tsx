import {
  Banner,
  Panel,
  SegmentedControl,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { BODY_STATS_SAVED } from "../common/events";
import { LoadFailed, Loading } from "../common/LoadState";
import { useResource } from "../common/useResource";
import {
  localDay,
  parseRange,
  periodDeltas,
  type Range,
  RANGES,
  rangeStart,
  withExercises,
} from "../lib/statistics";
import {
  getEarliestWorkoutDate,
  getExerciseList,
  getStatistics,
  type PickableExercise,
} from "./api";
import { OverviewView } from "./OverviewView";
import { ProgressView } from "./ProgressView";
import { RecordsView } from "./RecordsView";
import { CardioView, FrequencyView, VolumeView } from "./TrendViews";
import type { ViewProps } from "./viewProps";
import { WeightView } from "./WeightView";

const METRICS = [
  "overview",
  "progress",
  "records",
  "volume",
  "frequency",
  "weight",
  "cardio",
] as const;
type Metric = (typeof METRICS)[number];

const VIEWS = {
  overview: OverviewView,
  records: RecordsView,
  volume: VolumeView,
  frequency: FrequencyView,
  weight: WeightView,
  cardio: CardioView,
} satisfies Record<
  Exclude<Metric, "progress">,
  (props: ViewProps) => React.ReactNode
>;

/** /training/statistics, e.g. `?range=1W&metric=volume` */
export function StatisticsPage() {
  const { t } = useTranslation("training");
  const [params, setParams] = useSearchParams();
  const [isCardioOn] = useSetting("lt", "cardioEnabled");
  const [exerciseId, setExerciseId] = useState<number | null>(null);

  // Metric and range live in the URL, so "back" returns to the same view.
  const range = parseRange(params.get("range"));
  const wanted = (METRICS as readonly string[]).includes(
    params.get("metric") ?? "",
  )
    ? (params.get("metric") as Metric)
    : "overview";
  const metric = wanted === "cardio" && !isCardioOn ? "overview" : wanted;
  const setParam = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const exercises = useResource("statistics-exercises", () =>
    getExerciseList().catch((): PickableExercise[] => []),
  );
  const earliest = useResource("earliest-workout", () =>
    getEarliestWorkoutDate().catch(() => null),
  );
  const end = localDay();
  const isWaiting = range === "All" && earliest.data === undefined;
  const start = rangeStart(range, earliest.data ?? null);
  const statistics = useResource(
    isWaiting ? "statistics-waiting" : `statistics-${range}-${start}-${end}`,
    () =>
      isWaiting
        ? new Promise<never>(() => undefined)
        : getStatistics(start, end, range === "All" ? "2000-01-01" : start),
  );

  const { reload } = statistics;
  useEffect(() => {
    window.addEventListener(BODY_STATS_SAVED, reload);
    return () => {
      window.removeEventListener(BODY_STATS_SAVED, reload);
    };
  }, [reload]);

  const data = statistics.data;
  const rangeLabel = t(`statistics.ranges.${range}`);
  const deltas =
    data?.workouts && data.volume && data.frequency
      ? periodDeltas(withExercises(data.workouts), range, start, {
          volume: data.volume.reduce((sum, w) => sum + w.volume, 0),
          workouts: data.frequency.reduce((sum, w) => sum + w.count, 0),
          hasVolume: data.volume.length > 0,
        })
      : null;

  const viewProps: ViewProps | null = data
    ? {
        data,
        exercises: exercises.data ?? [],
        range,
        rangeLabel,
        start,
        end,
        deltas,
      }
    : null;
  const View = metric === "progress" ? null : VIEWS[metric];

  return (
    <Stack gap={3} padding={4} className="mx-auto w-full max-w-4xl">
      <Text variant="title" as="h1">
        {t("statistics.title")}
      </Text>
      <div className="overflow-x-auto">
        <SegmentedControl<Metric>
          variant="pill"
          aria-label={t("statistics.metricLabel")}
          value={metric}
          onChange={(next) => {
            setParam("metric", next);
          }}
          options={METRICS.filter((id) => id !== "cardio" || isCardioOn).map(
            (id) => ({ value: id, label: t(`statistics.metrics.${id}`) }),
          )}
        />
      </div>
      <div className="overflow-x-auto">
        <SegmentedControl<Range>
          aria-label={t("statistics.rangeLabel")}
          value={range}
          onChange={(next) => {
            setParam("range", next);
          }}
          options={RANGES.map((value) => ({
            value,
            label: t(`statistics.rangeShort.${value}`),
          }))}
        />
      </div>

      {data?.hasFailed && (
        <div role="alert">
          <Banner
            text={t("statistics.loadFailed")}
            placement="inline"
            actionText={t("common.retry")}
            onAction={reload}
          />
        </div>
      )}
      {deltas && (
        <Panel
          density="compact"
          title={t("statistics.prior.title", { range: rangeLabel })}
        >
          <Text variant="small">
            {[
              deltas.volumePercent === null
                ? ""
                : t("statistics.prior.volume", {
                    percent: signed(deltas.volumePercent),
                  }),
              t("statistics.prior.sessions", {
                percent: signed(deltas.countPercent),
              }),
              t("statistics.prior.window", { count: deltas.priorCount }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Panel>
      )}

      {statistics.error && !data ? (
        <LoadFailed error={statistics.error} onRetry={reload} />
      ) : !viewProps ? (
        <Loading label={t("statistics.loading")} />
      ) : View ? (
        <View {...viewProps} />
      ) : (
        <ProgressView
          {...viewProps}
          exerciseId={exerciseId}
          onPick={setExerciseId}
        />
      )}
    </Stack>
  );
}

function signed(percent: number): string {
  return `${percent > 0 ? "+" : ""}${percent}`;
}
