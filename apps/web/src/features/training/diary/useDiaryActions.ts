/**
 * What the diary does with the shown day, ported from the actions of LiftTrace
 * `routes/Diary.svelte`. Every action reads the store's current workout, not
 * the one of the last render, and does nothing once another day is shown.
 */
import { useToast } from "@monocircuit/monolithium/components";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api";

import { claimDaily, claimRecord, notify } from "../lib/celebrations";
import { addDays } from "../lib/dates";
import {
  celebrationFor,
  didCompleteWorkingSet,
  isWorkoutDone,
  justCompletedSet,
  type PrCelebration,
} from "../lib/prs";
import { startRest, stopRest } from "../lib/restTimer";
import {
  createSuperset,
  joinSuperset,
  leaveSuperset,
  moveExercise,
  moveGroupTo,
  moveWithinSuperset,
  nextAfterRest,
  recalcSuperset,
  removeSuperset,
  shouldStartRest,
  type SupersetId,
} from "../lib/supersets";
import {
  copiedExercises,
  insertExercise,
  newDiaryExercise,
  quickLoadExercise,
  suggestedWorkoutName,
  templateExerciseToLog,
  withAutoWarmups,
  type SuggestedName,
} from "../lib/templateLoad";
import {
  estimateWorkoutCalories,
  fmtSetDuration,
  lastCompletedSession,
  type CalorieProfile,
} from "../lib/workout";
import { withFreshIds } from "../lib/workoutUuid";
import {
  pauseTimer,
  resetTimer,
  timerMinutes,
  workoutTimer,
} from "../lib/workoutTimer";
import type {
  WorkoutExercise,
  WorkoutLog,
  WorkoutSet,
} from "../lib/workoutTypes";
import {
  federationApi,
  notifyApi,
  prescriptionApi,
  programApi,
  workoutApi,
  type Prescription,
} from "./api";
import { useChoice, useConfirm } from "./useDialogs";
import type { Exercise } from "../exercises/api";
import { diaryStore } from "./diaryStore";
import { getLtSettings } from "./ltSettings";

export type PickerTarget =
  | { kind: "add" }
  | { kind: "replace"; idx: number }
  | { kind: "superset"; id: SupersetId };

export type LoadMode = "replace" | "new_session";

export interface TemplateSource {
  exercises: WorkoutExercise[];
  name: string;
  id: number | null;
}

export interface LoadContext {
  programId: number | null;
  planWeek: number | null;
  programWeeks: number | null;
  question: "template" | "suggested" | "prescribed";
  /** Set when the entry point already said what happens */
  forcedMode?: LoadMode;
}

export interface DiaryActionOptions {
  date: string;
  isFuture: boolean;
  profile: CalorieProfile;
  /** The day's trained dots and recents changed */
  onTrainedChanged: () => void;
  onShowSummary: () => void;
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function useDiaryActions({
  date,
  isFuture,
  profile,
  onTrainedChanged,
  onShowSummary,
}: DiaryActionOptions) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { choose, sheet: choiceSheet } = useChoice();
  /** Categories of exercises picked here, for the automatic name */
  const categories = useRef(new Map<number, string>());

  // TODO(monolithium): success tone for toasts
  const info = (text: string) => toast.show({ text, tone: "info" });
  const fail = (error: unknown) =>
    toast.error(t("diary.actionError", { error: errorText(error) }));

  const isShown = () => {
    const state = diaryStore.state.get();
    return state.date === date && !state.isLoading;
  };
  const current = (): WorkoutLog => {
    const state = diaryStore.state.get();
    return (state.date === date ? state.log : null) ?? { exercises: [] };
  };
  const exercisesNow = () => current().exercises;

  const save = async (change: Partial<WorkoutLog>) => {
    if (!isShown()) return;
    try {
      await diaryStore.save(date, { ...current(), ...change });
    } catch (error) {
      toast.error(t("diary.saveError", { error: errorText(error) }));
    }
  };
  const saveExercises = (exercises: WorkoutExercise[]) => save({ exercises });

  // ── Celebrations and calories ──────────────────────────────────────────

  const send = (title: string, body: string) => {
    const settings = getLtSettings();
    void notify(
      title,
      body,
      {
        hasLocal: settings.notifLocalEnabled,
        pushService: settings.notifPushService,
      },
      (pushTitle, pushBody) => notifyApi.send(pushTitle, pushBody, 5),
    );
  };

