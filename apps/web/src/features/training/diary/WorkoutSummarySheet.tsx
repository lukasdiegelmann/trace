import {
  Button,
  Chip,
  Input,
  Row,
  Sheet,
  Stack,
  Stat,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Download, Link2, Pencil, Share2, Trophy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getExercises } from "../exercises/api";
import { parseLocalDate } from "../lib/dates";
import { shareWorkoutCard } from "../lib/shareCard";
import {
  estimateWorkoutCalories,
  fmtSetLabel,
  type CalorieProfile,
} from "../lib/workout";
import { exportWorkoutCsv } from "../lib/workoutCsv";
import {
  effectiveDuration,
  fmtSummaryDuration,
  fmtVolume,
  groupCompletedExercises,
  summaryStats,
} from "../lib/workoutSummary";
import type {
  LoadType,
  WorkoutExercise,
  WorkoutLog,
} from "../lib/workoutTypes";
import { useLtSettings } from "./ltSettings";

const PRESETS = [30, 45, 60, 75, 90, 120];

export interface WorkoutSummarySheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workout: WorkoutLog | null;
  prCount: number;
  streak: number;
  /** The running timer of the workout's date in minutes, null without */
  timerMinutes: number | null;
  onDurationChange: (minutes: number) => void;
  profile: CalorieProfile;
}

