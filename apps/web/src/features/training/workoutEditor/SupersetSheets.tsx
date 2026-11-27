/** Joining, starting and merging supersets */
import {
  ActionList,
  Button,
  Checkbox,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  existingSupersets,
  isInSuperset,
  type SupersetId,
} from "../lib/supersets";
import type { WorkoutExercise } from "../lib/workoutTypes";

export type SupersetSheetState =
  | { mode: "join"; idx: number }
  | { mode: "new"; idx: number }
  | { mode: "merge"; id: SupersetId };

export interface SupersetSheetsProps {
  state: SupersetSheetState | null;
  exercises: WorkoutExercise[];
  onClose: () => void;
  onJoin: (idx: number, id: SupersetId) => void;
  onCreate: (indices: number[]) => void;
  onMerge: (source: SupersetId, target: SupersetId) => void;
}

function NewSupersetForm({
  idx,
  exercises,
  onCreate,
}: {
  idx: number;
  exercises: WorkoutExercise[];
  onCreate: (indices: number[]) => void;
}) {
  const { t } = useTranslation("training");
  const [picks, setPicks] = useState<number[]>([]);
  const candidates = exercises
    .map((exercise, i) => ({ exercise, i }))
    .filter(({ exercise, i }) => i !== idx && !isInSuperset(exercise));

  return (
    <Stack gap={3}>
      <Text tone="muted">
        {t("workoutEditor.superset.createHint", {
          name: exercises[idx]?.exercise_name ?? "",
          interpolation: { escapeValue: false },
        })}
      </Text>
      {candidates.length === 0 ? (
        <Text>{t("workoutEditor.superset.createNone")}</Text>
      ) : (
        candidates.map(({ exercise, i }) => (
          <Checkbox
            key={i}
            label={exercise.exercise_name ?? ""}
            checked={picks.includes(i)}
            onChange={(isChecked) => {
              setPicks((current) =>
                isChecked
                  ? [...current, i]
                  : current.filter((pick) => pick !== i),
              );
            }}
          />
        ))
      )}
      <Button
        variant="primary"
        size="lg"
        isFullWidth
        isDisabled={picks.length === 0}
        text={t("workoutEditor.superset.createConfirm", {
          count: picks.length + 1,
        })}
        onClick={() => {
          onCreate([idx, ...picks]);
        }}
      />
    </Stack>
  );
}

export function SupersetSheets({
  state,
  exercises,
  onClose,
  onJoin,
  onCreate,
  onMerge,
}: SupersetSheetsProps) {
  const { t } = useTranslation("training");
  if (!state) return null;

  const title = t(
    state.mode === "join"
      ? "workoutEditor.superset.joinTitle"
      : state.mode === "new"
        ? "workoutEditor.superset.createTitle"
        : "workoutEditor.superset.mergeTitle",
  );
  const separator = t("workoutEditor.superset.memberSeparator");
  const targets = existingSupersets(exercises).filter(
    (superset) =>
      state.mode !== "merge" || String(superset.id) !== String(state.id),
  );

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={title}
    >
      {state.mode === "new" ? (
        <NewSupersetForm
          idx={state.idx}
          exercises={exercises}
          onCreate={onCreate}
        />
      ) : (
        <Stack gap={3}>
          <Text tone="muted">
            {t(
              state.mode === "join"
                ? "workoutEditor.superset.joinHint"
                : "workoutEditor.superset.mergeHint",
            )}
          </Text>
          <ActionList
            label={title}
            items={targets.map((superset) => ({
              id: String(superset.id),
              text: superset.names.join(separator),
              onSelect: () => {
                if (state.mode === "join") onJoin(state.idx, superset.id);
                else onMerge(state.id, superset.id);
              },
            }))}
          />
        </Stack>
      )}
    </Sheet>
  );
}