  const celebrateRecord = (name: string, record: PrCelebration) => {
    const settings = getLtSettings();
    if (!settings.notifPRCelebrations) return;
    const unit = settings.weightUnit;
    if (record.kind === "hold") {
      if (!claimRecord("prHold", name, record.durationSec)) return;
      const time = fmtSetDuration(record.durationSec);
      send(
        t("diary.notify.holdPrTitle"),
        record.weight > 0
          ? t("diary.notify.holdBodyWeighted", {
              name,
              time,
              weight: record.weight,
              unit,
            })
          : t("diary.notify.holdBody", { name, time }),
      );
      return;
    }
    if (!claimRecord("pr", name, record.weight)) return;
    send(
      record.kind === "e1rm"
        ? t("diary.notify.repPrTitle")
        : t("diary.notify.weightPrTitle"),
      record.reps
        ? t("diary.notify.prBody", {
            name,
            weight: record.weight,
            unit,
            reps: record.reps,
          })
        : t("diary.notify.prBodyPlain", { name, weight: record.weight, unit }),
    );
  };

  /** The session's calories to NutriTrace, replacing the day's earlier ones */
  const pushCalories = (duration: number) => {
    const settings = getLtSettings();
    if (!settings.ntFederationEnabled || !settings.caloriesBurnedEnabled)
      return;
    const log = current();
    const kcal = estimateWorkoutCalories(
      { exercises: log.exercises, duration_min: duration },
      profile,
    );
    if (kcal === null || kcal <= 0) return;
    federationApi
      .logWorkout({
        date,
        name: log.name ?? "",
        duration_min: duration,
        calories_burned: kcal,
        external_id: `lt:workout:${date}`,
      })
      .catch((error: unknown) => {
        toast.error(t("diary.toast.ntFailed", { error: errorText(error) }));
      });
  };

  /**
   * The end of a session: stop the clock, store the duration, mark it done,
   * celebrate, show the summary. A finished one only shows its summary.
   */
  const finish = async (isAutomatic: boolean) => {
    if (isFuture || !isShown()) return;
    const log = current();
    if (log.completed) {
      if (!isAutomatic) onShowSummary();
      return;
    }
    let duration = log.duration_min ?? 0;
    const timer = workoutTimer.get();
    const isTimed = timer?.date === date;
    if (isTimed) {
      pauseTimer();
      duration = timerMinutes();
    }
    const saved = save({ duration_min: duration, completed: 1 });
    // Only this day's clock: finishing an old day leaves today's running
    if (isTimed) resetTimer();
    stopRest(false);
    const settings = getLtSettings();
    if (settings.notifWorkoutComplete && claimDaily("workout-complete")) {
      send(
        t("diary.notify.completeTitle"),
        log.name
          ? t("diary.notify.completeBody", { name: log.name })
          : t("diary.notify.completeBodyPlain"),
      );
    }
    pushCalories(duration);
    if (!isAutomatic || settings.showCompletionSummary) onShowSummary();
    await saved;
    onTrainedChanged();
  };

  const changeDuration = async (minutes: number) => {
    const saved = save({ duration_min: minutes });
    pushCalories(minutes);
    await saved;
  };

  // ── Logging ────────────────────────────────────────────────────────────

  const updateExercise = async (idx: number, next: WorkoutExercise) => {
    if (!isShown()) return;
    const exercises = exercisesNow();
    const old = exercises.at(idx);
    if (!old) return;
    const didComplete = didCompleteWorkingSet(old, next);
    const settings = getLtSettings();
    if (
      didComplete &&
      settings.restTimerEnabled &&
      settings.restAutoStart &&
      shouldStartRest(exercises, idx, next)
    ) {
      const upNext = nextAfterRest(exercises, idx, next);
      startRest({
        exerciseId: upNext.exercise_id ?? null,
        exerciseName: upNext.exercise_name ?? "",
        // The plan's rest of the exercise wins over the default
        durationSec:
          Number(upNext.rest_sec) > 0
            ? Number(upNext.rest_sec)
            : settings.restDuration,
      });
    }
    const updated = exercises.map((e, i) => (i === idx ? next : e));
    const saved = saveExercises(updated);
    const set = didComplete ? justCompletedSet(old, next) : undefined;
    if (set && !isFuture && next.exercise_id != null) {
      void workoutApi
        .history(next.exercise_id)
        .then((history) => {
          const record = celebrationFor(next, set, history, date);
          if (record) celebrateRecord(next.exercise_name ?? "", record);
        })
        .catch(() => undefined);
    }
    await saved;
    if (didComplete && !isFuture && isWorkoutDone(updated)) await finish(true);
  };

