import {
  Button,
  Row,
  Stack,
  Text,
  Tile,
} from "@monocircuit/monolithium/components";
import { CalendarDays, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { WorkoutLog } from "../lib/workoutTypes";
import type { Prescription, Program } from "./api";

export interface EmptyDayProps {
  isFuture: boolean;
  activeProgram: Program | null;
  /** An accepted suggestion of the coach */
  coachPick: Prescription | null;
  lastWorkout: WorkoutLog | null;
  onLoadWorkout: () => void;
  onAddExercise: () => void;
  onStartSuggestion: (prescription: Prescription) => void;
  onQuickLoad: (workout: WorkoutLog) => void;
}

function QuickStart({
  tag,
  title,
  meta,
  onPress,
}: {
  tag: string;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Tile onPress={onPress} label={`${tag}: ${title}`} className="w-full">
      <Stack gap={0}>
        <Text variant="label" tone="accent">
          {tag}
        </Text>
        <Text variant="heading">{title}</Text>
        <Text variant="caption" tone="muted">
          {meta}
        </Text>
      </Stack>
    </Tile>
  );
}

/** A day without exercises: quick starts, load or add */
export function EmptyDay({
  isFuture,
  activeProgram,
  coachPick,
  lastWorkout,
  onLoadWorkout,
  onAddExercise,
  onStartSuggestion,
  onQuickLoad,
}: EmptyDayProps) {
  const { t } = useTranslation("training");
  return (
    <Stack gap={4} padding={4} align="center">
      <Stack gap={1} align="center">
        <Text variant="heading" as="h2">
          {isFuture ? t("diary.empty.titleFuture") : t("diary.empty.title")}
        </Text>
        <Text tone="muted" align="center">
          {isFuture ? t("diary.empty.textFuture") : t("diary.empty.text")}
        </Text>
      </Stack>
      <div className="grid w-full max-w-lg gap-2">
        {activeProgram && (
          <QuickStart
            tag={t("diary.empty.activeProgram")}
            title={activeProgram.name}
            meta={t("diary.empty.pickWorkout")}
            onPress={onLoadWorkout}
          />
        )}
        {coachPick && (
          <QuickStart
            tag={t("diary.empty.coachPick")}
            title={
              coachPick.template_name ||
              coachPick.name ||
              t("diary.prescription.coachPick")
            }
            meta={t("diary.prescription.from", {
              name: coachPick.trainer_name || t("diary.prescription.yourCoach"),
            })}
            onPress={() => {
              onStartSuggestion(coachPick);
            }}
          />
        )}
        {lastWorkout && (
          <QuickStart
            tag={t("diary.empty.lastWorkout")}
            title={lastWorkout.name || t("diary.untitled")}
            meta={t("diary.empty.exerciseCount", {
              count: lastWorkout.exercises.length,
            })}
            onPress={() => {
              onQuickLoad(lastWorkout);
            }}
          />
        )}
      </div>
      <Row gap={2} shouldWrap justify="center">
        <Button
          variant="primary"
          text={t("diary.toolbar.load")}
          onClick={onLoadWorkout}
        >
          <CalendarDays aria-hidden size={16} />
        </Button>
        <Button
          variant="secondary"
          text={t("diary.add.exercise")}
          onClick={onAddExercise}
        >
          <Plus aria-hidden size={16} />
        </Button>
      </Row>
    </Stack>
  );
}
