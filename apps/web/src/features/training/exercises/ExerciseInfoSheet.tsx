import { Button, Sheet, Stack } from "@monocircuit/monolithium/components";
import { ArrowLeftRight, Plus, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyNote } from "../common/EmptyNote";
import { Loading } from "../common/LoadState";
import { useResource } from "../common/useResource";
import { exerciseRecord } from "../lib/exercisePr";
import type { HistoryEntry } from "../lib/workout";
import {
  type Exercise,
  getExercise,
  getExerciseHistory,
  getExercises,
} from "./api";
import { ExerciseInfo } from "./ExerciseInfo";

export interface ExerciseInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** One of the three: the exercise, its id, or its name */
  exercise?: Exercise | null;
  exerciseId?: number | null;
  exerciseName?: string | null;
  /** Offers "Add this exercise" */
  onAdd?: (exercise: Exercise) => void;
  /** Offers to link a name that isn't in the library */
  onReplace?: () => void;
}

interface Loaded {
  exercise: Exercise | null;
  history: HistoryEntry[];
}

async function loadExercise(
  props: Pick<
    ExerciseInfoSheetProps,
    "exercise" | "exerciseId" | "exerciseName"
  >,
): Promise<Loaded> {
  let exercise = props.exercise ?? null;
  if (!exercise && props.exerciseId) {
    exercise = await getExercise(props.exerciseId);
  } else if (!exercise && props.exerciseName) {
    const found = await getExercises({
      search: props.exerciseName,
      limit: 20,
    });
    const wanted = props.exerciseName.toLowerCase().trim();
    exercise =
      found.find((e) => e.name.toLowerCase().trim() === wanted) ??
      found.at(0) ??
      null;
  }
  const history = exercise
    ? await getExerciseHistory(exercise.id).catch(() => [])
    : [];
  return { exercise, history };
}

/** An exercise's details over the screen that asked (diary, editor, picker) */
export function ExerciseInfoSheet(props: ExerciseInfoSheetProps) {
  const { t } = useTranslation("training");
  const { isOpen, onClose } = props;
  return (
    <Sheet
      isOpen={isOpen}
      title={
        props.exercise?.name ?? props.exerciseName ?? t("exerciseInfo.title")
      }
      onOpenChange={(isUp) => {
        if (!isUp) onClose();
      }}
    >
      {isOpen && <SheetBody {...props} />}
    </Sheet>
  );
}

function SheetBody(props: ExerciseInfoSheetProps) {
  const { t } = useTranslation("training");
  const { onAdd, onReplace, onClose, exerciseName } = props;
  const key = `${props.exercise?.id ?? ""}|${props.exerciseId ?? ""}|${exerciseName ?? ""}`;
  const { data, error, isLoading } = useResource(key, () =>
    loadExercise(props),
  );

  if (isLoading && !data) return <Loading />;
  const exercise = data?.exercise;
  if (!exercise) {
    if (!error && exerciseName) {
      return (
        <Stack gap={2}>
          <EmptyNote
            icon={<Unlink aria-hidden />}
            text={t("exerciseInfo.notLinked", { name: exerciseName })}
            action={
              onReplace && {
                text: t("exerciseInfo.replace"),
                icon: <ArrowLeftRight aria-hidden size={16} />,
                onClick: () => {
                  onReplace();
                  onClose();
                },
              }
            }
          />
        </Stack>
      );
    }
    return <EmptyNote text={t("exerciseInfo.loadFailed")} />;
  }

  return (
    <Stack gap={4}>
      <ExerciseInfo
        exercise={exercise}
        record={exerciseRecord(data.history)}
        history={data.history}
      />
      {onAdd && (
        <Button
          variant="primary"
          isFullWidth
          text={t("exerciseInfo.add")}
          onClick={() => {
            onAdd(exercise);
            onClose();
          }}
        >
          <Plus aria-hidden size={16} />
        </Button>
      )}
    </Stack>
  );
}
