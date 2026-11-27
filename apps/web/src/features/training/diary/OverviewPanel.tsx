import {
  ActionList,
  Button,
  Island,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Library } from "lucide-react";
import { useTranslation } from "react-i18next";

import { parseLocalDate, weekPeek } from "../lib/dates";
import type { WorkoutLog } from "../lib/workoutTypes";
import type { Prescription, Program } from "./api";
import { BodyStatsWidget } from "./BodyStatsWidget";
import type { Choice } from "./useDialogs";
import { GymToolsPanel } from "./GymTools";

export interface OverviewPanelProps {
  date: string;
  today: string;
  activeDates: Set<string>;
  streak: number;
  recent: WorkoutLog[];
  activeProgram: Program | null;
  log: WorkoutLog | null;
  prescription: Prescription | null;
  unit: "kg" | "lbs";
  actions: Choice[];
  onSelectDate: (date: string) => void;
  onLoadWorkout: () => void;
  onOpenBodyStats: () => void;
  onAction: (id: string) => void;
}

/** The week, recent workouts, the program and the diary's tools */
export function OverviewPanel({
  date,
  today,
  activeDates,
  streak,
  recent,
  activeProgram,
  log,
  prescription,
  unit,
  actions,
  onSelectDate,
  onLoadWorkout,
  onOpenBodyStats,
  onAction,
}: OverviewPanelProps) {
  const { t, i18n } = useTranslation("training");
  const week = weekPeek(activeDates, today);
  const full = (day: string) =>
    parseLocalDate(day).toLocaleDateString(i18n.language);

  return (
    <Stack gap={2}>
      <Island
        title={t("diary.overview.thisWeek")}
        note={t("diary.overview.weekCount", {
          count: week.filter((d) => d.isDone).length,
        })}
      >
        <Stack gap={2}>
          <div className="grid grid-cols-7 gap-0.5">
            {week.map((day) => (
              <Pressable
                key={day.date}
                label={
                  day.isDone
                    ? t("diary.overview.trainedDay", { date: full(day.date) })
                    : t("diary.overview.openDay", { date: full(day.date) })
                }
                isPressed={day.date === date}
                onPress={() => {
                  onSelectDate(day.date);
                }}
                align="center"
                paddingY={1}
                className={day.isToday ? "ring-1 ring-accent" : ""}
              >
                <Text variant="caption" tone="muted" as="span">
                  {parseLocalDate(day.date).toLocaleDateString(i18n.language, {
                    weekday: "narrow",
                  })}
                </Text>
                <Text variant="mono" as="span">
                  {String(parseLocalDate(day.date).getDate())}
                </Text>
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${day.isDone ? "bg-accent" : "bg-fg/15"}`}
                />
              </Pressable>
            ))}
          </div>
          {streak >= 2 && (
            <Text variant="caption">
              {`🔥 ${t("diary.streak", { count: streak })}`}
            </Text>
          )}
        </Stack>
      </Island>

      {recent.length > 0 && (
        <Island title={t("diary.overview.recent")}>
          <Stack gap={1}>
            {recent.map((workout) => (
              <Pressable
                key={workout.id}
                onPress={() => {
                  if (workout.date) onSelectDate(workout.date);
                }}
                align="start"
                padding={1}
              >
                <span className="flex w-full gap-2">
                  <Text variant="mono" tone="muted" as="span">
                    {workout.date
                      ? parseLocalDate(workout.date).toLocaleDateString(
                          i18n.language,
                          { month: "short", day: "numeric" },
                        )
                      : ""}
                  </Text>
                  <Text variant="small" as="span" isTruncated>
                    {workout.name || t("diary.untitled")}
                  </Text>
                </span>
              </Pressable>
            ))}
          </Stack>
        </Island>
      )}

      {activeProgram && (
        <Island title={activeProgram.name}>
          {log?.program_week ? (
            <Text variant="small" tone="muted">
              {log.program_duration_weeks
                ? t("diary.weekChipOf", {
                    week: log.program_week,
                    total: log.program_duration_weeks,
                  })
                : t("diary.weekChip", { week: log.program_week })}
            </Text>
          ) : activeProgram.duration_weeks ? (
            <Text variant="small" tone="muted">
              {t("diary.overview.programWeeks", {
                count: activeProgram.duration_weeks,
              })}
            </Text>
          ) : null}
        </Island>
      )}

      {prescription && (
        <Island title={t("diary.overview.todaysPlan")}>
          <Stack gap={0}>
            <Text>
              {prescription.template_name ||
                prescription.name ||
                t("diary.overview.scheduled")}
            </Text>
            {prescription.day_label && (
              <Text variant="caption" tone="muted">
                {prescription.day_label}
              </Text>
            )}
          </Stack>
        </Island>
      )}

      <Row>
        <Button
          variant="secondary"
          isFullWidth
          text={t("diary.toolbar.load")}
          onClick={onLoadWorkout}
        >
          <Library aria-hidden size={16} />
        </Button>
      </Row>
      <BodyStatsWidget date={date} onOpen={onOpenBodyStats} />
      <GymToolsPanel unit={unit} />
      <Island title={t("diary.toolbar.actions")}>
        <ActionList
          label={t("diary.toolbar.actions")}
          items={actions.map((action) => ({
            id: action.id,
            text: action.text,
            tone: action.isDanger ? ("danger" as const) : ("default" as const),
            onSelect: () => {
              onAction(action.id);
            },
          }))}
        />
      </Island>
    </Stack>
  );
}
