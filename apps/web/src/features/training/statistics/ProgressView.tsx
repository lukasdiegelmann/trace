import {
  Button,
  Input,
  Panel,
  Pressable,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronDown, Search, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { formatDay } from "../common/format";
import { LineChart, type ChartLine } from "../common/LineChart";
import { LoadFailed, Loading } from "../common/LoadState";
import { useResource } from "../common/useResource";
import { progressSeries } from "../lib/statistics";
import { foldText } from "../lib/searchText";
import { fmtSetDuration } from "../lib/workout";
import { getExerciseProgress, type PickableExercise } from "./api";
import { categoryName } from "./categoryName";
import { StatCards } from "./StatCards";
import type { ViewProps } from "./viewProps";

export interface ProgressViewProps extends ViewProps {
  exerciseId: number | null;
  onPick: (id: number) => void;
}

/** One exercise's top set (or longest hold) per session, with its RPE */
export function ProgressView({
  exercises,
  start,
  end,
  exerciseId,
  onPick,
}: ProgressViewProps) {
  const { t } = useTranslation("training");
  const [isPicking, setIsPicking] = useState(false);
  const exercise = exercises.find((e) => e.id === exerciseId);
  return (
    <Stack gap={3}>
      <Button
        variant="secondary"
        isFullWidth
        isIconTrailing
        text={exercise?.name ?? t("statistics.progress.choose")}
        onClick={() => {
          setIsPicking(true);
        }}
      >
        <ChevronDown aria-hidden size={16} />
      </Button>
      {exerciseId === null ? (
        <EmptyNote
          icon={<TrendingUp aria-hidden />}
          text={t("statistics.progress.intro")}
        />
      ) : (
        <ExerciseProgress
          exerciseId={exerciseId}
          name={exercise?.name ?? ""}
          start={start}
          end={end}
        />
      )}
      <Sheet
        isOpen={isPicking}
        title={t("statistics.progress.choose")}
        onOpenChange={setIsPicking}
      >
        {isPicking && (
          <ExerciseChoice
            exercises={exercises}
            onPick={(id) => {
              onPick(id);
              setIsPicking(false);
            }}
          />
        )}
      </Sheet>
    </Stack>
  );
}

function ExerciseChoice({
  exercises,
  onPick,
}: {
  exercises: PickableExercise[];
  onPick: (id: number) => void;
}) {
  const { t } = useTranslation("training");
  const [search, setSearch] = useState("");
  const matches = exercises
    .filter((e) => !search || foldText(e.name).includes(foldText(search)))
    .slice(0, 50);
  return (
    <Stack gap={2}>
      <Input
        type="search"
        aria-label={t("statistics.progress.search")}
        placeholder={t("statistics.progress.search")}
        icon={<Search aria-hidden size={16} />}
        value={search}
        onValueChange={setSearch}
        autoFocus
      />
      {matches.length === 0 ? (
        <Text tone="muted">
          {exercises.length
            ? t("statistics.progress.noMatch")
            : t("statistics.progress.noExercises")}
        </Text>
      ) : (
        <ul className="flex flex-col gap-1">
          {matches.map((exercise) => (
            <li key={exercise.id}>
              <Pressable
                className="flex w-full flex-col rounded-control p-2 text-left"
                label={exercise.name}
                onPress={() => {
                  onPick(exercise.id);
                }}
              >
                <Text>{exercise.name}</Text>
                {exercise.category && (
                  <Text variant="caption" tone="muted">
                    {categoryName(t, exercise.category)}
                  </Text>
                )}
              </Pressable>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}

function ExerciseProgress({
  exerciseId,
  name,
  start,
  end,
}: {
  exerciseId: number;
  name: string;
  start: string;
  end: string;
}) {
  const { t, i18n } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");
  const progress = useResource(`progress-${exerciseId}-${start}-${end}`, () =>
    getExerciseProgress(exerciseId, start, end),
  );
  if (progress.error && !progress.data) {
    return <LoadFailed error={progress.error} onRetry={progress.reload} />;
  }
  if (!progress.data) {
    return <Loading label={t("statistics.progress.loading")} />;
  }
  const { isTimed, points, stats } = progressSeries(progress.data);
  const first = points.at(0);
  const last = points.at(-1);
  if (!stats || !first || !last) {
    return <EmptyNote text={t("statistics.progress.noData", { name })} />;
  }
  const format = (value: number) =>
    isTimed ? fmtSetDuration(value) : `${value} ${unit}`;
  const title = isTimed
    ? t("statistics.progress.longestHold")
    : t("statistics.progress.topSet");
  const padding = isTimed ? 2 : 5;
  const lines: ChartLine[] = [
    {
      label: title,
      points: points.map((p, x) => ({ x, value: p.value })),
      min: stats.min - padding,
      max: stats.max + padding,
      format,
    },
  ];
  // The RPE sits on the same session index as the value it belongs to.
  const rpe = points.flatMap((p, x) =>
    p.rpe === null ? [] : [{ x, value: Math.min(10, Math.max(5, p.rpe)) }],
  );
  if (rpe.length >= 2) {
    lines.push({
      label: t("statistics.progress.averageRpe"),
      points: rpe,
      min: 5,
      max: 10,
      format: (value) => `RPE ${value}`,
    });
  }
  const label = (p: { date: string; value: number }) =>
    `${formatDay(p.date, i18n.language)} · ${format(p.value)}`;
  return (
    <Stack gap={3}>
      <StatCards
        cards={[
          { label: t("statistics.max"), value: format(stats.max) },
          { label: t("statistics.min"), value: format(stats.min) },
          { label: t("statistics.average"), value: format(stats.average) },
          {
            label: t("statistics.sessionsLabel"),
            value: String(points.length),
          },
        ]}
      />
      <Panel title={title}>
        <LineChart
          ariaLabel={title}
          lines={lines}
          from={0}
          until={points.length - 1}
          start={label(first)}
          end={label(last)}
        />
      </Panel>
      <Panel title={t("statistics.progress.history")}>
        <ul className="flex flex-col gap-2">
          {[...points].reverse().map((p, index) => (
            <li
              key={`${p.date}-${index}`}
              className="flex flex-wrap justify-between gap-2"
            >
              <Text variant="small" tone="muted">
                {formatDay(p.date, i18n.language)}
              </Text>
              <Text variant="small">
                {format(p.value)} ·{" "}
                {t("statistics.progress.sets", { count: p.sets })}
              </Text>
            </li>
          ))}
        </ul>
      </Panel>
    </Stack>
  );
}
