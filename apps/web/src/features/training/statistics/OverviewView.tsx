import {
  Chip,
  Dot,
  Panel,
  ProgressBar,
  Row,
  Sparkline,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/auth/AuthContext";
import { useSetting } from "@/features/shared/settings";

import { formatDay } from "../common/format";
import {
  exercisesOf,
  lastDays,
  localDay,
  rangeCalories,
  weekGoal,
  withExercises,
  workoutDays,
} from "../lib/statistics";
import { muscleRecovery } from "../lib/statisticsMuscles";
import { ageFromDob } from "../lib/workout";
import { FrequencyBars, VolumeBars } from "./WeekCharts";
import { MuscleRecovery } from "./MuscleRecovery";
import { type StatCard, StatCards } from "./StatCards";
import type { ViewProps } from "./viewProps";

const RECOVERY_DAYS = 7;
const HEATMAP_DAYS = 91;

export function OverviewView({
  data,
  exercises,

  rangeLabel,
  start,
  end,
  deltas,
}: ViewProps) {
  const { t, i18n } = useTranslation("training");
  const { sessions } = useAuth();
  const [goalSetting] = useSetting("lt", "weeklyWorkoutGoal");
  const [hasCalories] = useSetting("lt", "caloriesBurnedEnabled");
  const [heightCm] = useSetting("lt", "heightCm");
  const [weightKg] = useSetting("lt", "currentWeightKg");
  const [dob] = useSetting("lt", "dob");
  const [gender] = useSetting("lt", "gender");
  const user = sessions?.lt.state === "signed-in" ? sessions.lt.user : null;

  const workouts = data.workouts ? withExercises(data.workouts) : null;
  const trained = workouts ? workoutDays(workouts) : new Set<string>();
  const goal = workouts ? weekGoal(workouts, goalSetting) : null;
  const total = data.frequency?.reduce((sum, w) => sum + w.count, 0);
  const calories =
    hasCalories && workouts
      ? rangeCalories(
          workouts,
          {
            weight_kg: weightKg as number | null,
            height_cm: heightCm as number | null,
            age: ageFromDob(
              (user?.birthday as string | undefined) || (dob as string | null),
            ),
            sex:
              (user?.gender as string | undefined) || (gender as string | null),
          },
          start,
          end,
        )
      : null;
  const today = localDay();

  const cards: StatCard[] = [];
  if (data.streaks) {
    cards.push(
      {
        label: t("statistics.overview.currentStreak"),
        value: t("statistics.days", { count: data.streaks.currentStreak }),
      },
      {
        label: t("statistics.overview.longestStreak"),
        value: t("statistics.days", { count: data.streaks.longestStreak }),
      },
    );
  }
  if (total !== undefined) {
    cards.push({
      label: t("statistics.overview.inRange", { range: rangeLabel }),
      value: String(total),
      // Without a window to compare with: the last eight weeks as a line.
      hint: deltas ? (
        t("statistics.overview.vsPrior", {
          percent: signed(deltas.countPercent),
        })
      ) : (data.frequency?.length ?? 0) >= 2 ? (
        <Sparkline
          ariaLabel={t("statistics.overview.recentWeeks")}
          points={(data.frequency ?? [])
            .slice(-8)
            .map((week, x) => ({ x, value: week.count }))}
          max={Math.max(1, ...(data.frequency ?? []).map((w) => w.count))}
        />
      ) : undefined,
    });
    const weeks = data.frequency?.length ?? 0;
    cards.push({
      label: t("statistics.perWeek"),
      value: weeks
        ? new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: 1,
          }).format(total / weeks)
        : "0",
    });
  }

  return (
    <Stack gap={3}>
      {goal && (
        <Panel>
          <Stack gap={2}>
            <Row justify="between" gap={2} className="flex-wrap">
              <Text variant="heading">
                {t("statistics.overview.weekProgress", {
                  count: goal.count,
                  goal: goal.goal,
                })}
              </Text>
              {goal.fraction >= 1 ? (
                <Chip tone="accent" text={t("statistics.overview.goalHit")} />
              ) : (
                <Text tone="muted">
                  {t("statistics.overview.toGo", {
                    count: goal.goal - goal.count,
                  })}
                </Text>
              )}
            </Row>
            {/* TODO(monolithium): a progress ring */}
            <ProgressBar
              className="h-2 rounded-full"
              value={goal.fraction}
              label={t("statistics.overview.weekGoal")}
            />
          </Stack>
        </Panel>
      )}
      <StatCards cards={cards} />
      {workouts && (
        <Row gap={1} align="center" className="flex-wrap">
          <Text variant="caption" tone="muted">
            {t("statistics.overview.lastTwoWeeks")}
          </Text>
          {lastDays(14).map((day) => (
            <Dot
              key={day}
              tone={trained.has(day) ? "accent" : "muted"}
              title={formatDay(day, i18n.language)}
            />
          ))}
        </Row>
      )}
      {calories !== null && (
        <Panel density="compact">
          <Row gap={2} align="center">
            <Flame aria-hidden size={18} className="text-accent" />
            <Text>
              {t("statistics.overview.calories", {
                kcal: new Intl.NumberFormat(i18n.language).format(calories),
                range: rangeLabel,
              })}
            </Text>
            <Chip tone="muted" text={t("statistics.overview.estimate")} />
          </Row>
        </Panel>
      )}
      {workouts && (
        <Panel title={t("statistics.overview.activity")}>
          {/* TODO(monolithium): a calendar heatmap */}
          <div
            className="grid w-fit grid-flow-col grid-rows-7 gap-1"
            role="img"
            aria-label={t("statistics.overview.activityLabel", {
              count: lastDays(HEATMAP_DAYS).filter((day) => trained.has(day))
                .length,
            })}
          >
            {lastDays(HEATMAP_DAYS).map((day) => (
              <Dot
                key={day}
                size={12}
                tone={trained.has(day) ? "accent" : "muted"}
                isOutlined={day === today}
                title={`${formatDay(day, i18n.language)}${trained.has(day) ? " ✓" : ""}`}
              />
            ))}
          </div>
          <Row gap={3} align="center" className="mt-2 flex-wrap">
            <Row gap={1} align="center">
              <Dot tone="muted" />
              <Text variant="caption">{t("statistics.overview.rest")}</Text>
            </Row>
            <Row gap={1} align="center">
              <Dot tone="accent" />
              <Text variant="caption">{t("statistics.overview.workout")}</Text>
            </Row>
            {data.streaks && (
              <Text variant="caption" tone="muted">
                {t("statistics.overview.totalWorkouts", {
                  count: data.streaks.totalWorkouts,
                })}
              </Text>
            )}
          </Row>
        </Panel>
      )}
      {workouts && (
        <MuscleRecovery
          windowDays={RECOVERY_DAYS}
          recovery={muscleRecovery(
            workouts.map((w) => ({ date: w.date, exercises: exercisesOf(w) })),
            exercises,
            RECOVERY_DAYS,
          )}
        />
      )}
      <VolumeBars weeks={data.volume ?? []} isDetailed />
      <FrequencyBars weeks={data.frequency ?? []} isDetailed />
      {total === 0 && (
        <Text tone="muted">{t("statistics.overview.empty")}</Text>
      )}
    </Stack>
  );
}

function signed(percent: number): string {
  return `${percent > 0 ? "+" : ""}${percent}`;
}