  const removeExercise = async (idx: number) => {
    const exercise = exercisesNow().at(idx);
    if (!exercise) return;
    if (getLtSettings().confirmExerciseRemoval) {
      const isConfirmed = await confirm({
        title: t("diary.confirm.removeExerciseTitle"),
        text: t("diary.confirm.removeExerciseText", {
          name: exercise.exercise_name ?? "",
        }),
        confirmText: t("diary.confirm.remove"),
      });
      if (!isConfirmed) return;
    }
    await saveExercises(
      exercisesNow().filter((e, i) =>
        exercise.uuid ? e.uuid !== exercise.uuid : i !== idx,
      ),
    );
  };

  const dropSuperset = async (id: SupersetId) => {
    if (getLtSettings().confirmExerciseRemoval) {
      const isConfirmed = await confirm({
        title: t("diary.confirm.removeSupersetTitle"),
        text: t("diary.confirm.removeSupersetText", {
          names: exercisesNow()
            .filter((e) => String(e.superset_id) === String(id))
            .map((e) => e.exercise_name)
            .join(", "),
        }),
        confirmText: t("diary.confirm.remove"),
      });
      if (!isConfirmed) return;
    }
    const saved = saveExercises(removeSuperset(exercisesNow(), id));
    info(t("diary.toast.supersetRemoved"));
    await saved;
  };

  const move = (idx: number, direction: -1 | 1) =>
    saveExercises(moveExercise(exercisesNow(), idx, direction));
  const moveGroup = (from: number, to: number) =>
    saveExercises(moveGroupTo(exercisesNow(), from, to));
  const moveMember = (id: SupersetId, from: number, to: number) =>
    saveExercises(moveWithinSuperset(exercisesNow(), id, from, to));
  const makeSuperset = (indices: number[]) => {
    info(t("diary.toast.supersetCreated"));
    return saveExercises(createSuperset(exercisesNow(), indices));
  };
  const join = (idx: number, id: SupersetId) => {
    info(t("diary.toast.supersetJoined"));
    return saveExercises(joinSuperset(exercisesNow(), idx, id));
  };
  const leave = (idx: number) => {
    info(t("diary.toast.supersetLeft"));
    return saveExercises(leaveSuperset(exercisesNow(), idx));
  };

  // ── Adding exercises and workouts ──────────────────────────────────────

  /** The last completed session's sets before this day (auto-fill) */
  const lastSets = async (
    exerciseId: number | null | undefined,
    shouldIncludeWarmups: boolean,
  ): Promise<WorkoutSet[] | null> => {
    if (!getLtSettings().autoFillLastWeights || !exerciseId) return null;
    try {
      const last = lastCompletedSession(await workoutApi.history(exerciseId), {
        before: date,
      });
      if (!last) return null;
      return shouldIncludeWarmups ? last.completed : last.working;
    } catch {
      return null;
    }
  };

  const nameOf = (suggestion: SuggestedName) =>
    suggestion.kind === "category"
      ? t("diary.names.category", { category: suggestion.category })
      : t(`diary.names.${suggestion.kind}`);

  const autoName = (exercises: WorkoutExercise[]): Partial<WorkoutLog> => {
    if (!getLtSettings().autoNameWorkouts || current().name) return {};
    const suggestion = suggestedWorkoutName(
      exercises.map((e) => ({
        ...e,
        category:
          e.category ??
          (e.exercise_id != null
            ? categories.current.get(e.exercise_id)
            : undefined),
      })),
    );
    return suggestion ? { name: nameOf(suggestion) } : {};
  };

