import {
  Button,
  Checkbox,
  Pressable,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  isInSuperset,
  type SupersetId,
  type SupersetSummary,
} from "../lib/supersets";
import type { WorkoutExercise } from "../lib/workoutTypes";

/** Which existing superset the exercise joins */
export function JoinSupersetSheet({
  isOpen,
  onClose,
  supersets,
  onJoin,
}: {
  isOpen: boolean;
  onClose: () => void;
  supersets: SupersetSummary[];
  onJoin: (id: SupersetId) => void;
}) {
  const { t } = useTranslation("training");
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(isStillOpen) => {
        if (!isStillOpen) onClose();
      }}
      title={t("diary.superset.joinTitle")}
      description={t("diary.superset.joinHint")}
    >
      <Stack gap={2}>
        {supersets.map((superset) => (
          <Pressable
            key={superset.id}
            onPress={() => {
              onJoin(superset.id);
              onClose();
            }}
            align="start"
            padding={3}
            surface="surface"
          >
            <Text variant="caption" tone="muted" as="span">
              {t("diary.superset.exercises", {
                count: superset.names.length,
              })}
            </Text>
            <Text as="span">{superset.names.join(" · ")}</Text>
          </Pressable>
        ))}
      </Stack>
    </Sheet>
  );
}

/** Which exercises make a new superset with the one at `idx` */
export function NewSupersetSheet({
  idx,
  exercises,
  onClose,
  onCreate,
}: {
  /** null: closed */
  idx: number | null;
  exercises: WorkoutExercise[];
  onClose: () => void;
  onCreate: (indices: number[]) => void;
}) {
  const { t } = useTranslation("training");
  const [picked, setPicked] = useState<number[]>([]);
  const close = () => {
    setPicked([]);
    onClose();
  };
  return (
    <Sheet
      isOpen={idx !== null}
      onOpenChange={(isStillOpen) => {
        if (!isStillOpen) close();
      }}
      title={t("diary.superset.newTitle")}
      description={t("diary.superset.newHint", {
        name: idx === null ? "" : (exercises[idx]?.exercise_name ?? ""),
      })}
      footer={
        <Button
          variant="primary"
          isFullWidth
          text={t("diary.superset.create", { count: picked.length + 1 })}
          isDisabled={picked.length === 0}
          onClick={() => {
            if (idx !== null) onCreate([idx, ...picked]);
            close();
          }}
        />
      }
    >
      <Stack gap={2}>
        {exercises.map((exercise, i) =>
          i === idx || isInSuperset(exercise) ? null : (
            <Checkbox
              key={exercise.uuid ?? i}
              label={exercise.exercise_name ?? ""}
              checked={picked.includes(i)}
              onChange={(isChecked) => {
                setPicked((list) =>
                  isChecked ? [...list, i] : list.filter((n) => n !== i),
                );
              }}
            />
          ),
        )}
      </Stack>
    </Sheet>
  );
}
