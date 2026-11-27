import { Stack, Text, Tile } from "@monocircuit/monolithium/components";
import { ChevronRight, Map as MapIcon } from "lucide-react";

import { displayEnergy } from "../../lib/insights/nutrition";
import {
  formatDistance,
  formatDuration,
  workoutKind,
} from "../../lib/insights/wellness";
import type { Workout } from "../api";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";
import { WORKOUT_ICONS } from "./icons";

export interface WorkoutListProps {
  workouts: Workout[];
  distUnit: string;
  energyUnit: string;
  onOpen: (workout: Workout) => void;
}

export function WorkoutList({
  workouts,
  distUnit,
  energyUnit,
  onOpen,
}: WorkoutListProps) {
  const { t, locale } = useInsightsT();

  const meta = (w: Workout) => {
    const parts = [formatDuration(w.duration_ms)];
    if (w.distance_km !== null) {
      const d = formatDistance(w.distance_km, distUnit, locale);
      parts.push(`${d.value} ${d.unit}`);
    }
    if (w.calories) {
      const e = displayEnergy(w.calories, energyUnit);
      parts.push(`${e.value.toLocaleString(locale)} ${e.unit}`);
    }
    return parts.join(" · ");
  };
  const heartRate = (w: Workout) =>
    w.avg_hr
      ? t(w.max_hr ? "wellness.workouts.hrWithPeak" : "wellness.workouts.hr", {
          avg: w.avg_hr,
          max: w.max_hr,
        })
      : null;

  return (
    <SectionCard
      title={t("wellness.workouts.title")}
      hint={t("wellness.workouts.sessions", { count: workouts.length })}
    >
      <Stack gap={2}>
        {workouts.map((w) => {
          const Icon = WORKOUT_ICONS[workoutKind(w.activity_name)];
          const name = w.activity_name ?? t("wellness.workouts.unnamed");
          return (
            <Tile
              key={w.id}
              label={t("wellness.workouts.open", { name })}
              onPress={() => {
                onOpen(w);
              }}
            >
              <span className="flex items-center gap-3">
                <Icon aria-hidden size={20} className="text-accent-text" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <Text as="span" variant="small" isTruncated>
                    {name}
                  </Text>
                  <Text as="span" variant="caption">
                    {meta(w)}
                  </Text>
                  {heartRate(w) ? (
                    <Text as="span" variant="caption">
                      {heartRate(w)}
                    </Text>
                  ) : null}
                </span>
                {w.has_gps ? (
                  <MapIcon
                    size={16}
                    className="text-accent-text"
                    aria-label={t("wellness.workouts.hasRoute")}
                  />
                ) : null}
                <ChevronRight aria-hidden size={16} />
              </span>
            </Tile>
          );
        })}
      </Stack>
    </SectionCard>
  );
}