  const pickExercise = async (picked: Exercise, target: PickerTarget) => {
    if (!isShown()) return;
    if (target.kind === "replace") {
      const saved = saveExercises(
        exercisesNow().map((e, i) =>
          i === target.idx
            ? { ...e, exercise_id: picked.id, exercise_name: picked.name }
            : e,
        ),
      );
      info(t("diary.toast.replaced", { name: picked.name }));
      await saved;
      return;
    }
    if (picked.category) categories.current.set(picked.id, picked.category);
    const last = await lastSets(picked.id, true);
    if (!isShown()) return;
    const settings = getLtSettings();
    const added = newDiaryExercise(
      picked,
      last,
      settings.exerciseLoadTypes,
      settings.exerciseSetTypes,
    );
    const supersetId = target.kind === "superset" ? target.id : null;
    let exercises = insertExercise(exercisesNow(), added, supersetId);
    if (supersetId != null) exercises = recalcSuperset(exercises, supersetId);
    await save({ exercises, ...autoName(exercises) });
  };

  const loadTemplate = async (source: TemplateSource, context: LoadContext) => {
    if (!isShown()) return;
    let mode: LoadMode | null = context.forcedMode ?? null;
    if (!mode) {
      mode = exercisesNow().length
        ? ((await choose({
            title: t(`diary.replaceChoice.${context.question}`),
            actions: [
              {
                id: "replace",
                text: t("diary.replaceChoice.replace"),
                description: t("diary.replaceChoice.replaceHint"),
                isDanger: true,
              },
              {
                id: "new_session",
                text: t("diary.replaceChoice.newSession"),
                description: t("diary.replaceChoice.newSessionHint"),
              },
            ],
          })) as LoadMode | null)
        : "replace";
    }
    if (!mode) return;
    let exercises = await Promise.all(
      source.exercises.map(async (exercise) =>
        templateExerciseToLog(
          exercise,
          await lastSets(exercise.exercise_id, true),
          context.planWeek,
        ),
      ),
    );
    if (!isShown()) return;
    const settings = getLtSettings();
    if (settings.autoGenerateWarmups) {
      exercises = withAutoWarmups(exercises, settings.weightUnit);
    }
    const payload: WorkoutLog = {
      // A new session starts clean; a replaced one is open again
      ...(mode === "new_session" ? {} : current()),
      completed: false,
      name: source.name,
      template_id: source.id,
      program_id: context.programId,
      program_week: context.planWeek,
      program_duration_weeks: context.planWeek ? context.programWeeks : null,
      exercises: withFreshIds(exercises),
    };
    try {
      if (mode === "new_session") {
        await diaryStore.startNewSession(date, payload);
        info(t("diary.toast.loaded", { name: source.name }));
      } else {
        info(t("diary.toast.loaded", { name: source.name }));
        await save(payload);
      }
    } catch (error) {
      fail(error);
    }
  };

  const loadPrescription = async (prescription: Prescription) => {
    let exercises: WorkoutExercise[] | null = prescription.exercises ?? null;
    if (prescription.template_exercises) {
      try {
        exercises = JSON.parse(
          prescription.template_exercises,
        ) as WorkoutExercise[];
      } catch {
        exercises = [];
      }
    }
    if (!exercises) {
      toast.error(t("diary.toast.noExercises"));
      return;
    }
    await loadTemplate(
      {
        exercises,
        name:
          prescription.template_name ||
          prescription.name ||
          t("diary.prescription.prescribed"),
        id: prescription.template_id ?? null,
      },
      {
        programId: prescription.program_id ?? null,
        planWeek: null,
        programWeeks: null,
        question: "prescribed",
      },
    );
  };

  const startSuggestion = async (prescription: Prescription) => {
    let exercises = prescription.exercises ?? null;
    if (prescription.template_id) {
      try {
        exercises = (await programApi.template(prescription.template_id))
          .exercises;
      } catch {
        toast.error(t("diary.toast.templateFailed"));
        return;
      }
    }
    if (!exercises) {
      toast.error(t("diary.toast.noExercises"));
      return;
    }
    await loadTemplate(
      {
        exercises,
        name:
          prescription.template_name ||
          prescription.name ||
          t("diary.prescription.coachPick"),
        id: prescription.template_id ?? null,
      },
      {
        programId: prescription.program_id ?? null,
        planWeek: null,
        programWeeks: null,
        question: "suggested",
      },
    );
  };