function DurationEditor({
  current,
  onPick,
  onCancel,
}: {
  current: number;
  onPick: (minutes: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("training");
  const [custom, setCustom] = useState(
    current > 0 ? String(Math.round(current)) : "",
  );
  const pick = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return;
    onPick(minutes);
  };
  const value = Number(custom.replace(",", "."));
  return (
    <Stack gap={2} padding={3} radius="lg" surface="surface">
      <Text variant="label">{t("summary.editDuration")}</Text>
      <Row gap={1} shouldWrap>
        {PRESETS.map((minutes) => (
          <Button
            key={minutes}
            size="sm"
            variant={Math.round(current) === minutes ? "primary" : "secondary"}
            text={t("summary.presetMinutes", { count: minutes })}
            onClick={() => {
              pick(minutes);
            }}
          />
        ))}
      </Row>
      <Row gap={2} align="end">
        <Input
          label={t("summary.custom")}
          inputMode="numeric"
          value={custom}
          onValueChange={setCustom}
          onEnter={() => {
            pick(value);
          }}
        />
        <Text variant="small" tone="muted">
          {t("summary.minutes")}
        </Text>
        <Button
          variant="primary"
          text={t("summary.set")}
          isDisabled={!(value > 0)}
          onClick={() => {
            pick(value);
          }}
        />
        <Button text={t("summary.cancel")} onClick={onCancel} />
      </Row>
    </Stack>
  );
}

function ExerciseSummary({ exercise }: { exercise: WorkoutExercise }) {
  return (
    <Stack gap={0}>
      <Text>{exercise.exercise_name ?? ""}</Text>
      <Text variant="mono" tone="muted">
        {(exercise.sets ?? [])
          .filter((set) => set.completed)
          .map((set) => fmtSetLabel(exercise, set))
          .join(" · ")}
      </Text>
    </Stack>
  );
}

/** The end of a session: numbers, calories, exercises, export and share */
export function WorkoutSummarySheet({
  isOpen,
  onOpenChange,
  workout,
  prCount,
  streak,
  timerMinutes,
  onDurationChange,
  profile,
}: WorkoutSummarySheetProps) {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const { weightUnit, caloriesBurnedEnabled: hasCalories } = useLtSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const duration = effectiveDuration(workout?.duration_min, timerMinutes);
  const stats = summaryStats(workout);
  const calories =
    workout && hasCalories
      ? estimateWorkoutCalories(
          { exercises: workout.exercises, duration_min: duration },
          profile,
        )
      : null;

  const exportCsv = async () => {
    if (!workout) return;
    setIsExporting(true);
    try {
      let libraryLoadTypes: Map<number, LoadType> | null = null;
      try {
        libraryLoadTypes = new Map(
          (await getExercises()).flatMap((row) =>
            row.load_type ? [[row.id, row.load_type as LoadType] as const] : [],
          ),
        );
      } catch {
        // Without the library only per-workout load types count
      }
      exportWorkoutCsv(workout, weightUnit, libraryLoadTypes);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("summary.exportFailed"),
      );
    }
    setIsExporting(false);
  };

  const share = async () => {
    if (!workout) return;
    setIsSharing(true);
    try {
      await shareWorkoutCard(
        { ...workout, duration_min: duration },
        {
          complete: t("summary.title"),
          workout: t("diary.workoutFallback"),
          volume: t("summary.volume", { unit: weightUnit }),
          sets: t("summary.sets"),
          exercises: t("summary.exercises"),
          duration: t("summary.duration"),
          superset: t("summary.superset"),
          topSet: (count, top) => t("summary.topSet", { count, top }),
          more: (count) => t("summary.more", { count }),
          date: workout.date
            ? parseLocalDate(workout.date).toLocaleDateString(i18n.language, {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "",
        },
        {
          title: t("summary.shareTitle"),
          text: t("summary.shareText"),
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("summary.shareFailed"),
      );
    }
    setIsSharing(false);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(isStillOpen) => {
        if (!isStillOpen) setIsEditing(false);
        onOpenChange(isStillOpen);
      }}
      title={t("summary.title")}
      description={workout?.name ?? undefined}
      footer={
        <Row gap={2} justify="between" align="center">
          <Row gap={2}>
            <Button
              variant="secondary"
              aria-label={t("summary.exportCsv")}
              isLoading={isExporting}
              onClick={() => void exportCsv()}
            >
              <Download aria-hidden size={16} />
            </Button>
            <Button
              variant="secondary"
              text={isSharing ? t("summary.preparing") : t("summary.share")}
              isDisabled={isSharing}
              onClick={() => void share()}
            >
              <Share2 aria-hidden size={16} />
            </Button>
          </Row>
          <Button
            variant="primary"
            text={t("summary.done")}
            onClick={() => {
              setIsEditing(false);
              onOpenChange(false);
            }}
          />
        </Row>
      }
    >
      <Stack gap={4}>
        <Row gap={2} justify="center" align="center" shouldWrap>
          <Trophy aria-hidden size={40} className="text-accent" />
          {prCount > 0 && (
            <Chip
              tone="accent"
              text={t("summary.newPrs", { count: prCount })}
            />
          )}
          {streak >= 2 && (
            <Chip text={`🔥 ${t("summary.streak", { count: streak })}`} />
          )}
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={t("summary.volume", { unit: weightUnit })}
            value={fmtVolume(stats.volume, i18n.language)}
          />
          <Stat label={t("summary.sets")} value={String(stats.sets)} />
          <Stat
            label={t("summary.exercises")}
            value={String(stats.exercises)}
          />
          <Row gap={1} align="end">
            <Stat
              label={t("summary.duration")}
              value={
                duration
                  ? fmtSummaryDuration(duration)
                  : t("summary.addDuration")
              }
            />
            <Button
              size="sm"
              aria-label={t("summary.editDuration")}
              onClick={() => {
                setIsEditing(true);
              }}
            >
              <Pencil aria-hidden size={14} />
            </Button>
          </Row>
        </div>
        {isEditing && (
          <DurationEditor
            current={duration}
            onPick={(minutes) => {
              setIsEditing(false);
              onDurationChange(minutes);
            }}
            onCancel={() => {
              setIsEditing(false);
            }}
          />
        )}
        {calories !== null && (
          <Stack gap={1}>
            <Row gap={2} align="center">
              <Text variant="heading">
                {t("summary.calories", { kcal: calories })}
              </Text>
              <Chip
                text={duration > 0 ? t("summary.est") : t("summary.rough")}
                tone="muted"
              />
            </Row>
            <Text variant="caption" tone="muted">
              {duration > 0 ? t("summary.estHint") : t("summary.roughHint")}
            </Text>
          </Stack>
        )}
        <Stack gap={3}>
          {groupCompletedExercises(workout?.exercises).map((group, i) =>
            group.kind === "single" ? (
              <ExerciseSummary key={i} exercise={group.exercise} />
            ) : (
              <Stack
                key={i}
                gap={2}
                className="border-s-2 border-accent/40 ps-3"
              >
                <Row gap={1} align="center">
                  <Link2 aria-hidden size={12} />
                  <Text variant="label">{t("summary.superset")}</Text>
                </Row>
                {group.members.map((member, j) => (
                  <ExerciseSummary key={j} exercise={member} />
                ))}
              </Stack>
            ),
          )}
        </Stack>
      </Stack>
    </Sheet>
  );
}
