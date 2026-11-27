/**
 * One of a client's workouts, read-only, with the coach's notes on it: one on
 * the workout and one per exercise (the rows the client sees in the Diary).
 */
import {
  Button,
  Grid,
  Input,
  Pressable,
  Row,
  Sheet,
  Spinner,
  Stack,
  Stat,
  Text,
  Tile,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  Check,
  CirclePlay,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  StickyNote,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  clipsByExercise,
  clipSetNumber,
  exerciseNoteDrafts,
  feedbackForExercise,
  formatWeekday,
  workoutLevelFeedback,
} from "@/features/training/lib/coaching";
import {
  calcVolume,
  fmtSetDuration,
  isTimedSet,
  type WorkoutSet,
} from "@/features/training/lib/workout";

import { EmptyNote } from "../common/EmptyNote";
import {
  coachingApi,
  type FeedbackInput,
  type LoggedExercise,
  type MemberWorkout,
  type SetClip,
} from "./api";
import { coachingErrorText } from "./errorText";
import { FeedbackThread } from "./FeedbackThread";
import { SetVideoPlayerSheet } from "./SetVideoPlayerSheet";
import { useLtUserId } from "./useCoachingState";
import { useConfirm } from "./useConfirm";
import { useResource } from "./useResource";

export const SAVED_FLASH_MS = 900;

export interface WorkoutDetailSheetProps {
  memberId: number;
  memberName: string;
  memberAvatar: string | null;
  weightUnit: string;
  date: string;
  onClose: () => void;
  /** A note was saved or removed */
  onNotesChanged: () => void;
}

export function WorkoutDetailSheet(props: WorkoutDetailSheetProps) {
  const { t } = useTranslation("training");
  const { memberId, date, onClose } = props;
  const workout = useResource(`workout:${memberId}:${date}`, () =>
    coachingApi.workout(memberId, date),
  );

  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={workout.data?.name || t("coaching.workout.title")}
    >
      {workout.isLoading ? (
        <Spinner label={t("coaching.workout.loading")} />
      ) : !workout.data ? (
        <EmptyNote
          text={t("coaching.workout.loadFailed")}
          action={{
            text: t("common.retry"),
            onClick: () => {
              void workout.reload();
            },
          }}
        />
      ) : (
        <WorkoutDetail
          {...props}
          workout={workout.data}
          onReload={workout.reload}
        />
      )}
    </Sheet>
  );
}