  const quickLoad = async (recent: WorkoutLog) => {
    const exercises = await Promise.all(
      recent.exercises.map(async (exercise) =>
        quickLoadExercise(
          exercise,
          await lastSets(exercise.exercise_id, false),
        ),
      ),
    );
    info(
      t("diary.toast.loaded", {
        name: recent.name || t("diary.workoutFallback"),
      }),
    );
    await save({
      name: recent.name ?? "",
      template_id: recent.template_id ?? null,
      program_id: recent.program_id ?? null,
      exercises: withFreshIds(exercises),
    });
  };

  const copyYesterday = async () => {
    let yesterday: WorkoutLog | null;
    try {
      yesterday = (await workoutApi.get(addDays(date, -1))).workout;
    } catch (error) {
      fail(error);
      return;
    }
    if (!yesterday?.exercises.length) {
      toast.error(t("diary.toast.noYesterday"));
      return;
    }
    if (exercisesNow().length) {
      const isConfirmed = await confirm({
        title: t("diary.confirm.copyTitle"),
        text: t("diary.confirm.copyText"),
        confirmText: t("diary.confirm.copy"),
      });
      if (!isConfirmed) return;
    }
    const saved = save({
      name: yesterday.name ?? "",
      exercises: withFreshIds(copiedExercises(yesterday.exercises)),
    });
    info(t("diary.toast.copied"));
    await saved;
  };

  const clearWorkout = async () => {
    const isConfirmed = await confirm({
      title: t("diary.confirm.clearTitle"),
      text: t("diary.confirm.clearText"),
      confirmText: t("diary.confirm.clear"),
    });
    if (!isConfirmed) return;
    // `completed` goes too: an emptied day must not count as trained
    await save({
      name: "",
      template_id: null,
      program_id: null,
      exercises: [],
      notes: "",
      completed: false,
    });
    info(t("diary.toast.cleared"));
    onTrainedChanged();
  };

  const resetWorkoutTimer = async () => {
    const isConfirmed = await confirm({
      title: t("diary.confirm.resetTimerTitle"),
      text: t("diary.confirm.resetTimerText"),
      confirmText: t("diary.confirm.resetTimer"),
    });
    if (!isConfirmed) return;
    if (workoutTimer.get()?.date === date) resetTimer();
    await save({ duration_min: 0 });
    info(t("diary.toast.timerReset"));
  };

  const deleteWorkout = async (sessionId: number | null) => {
    const isConfirmed = await confirm({
      title: t("diary.confirm.deleteWorkoutTitle"),
      text: t("diary.confirm.deleteWorkoutText"),
      confirmText: t("diary.confirm.deleteWorkout"),
    });
    if (!isConfirmed) return;
    try {
      await diaryStore.deleteSession(date, sessionId);
      info(t("diary.toast.deleted"));
      onTrainedChanged();
    } catch (error) {
      fail(error);
    }
  };

  /** 409: answered on another device; `reload` reads that answer */
  const answerPrescription = async (
    prescription: Prescription,
    answer: "accept" | "decline",
    reload: () => void,
  ) => {
    if (answer === "decline") {
      const isConfirmed = await confirm({
        title: t("diary.prescription.declineTitle"),
        text: t("diary.prescription.declineText", {
          name: prescription.trainer_name || t("diary.prescription.yourCoach"),
        }),
        confirmText: t("diary.prescription.decline"),
      });
      if (!isConfirmed) return;
    }
    try {
      await prescriptionApi.answer(prescription.id, answer);
      info(
        answer === "accept"
          ? t("diary.prescription.accepted")
          : t("diary.prescription.declined"),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(error.message);
      } else {
        fail(error);
      }
    }
    reload();
  };

  return {
    updateExercise,
    finish,
    changeDuration,
    removeExercise,
    dropSuperset,
    move,
    moveGroup,
    moveMember,
    makeSuperset,
    join,
    leave,
    pickExercise,
    loadTemplate,
    loadPrescription,
    startSuggestion,
    quickLoad,
    copyYesterday,
    clearWorkout,
    resetWorkoutTimer,
    deleteWorkout,
    answerPrescription,
    save,
    confirm,
    fail,
    dialogs: { confirm: dialog, choice: choiceSheet },
  };
}