function WorkoutDetail({
  workout,
  onReload,
  memberName,
  memberAvatar,
  weightUnit,
  onNotesChanged,
}: WorkoutDetailSheetProps & {
  workout: MemberWorkout;
  onReload: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation("training");
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const myId = useLtUserId();
  const exercises = workout.exercises ?? [];
  const feedback = workout.feedback ?? [];

  const clips = useResource(`clips:${workout.id}`, () =>
    coachingApi.clips(workout.id),
  );
  const byExercise = clipsByExercise(clips.data?.media);

  const workoutNotes = workoutLevelFeedback(feedback);
  const myWorkoutNote = workoutNotes.find((f) => f.trainer_id === myId);

  // The drafts start from my notes and are the coach's from then on.
  const [workoutDraft, setWorkoutDraft] = useState(myWorkoutNote?.note ?? "");
  const [isWorkoutEditorOpen, setIsWorkoutEditorOpen] =
    useState(!!myWorkoutNote);
  const [drafts, setDrafts] = useState(() =>
    myId === null ? {} : exerciseNoteDrafts(exercises, feedback, myId),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState<"workout" | number | null>(null);
  const [hasJustSaved, setHasJustSaved] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(flashTimer.current);
    },
    [],
  );
  const [open, setOpen] = useState<{ clip: SetClip; index: number } | null>(
    null,
  );

  const refetch = async () => {
    await onReload();
    await clips.reload();
    onNotesChanged();
  };

  const save = async (
    key: "workout" | number,
    input: FeedbackInput,
  ): Promise<boolean> => {
    setSaving(key);
    try {
      await coachingApi.saveFeedback(input);
      const isKept = !!input.note.trim();
      toast.info(
        key === "workout"
          ? isKept
            ? t("coaching.workout.feedbackSaved")
            : t("coaching.workout.feedbackRemoved")
          : isKept
            ? t("coaching.workout.noteSaved")
            : t("coaching.workout.noteRemoved"),
      );
      await refetch();
      return true;
    } catch (error) {
      toast.error(coachingErrorText(error, t));
      return false;
    } finally {
      setSaving(null);
    }
  };

  const saveWorkoutNote = async (note: string) => {
    const isSaved = await save("workout", {
      workout_id: workout.id,
      exercise_idx: null,
      note,
    });
    if (!isSaved || !note.trim()) return;
    setHasJustSaved(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setHasJustSaved(false);
    }, SAVED_FLASH_MS);
  };

  const saveExerciseNote = async (index: number, note: string) => {
    const isSaved = await save(index, {
      workout_id: workout.id,
      exercise_idx: index,
      exercise_uuid: exercises[index]?.uuid || null,
      note,
    });
    if (isSaved) setEditing(null);
  };

  const confirmDelete = (message: string) =>
    confirm({
      title: t("coaching.workout.deleteNoteTitle"),
      message,
      confirmText: t("common.delete"),
      isDangerous: true,
    });

  const deleteWorkoutNote = async () => {
    if (!(await confirmDelete(t("coaching.workout.deleteWorkoutNote")))) return;
    setWorkoutDraft("");
    await saveWorkoutNote("");
  };

  const deleteExerciseNote = async (index: number) => {
    if (!(await confirmDelete(t("coaching.workout.deleteExerciseNote")))) {
      return;
    }
    setDrafts((current) => ({ ...current, [index]: "" }));
    await saveExerciseNote(index, "");
  };

  const number = (value: number) => value.toLocaleString(i18n.language);

  const setText = (exercise: LoggedExercise, set: WorkoutSet) => {
    const weight = Number(set.weight) || 0;
    if (isTimedSet(exercise, set)) {
      const time = fmtSetDuration(set.duration_sec) || "0:00";
      return weight ? `${number(weight)} ${weightUnit} × ${time}` : time;
    }
    return `${number(weight)} ${weightUnit} × ${number(Number(set.reps) || 0)}`;
  };

  return (
    <Stack gap={4}>
      <Grid columns={3} gap={2}>
        <Stat
          label={t("coaching.workout.date")}
          value={formatWeekday(workout.date, i18n.language)}
        />
        <Stat
          label={t("coaching.workout.duration")}
          value={
            workout.duration_min
              ? t("coaching.minutesShort", {
                  n: Math.round(workout.duration_min),
                })
              : "—"
          }
        />
        <Stat
          label={t("coaching.workout.volume", { unit: weightUnit })}
          value={number(Math.round(calcVolume(exercises)))}
        />
      </Grid>

      {workout.notes ? (
        <Row gap={2} align="start">
          <StickyNote aria-hidden size={16} className="shrink-0 text-muted" />
          <Text variant="small" shouldKeepLineBreaks>
            {workout.notes}
          </Text>
        </Row>
      ) : null}

      <Stack gap={2}>
        {!isWorkoutEditorOpen ? (
          <Button
            variant="secondary"
            size="md"
            isFullWidth
            text={t("coaching.workout.addWorkoutNote")}
            onClick={() => {
              setIsWorkoutEditorOpen(true);
            }}
          >
            <MessageSquarePlus aria-hidden size={16} />
          </Button>
        ) : (
          <>
            <Input
              multiline
              rows={2}
              autoFocus
              label={t("coaching.workout.noteFor", { name: memberName })}
              placeholder={t("coaching.workout.notePlaceholder")}
              value={workoutDraft}
              onChange={(event) => {
                setWorkoutDraft(event.target.value);
              }}
            />
            <Row gap={2} justify="end" shouldWrap>
              {myWorkoutNote ? (
                <Button
                  variant="danger"
                  size="sm"
                  text={t("common.delete")}
                  isDisabled={saving === "workout"}
                  onClick={() => {
                    void deleteWorkoutNote();
                  }}
                />
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                text={t("common.cancel")}
                onClick={() => {
                  setIsWorkoutEditorOpen(!!workoutDraft.trim());
                }}
              />
              <Button
                variant="primary"
                size="sm"
                text={
                  hasJustSaved
                    ? t("common.saved")
                    : saving === "workout"
                      ? t("coaching.saving")
                      : t("coaching.workout.saveNote")
                }
                isDisabled={saving === "workout" || !workoutDraft.trim()}
                onClick={() => {
                  void saveWorkoutNote(workoutDraft);
                }}
              >
                {hasJustSaved ? <Check aria-hidden size={16} /> : undefined}
              </Button>
            </Row>
          </>
        )}
        <FeedbackThread
          feedback={workoutNotes}
          myId={myId}
          memberName={memberName}
          memberAvatar={memberAvatar}
        />
      </Stack>

      {exercises.map((exercise, index) => {
        const done = (exercise.sets ?? []).filter((set) => set.completed);
        if (done.length === 0) return null;
        const notes = feedbackForExercise(exercises, feedback, index);
        const mine = notes.find((f) => f.trainer_id === myId);
        const exerciseClips = exercise.uuid
          ? (byExercise.get(exercise.uuid) ?? [])
          : [];
        const name = exercise.exercise_name ?? "";
        const draft = drafts[index] ?? "";
        return (
          <Tile key={exercise.uuid || index}>
            <Stack as="section" gap={2} aria-label={name}>
              <Row gap={2} align="center" justify="between" shouldWrap>
                <Text variant="heading" as="h3">
                  {name}
                </Text>
                <Text variant="caption">
                  {t("coaching.setCount", { count: done.length })}
                </Text>
              </Row>
              {exerciseClips.length ? (
                <Row gap={2} shouldWrap>
                  {exerciseClips.map((clip) => {
                    const setNumber = clipSetNumber(exercise, clip);
                    const isNumbered = exerciseClips.length > 1 && !!setNumber;
                    return (
                      <Button
                        key={clip.id}
                        variant="secondary"
                        size="sm"
                        text={
                          isNumbered
                            ? t("coaching.video.watchSet", { n: setNumber })
                            : t("coaching.video.watch")
                        }
                        onClick={() => {
                          setOpen({ clip, index });
                        }}
                      >
                        <CirclePlay aria-hidden size={16} />
                      </Button>
                    );
                  })}
                </Row>
              ) : null}
              <ul className="flex flex-col gap-1">
                {done.map((set, position) => (
                  <li key={set.uuid ?? position}>
                    <Row gap={3} align="baseline">
                      <Text variant="caption" className="w-10 shrink-0">
                        {set.warmup
                          ? t("coaching.workout.warmupNumber", {
                              n: position + 1,
                            })
                          : String(position + 1)}
                      </Text>
                      <Text
                        variant="mono"
                        tone={set.warmup ? "muted" : "default"}
                      >
                        {setText(exercise, set)}
                      </Text>
                      {set.rpe != null ? (
                        <Text variant="caption">@ {set.rpe}</Text>
                      ) : null}
                    </Row>
                  </li>
                ))}
              </ul>
              {exercise.notes ? (
                <Text variant="small" tone="muted" shouldKeepLineBreaks>
                  {exercise.notes}
                </Text>
              ) : null}
              {editing === index ? (
                <>
                  <Input
                    multiline
                    rows={2}
                    autoFocus
                    aria-label={t("coaching.workout.noteOn", {
                      exercise: name,
                    })}
                    placeholder={t("coaching.workout.noteOn", {
                      exercise: name,
                    })}
                    value={draft}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => ({ ...current, [index]: value }));
                    }}
                  />
                  <Row gap={2} justify="end" shouldWrap>
                    {mine ? (
                      <Button
                        variant="danger"
                        size="sm"
                        text={t("common.delete")}
                        isDisabled={saving === index}
                        onClick={() => {
                          void deleteExerciseNote(index);
                        }}
                      />
                    ) : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      text={t("common.cancel")}
                      onClick={() => {
                        setEditing(null);
                      }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      text={
                        saving === index
                          ? t("coaching.saving")
                          : t("common.save")
                      }
                      isDisabled={saving === index || !draft.trim()}
                      onClick={() => {
                        void saveExerciseNote(index, draft);
                      }}
                    />
                  </Row>
                </>
              ) : mine ? (
                <Pressable
                  padding={2}
                  radius="md"
                  className="bg-level-2"
                  label={t("coaching.workout.editNote", { note: mine.note })}
                  onPress={() => {
                    setEditing(index);
                  }}
                >
                  <Row gap={2} align="start">
                    <MessageSquare
                      aria-hidden
                      size={14}
                      className="shrink-0 text-accent-text"
                    />
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                      {mine.note}
                    </span>
                    <Pencil aria-hidden size={14} className="shrink-0" />
                  </Row>
                </Pressable>
              ) : (
                <Button
                  size="sm"
                  text={t("coaching.workout.addExerciseNote")}
                  onClick={() => {
                    setEditing(index);
                  }}
                >
                  <MessageSquarePlus aria-hidden size={14} />
                </Button>
              )}
              <FeedbackThread
                feedback={notes}
                myId={myId}
                memberName={memberName}
                memberAvatar={memberAvatar}
              />
            </Stack>
          </Tile>
        );
      })}

      {open ? (
        <SetVideoPlayerSheet
          clip={open.clip}
          subtitle={exercises[open.index]?.exercise_name ?? ""}
          workoutId={workout.id}
          exerciseIdx={open.index}
          onClose={() => {
            setOpen(null);
          }}
          onNoted={(note) => {
            // The note is this exercise's note: the editor follows it.
            setDrafts((current) => ({ ...current, [open.index]: note }));
            void refetch();
          }}
        />
      ) : null}
      {dialog}
    </Stack>
  );
}
