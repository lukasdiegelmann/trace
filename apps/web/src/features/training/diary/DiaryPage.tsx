import {
  Banner,
  Button,
  Chip,
  InlineEdit,
  Input,
  Menu,
  Pressable,
  Row,
  Sheet,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import {
  useIsCoarsePointer,
  useMediaQuery,
} from "@monocircuit/monolithium/hooks";
import {
  Calculator,
  CircleCheck,
  EllipsisVertical,
  Flag,
  GripVertical,
  Library,
  Mail,
  MessagesSquare,
  NotebookPen,
  PanelRight,
  PanelRightClose,
  Play,
  Plus,
  Scale,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";

import { getExercise } from "../exercises/api";
import { ExerciseInfoSheet } from "../exercises/ExerciseInfoSheet";
import { isValidDate, streakCount } from "../lib/dates";
import {
  consumeHoldResult,
  holdMatches,
  holdResult,
  holdTimer,
  startHold,
  stopHold,
} from "../lib/holdTimer";
import { notesForExercise, workoutNotes } from "../lib/coachNotes";
import { countPrs, prFlags } from "../lib/prs";
import { safeStorage } from "../lib/store";
import {
  currentStatus,
  existingSupersets,
  groupExercises,
  isInSuperset,
  updateSetInList,
  type ExerciseGroup,
} from "../lib/supersets";
import { enableWakeLock } from "../lib/wakeLock";
import {
  ageFromDob,
  countCompletedSets,
  exerciseVolume,
  fmtSetDuration,
} from "../lib/workout";
import {
  elapsedMs,
  formatTimerMs,
  timerMinutes,
  workoutTimer,
} from "../lib/workoutTimer";
import type { CoachFeedback, WorkoutExercise } from "../lib/workoutTypes";
import { feedbackApi, statusOf, type InboxRow } from "./api";
import { BodyStatsSheet } from "./BodyStatsSheet";
import { CardioCard } from "./CardioCard";
import { CoachNote } from "./CoachNotes";
import { CoachInboxSheet, CoachSection } from "./CoachSection";
import { DateNav } from "./DateNav";
import { ActionSheet } from "./dialogs";
import { diaryStore } from "./diaryStore";
import { EmptyDay } from "./EmptyDay";
import { ExerciseCard, type ExerciseCardSettings } from "./ExerciseCard";
import { ExercisePickerSheet } from "./ExercisePickerSheet";
import { useDiaryFormats, useNow, useStore, useToday } from "./format";
import { GymToolsSheet } from "./GymTools";
import { HoldBar } from "./HoldBar";
import { LoadWorkoutSheet } from "./LoadWorkoutSheet";
import { getLtSettings, setLtSetting, useLtSettings } from "./ltSettings";
import { OverviewPanel } from "./OverviewPanel";
import { SessionTabs } from "./SessionTabs";
import type { SetMedia } from "./setMediaApi";
import { SetVideoPlayer } from "./SetVideoPlayer";
import { SetVideoSheet } from "./SetVideoSheet";
import { SummaryBar } from "./SummaryBar";
import { SupersetCard } from "./SupersetCard";
import { JoinSupersetSheet, NewSupersetSheet } from "./SupersetSheets";
import {
  useDiaryActions,
  type LoadMode,
  type PickerTarget,
} from "./useDiaryActions";
import {
  useActiveDates,
  useActiveProgram,
  useDayFeedback,
  useDayMedia,
  useDayPrescription,
  useHistories,
  useInbox,
  useRecentWorkouts,
  useUnreadFeedbackDates,
  useUpcomingPrescriptions,
} from "./useDiaryData";
import type { Choice } from "./useDialogs";
import { WorkoutSummarySheet } from "./WorkoutSummarySheet";

const RAIL_KEY = "lt:diaryRailMode";

type SheetName = "add" | "bodyStats" | "gymTools" | "overview" | "inbox";

/** The session notes: saved on leaving the field, only when typed in */
function SessionNotes({
  value,
  onSave,
}: {
  value: string;
  onSave: (notes: string) => void;
}) {
  const { t } = useTranslation("training");
  const [draft, setDraft] = useState<{ text: string; was: string } | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  if (!isOpen && !value.trim()) {
    return (
      <Row>
        <Button
          size="sm"
          text={t("diary.notes.add")}
          onClick={() => {
            setIsOpen(true);
          }}
        >
          <NotebookPen aria-hidden size={14} />
        </Button>
      </Row>
    );
  }
  return (
    <Input
      multiline
      rows={3}
      label={t("diary.notes.label")}
      placeholder={t("diary.notes.placeholder")}
      value={draft?.text ?? value}
      onFocus={() => {
        setDraft({ text: value, was: value });
      }}
      onValueChange={(text) => {
        setDraft((current) => ({ text, was: current?.was ?? value }));
      }}
      onBlur={() => {
        // Untouched, nothing is saved: older notes never come back
        if (draft && draft.text !== draft.was) onSave(draft.text);
        setDraft(null);
      }}
    />
  );
}

export function DiaryPage() {
  const { t } = useTranslation("training");
  const toast = useToast();
  const { shortDate } = useDiaryFormats();
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const asked = params.get("date");
  // Without ?date= the diary shows today and follows midnight
  const date = isValidDate(asked) ? (asked as string) : today;
  const isFuture = date > today;

  const diary = useStore(diaryStore.state);
  const isShown = diary.date === date && !diary.isLoading;
  const log = isShown ? diary.log : null;
  const exercises = useMemo(() => log?.exercises ?? [], [log]);

  useEffect(() => {
    void diaryStore.load(date);
  }, [date]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") void diaryStore.flush();
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      void diaryStore.flush();
    };
  }, []);

  const goTo = (next: string) => {
    setParams(next === today ? {} : { date: next });
  };

  // ── Data around the day ──────────────────────────────────────────────
  const settings = useLtSettings();
  const unit = settings.weightUnit;
  const ids = exercises.flatMap((e) =>
    e.exercise_id != null ? [e.exercise_id] : [],
  );
  const histories = useHistories(date, ids);
  const activeDates = useActiveDates(settings.cardioEnabled);
  const streak = streakCount(activeDates.dates, today);
  const recent = useRecentWorkouts();
  const activeProgram = useActiveProgram();
  const prescription = useDayPrescription(date);
  const upcoming = useUpcomingPrescriptions();
  const feedback = useDayFeedback(date);
  const unread = useUnreadFeedbackDates();
  const media = useDayMedia(date);
  const [open, setOpen] = useState<SheetName | null>(null);
  const inbox = useInbox(open === "inbox");

  const reloadFeedback = feedback.reload;
  const reloadUnread = unread.reload;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      reloadFeedback();
      reloadUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadFeedback, reloadUnread]);

  useEffect(() => {
    if (settings.screenKeepAwake) void enableWakeLock();
  }, [settings.screenKeepAwake]);

  const records = prFlags(exercises, histories.bests);
  const count = countCompletedSets(exercises);
  const volume = exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
  const status = currentStatus(exercises);
  const groups = groupExercises(exercises);
  const timer = useStore(workoutTimer);
  const isTimerOfDay = timer?.date === date;
  const now = useNow(1000, isTimerOfDay && !timer.paused);

  // ── Who is asking ────────────────────────────────────────────────────
  const { sessions } = useAuth();
  const user =
    sessions?.lt.state === "signed-in" ? sessions.lt.user : undefined;
  const profile = {
    weight_kg: settings.currentWeightKg,
    height_cm: settings.heightCm,
    age: ageFromDob(
      (user?.birthday as string | null | undefined) || settings.dob,
    ),
    sex: (user?.gender as string | null | undefined) || settings.gender,
  };

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const reloadActive = activeDates.reload;
  const reloadRecent = recent.reload;
  const actions = useDiaryActions({
    date,
    isFuture,
    profile,
    onTrainedChanged: () => {
      reloadActive();
      reloadRecent();
    },
    onShowSummary: () => {
      setIsSummaryOpen(true);
    },
  });

  // ── Sheets ───────────────────────────────────────────────────────────
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [loadSheet, setLoadSheet] = useState<{ forcedMode?: LoadMode } | null>(
    null,
  );
  const [info, setInfo] = useState<number | null>(null);
  const [joinFor, setJoinFor] = useState<number | null>(null);
  const [newFor, setNewFor] = useState<number | null>(null);
  const [videoFor, setVideoFor] = useState<WorkoutExercise | null>(null);
  const [clip, setClip] = useState<SetMedia | null>(null);
  const closeSheet = () => {
    setOpen(null);
  };

  // Another day: what was open for the last one closes
  const [sheetsDate, setSheetsDate] = useState(date);
  if (sheetsDate !== date) {
    setSheetsDate(date);
    setIsSummaryOpen(false);
    setInfo(null);
    setJoinFor(null);
    setNewFor(null);
  }

  const isWide = useMediaQuery("(min-width: 80rem)");
  const isCoarse = useIsCoarsePointer();
  const [railMode, setRailMode] = useState<"pinned" | "hidden">(() =>
    safeStorage.read(RAIL_KEY) === "hidden" ? "hidden" : "pinned",
  );
  const setRail = (mode: "pinned" | "hidden") => {
    setRailMode(mode);
    safeStorage.write(RAIL_KEY, mode);
  };
  const isRailShown = isWide && railMode === "pinned";

  // `?addExercise=<id>`: the exercise another screen asked to log
  const asksToAdd = params.get("addExercise");
  const handledAdd = useRef<string | null>(null);
  useEffect(() => {
    if (!asksToAdd) {
      handledAdd.current = null;
      return;
    }
    if (!isShown || handledAdd.current === asksToAdd) return;
    handledAdd.current = asksToAdd;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("addExercise");
        return next;
      },
      { replace: true },
    );
    const id = Number(asksToAdd);
    if (!Number.isInteger(id) || id <= 0) return;
    getExercise(id)
      .then((picked) => actions.pickExercise(picked, { kind: "add" }))
      .catch(() => {
        toast.error(t("diary.toast.addFailed"));
      });
    // Once per request; the actions are rebuilt every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asksToAdd, isShown]);

  // ── Hold timer ───────────────────────────────────────────────────────
  const hold = useStore(holdTimer);
  const held = useStore(holdResult);
  useEffect(() => {
    if (!held || !isShown || held.date !== date) return;
    // Applied here, not by the card: a collapsed superset still gets it
    const exIdx = exercises.findIndex((exercise, i) =>
      holdMatches(held, { date, exIdx: i, exercise }),
    );
    const exercise = exIdx >= 0 ? exercises.at(exIdx) : undefined;
    const sets = exercise?.sets ?? [];
    const byUuid = held.setUuid
      ? sets.findIndex((s) => s.uuid === held.setUuid)
      : -1;
    const setIdx = byUuid >= 0 ? byUuid : held.setIdx;
    consumeHoldResult();
    const set = sets.at(setIdx);
    if (!exercise || !set) {
      toast.error(
        t("diary.toast.holdNotFound", {
          time: fmtSetDuration(held.elapsedSec),
        }),
      );
      return;
    }
    void actions.updateExercise(exIdx, {
      ...exercise,
      sets: updateSetInList(sets, setIdx, {
        ...set,
        duration_sec: held.elapsedSec,
        completed: true,
      }),
    });
    // The result is consumed once; the rest changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, isShown]);

  // ── Coach ────────────────────────────────────────────────────────────
  const patchNote = (id: number, change: Partial<CoachFeedback>) => {
    feedback.patch((list) =>
      list.map((note) => (note.id === id ? { ...note, ...change } : note)),
    );
  };
  const reply = {
    onOpen: (note: CoachFeedback) => {
      // Opening the reply counts as read
      if (note.seen_by_member_at) return;
      patchNote(note.id, { seen_by_member_at: new Date().toISOString() });
      void feedbackApi
        .markSeen(note.id)
        .then(reloadUnread)
        .catch(() => undefined);
    },
    onSave: async (note: CoachFeedback, text: string) => {
      try {
        await feedbackApi.reply(note.id, text);
        patchNote(note.id, {
          member_reply: text || null,
          member_replied_at: text ? new Date().toISOString() : null,
        });
        return true;
      } catch {
        toast.error(t("diary.toast.replyFailed"));
        return false;
      }
    },
    onDelete: (note: CoachFeedback) => {
      void actions
        .confirm({
          title: t("diary.confirm.deleteReplyTitle"),
          text: t("diary.confirm.deleteReplyText"),
          confirmText: t("diary.confirm.delete"),
        })
        .then((isConfirmed) => {
          if (isConfirmed) void reply.onSave(note, "");
        });
    },
  };
  const openInboxRow = (row: InboxRow) => {
    closeSheet();
    void feedbackApi
      .markSeen(row.id)
      .catch(() => undefined)
      .then(() => {
        reloadUnread();
        if (row.workout_date && row.workout_date !== date) {
          goTo(row.workout_date);
        } else {
          reloadFeedback();
        }
      });
  };
  const answer = (
    chosen: Parameters<typeof actions.answerPrescription>[0],
    choice: "accept" | "decline",
  ) => {
    void actions.answerPrescription(chosen, choice, () => {
      prescription.reload();
      upcoming.reload();
    });
  };
  const hasCoach =
    !!user?.trainer_id || unread.count > 0 || (inbox.value?.length ?? 0) > 0;
  const coachPick =
    upcoming.value.find((p) => !p.date && statusOf(p) === "accepted") ?? null;

  // ── Workout actions ──────────────────────────────────────────────────
  const workoutActions: Choice[] = [
    { id: "replace", text: t("diary.actions.replace") },
    { id: "copy", text: t("diary.actions.copyYesterday") },
    ...(timer
      ? [{ id: "resetTimer", text: t("diary.actions.resetTimer") }]
      : []),
    { id: "clear", text: t("diary.actions.clear"), isDanger: true },
    ...(isShown && diary.sessionId != null
      ? [{ id: "delete", text: t("diary.actions.delete"), isDanger: true }]
      : []),
  ];
  const runAction = (id: string) => {
    if (id === "replace") setLoadSheet({});
    if (id === "copy") void actions.copyYesterday();
    if (id === "resetTimer") void actions.resetWorkoutTimer();
    if (id === "clear") void actions.clearWorkout();
    if (id === "delete") void actions.deleteWorkout(diary.sessionId);
  };

  // ── Cards ────────────────────────────────────────────────────────────
  const cardSettings: ExerciseCardSettings = {
    unit,
    shouldAutoCollapse: settings.autoCollapseCompleted,
    hasRpe: settings.trackRpe,
    loadTypePrefs: settings.exerciseLoadTypes,
    setTypePrefs: settings.exerciseSetTypes,
    rememberLoadType: (id, loadType) => {
      setLtSetting("exerciseLoadTypes", {
        ...getLtSettings().exerciseLoadTypes,
        [id]: loadType,
      });
    },
    rememberSetType: (id, setType) => {
      setLtSetting("exerciseSetTypes", {
        ...getLtSettings().exerciseSetTypes,
        [id]: setType,
      });
    },
  };
  const method = settings.exerciseReorderMethod;
  const hasDrag = method !== "buttons" && !isCoarse;
  // Dragging doesn't work with a finger: buttons there either way
  const hasButtons = method !== "drag" || isCoarse;
  const supersets = existingSupersets(exercises);
  const [armed, setArmed] = useState<number | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);

  const menuItems = (exercise: WorkoutExercise, idx: number) => {
    const item = (id: string, text: string, onSelect: () => void) => ({
      id,
      text,
      onSelect,
    });
    return [
      item("film", t("diary.exerciseMenu.film"), () => {
        setVideoFor(exercise);
      }),
      item("replace", t("diary.exerciseMenu.replace"), () => {
        setPicker({ kind: "replace", idx });
      }),
      ...(isInSuperset(exercise)
        ? [
            item("leave", t("diary.exerciseMenu.leaveSuperset"), () => {
              void actions.leave(idx);
            }),
          ]
        : [
            ...(supersets.length
              ? [
                  item("join", t("diary.exerciseMenu.joinSuperset"), () => {
                    setJoinFor(idx);
                  }),
                ]
              : []),
            ...(exercises.length >= 2
              ? [
                  item("new", t("diary.exerciseMenu.newSuperset"), () => {
                    setNewFor(idx);
                  }),
                ]
              : []),
          ]),
    ];
  };

  const card = (
    exercise: WorkoutExercise,
    idx: number,
    moves: { up?: () => void; down?: () => void },
  ) => {
    const isHolding = holdMatches(hold, { date, exIdx: idx, exercise });
    return (
      <Stack key={exercise.uuid ?? idx} gap={1}>
        <ExerciseCard
          exercise={exercise}
          idx={idx}
          date={date}
          today={today}
          settings={cardSettings}
          lastSession={
            exercise.exercise_id != null
              ? (histories.lastSessions.get(exercise.exercise_id) ?? null)
              : null
          }
          records={records.get(idx)}
          media={media.bySet}
          holdSetIdx={
            isHolding
              ? (exercise.sets ?? []).findIndex((_, setIdx) =>
                  holdMatches(hold, { date, exIdx: idx, exercise, setIdx }),
                )
              : -1
          }
          menuItems={menuItems(exercise, idx)}
          onMoveUp={moves.up}
          onMoveDown={moves.down}
          onChange={(next) => void actions.updateExercise(idx, next)}
          onRemove={() => void actions.removeExercise(idx)}
          onInfo={() => {
            setInfo(idx);
          }}
          onStartHold={(setIdx) => {
            const set = exercise.sets?.[setIdx];
            if (!set) return;
            startHold({
              date,
              exIdx: idx,
              setIdx,
              exerciseId: exercise.exercise_id ?? null,
              exerciseUuid: exercise.uuid ?? null,
              setUuid: set.uuid ?? null,
              exerciseName: exercise.exercise_name ?? "",
              targetSec: set.duration_sec ?? 0,
            });
          }}
          onStopHold={() => {
            stopHold();
          }}
          onOpenClip={setClip}
        />
        {notesForExercise(feedback.value, exercise.uuid, idx).map((note) => (
          <CoachNote key={note.id} note={note} {...reply} />
        ))}
      </Stack>
    );
  };

  const group = (entry: ExerciseGroup, groupIdx: number) => {
    const first = entry.exercises.at(0);
    if (!first) return null;
    const content =
      entry.type === "superset" && entry.supersetId != null ? (
        <SupersetCard
          supersetId={entry.supersetId}
          exercises={entry.exercises}
          date={date}
          shouldAutoCollapse={settings.autoCollapseCompleted}
          onRemove={() => {
            if (entry.supersetId != null) {
              void actions.dropSuperset(entry.supersetId);
            }
          }}
          onAddExercise={() => {
            if (entry.supersetId != null) {
              setPicker({ kind: "superset", id: entry.supersetId });
            }
          }}
        >
          {entry.exercises.map((exercise, i) => {
            const id = entry.supersetId;
            return card(exercise, entry.startIdx + i, {
              up:
                i > 0 && id != null
                  ? () => void actions.moveMember(id, i, i - 1)
                  : undefined,
              down:
                i < entry.exercises.length - 1 && id != null
                  ? () => void actions.moveMember(id, i, i + 1)
                  : undefined,
            });
          })}
        </SupersetCard>
      ) : (
        card(first, entry.startIdx, {
          up:
            hasButtons && groupIdx > 0
              ? () => void actions.move(entry.startIdx, -1)
              : undefined,
          down:
            hasButtons && groupIdx < groups.length - 1
              ? () => void actions.move(entry.startIdx, 1)
              : undefined,
        })
      );
    return (
      <div
        key={first.uuid ?? entry.startIdx}
        data-ex-idx={entry.startIdx}
        // Draggable only from the handle, so fields keep text selection
        draggable={armed === groupIdx}
        onDragStart={(event) => {
          setDragged(groupIdx);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(groupIdx));
        }}
        onDragOver={(event) => {
          if (dragged === null || dragged === groupIdx) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (dragged !== null && dragged !== groupIdx) {
            void actions.moveGroup(dragged, groupIdx);
          }
          setDragged(null);
        }}
        onDragEnd={() => {
          setDragged(null);
          setArmed(null);
        }}
        className={`scroll-mt-4 ${dragged === groupIdx ? "opacity-50" : ""}`}
      >
        {hasDrag && groups.length > 1 && (
          // TODO(monolithium): a sortable list with a drag handle
          <div
            className="flex cursor-grab justify-center text-muted"
            title={t("diary.card.drag")}
            aria-hidden
            onPointerDown={() => {
              setArmed(groupIdx);
            }}
            onPointerUp={() => {
              setArmed(null);
            }}
          >
            <GripVertical size={14} className="rotate-90" />
          </div>
        )}
        {content}
      </div>
    );
  };

  const infoExercise = info === null ? undefined : exercises[info];
  const timerText = formatTimerMs(
    isTimerOfDay
      ? elapsedMs(timer, Math.max(now, 0))
      : (log?.duration_min ?? 0) * 60000,
    false,
  );

  const overview = (
    <OverviewPanel
      date={date}
      today={today}
      activeDates={activeDates.dates}
      streak={streak}
      recent={recent.value}
      activeProgram={activeProgram}
      log={log}
      prescription={prescription.value}
      unit={unit}
      actions={workoutActions}
      onSelectDate={(day) => {
        closeSheet();
        goTo(day);
      }}
      onLoadWorkout={() => {
        closeSheet();
        setLoadSheet({});
      }}
      onOpenBodyStats={() => {
        setOpen("bodyStats");
      }}
      onAction={(id) => {
        closeSheet();
        runAction(id);
      }}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl items-start gap-4 p-3">
      <Stack gap={3} className="min-w-0 flex-1">
        <Row gap={1} align="center" justify="between" shouldWrap>
          <Text variant="title" as="h1">
            {t("diary.title")}
          </Text>
          <Row gap={1} align="center">
            {exercises.length > 0 && (
              <Button
                variant="primary"
                aria-label={t("diary.add.title")}
                onClick={() => {
                  setOpen("add");
                }}
              >
                <Plus aria-hidden size={18} />
              </Button>
            )}
            {hasCoach && (
              <Button
                text={unread.count ? String(unread.count) : undefined}
                aria-label={
                  unread.count
                    ? t("diary.toolbar.coachUnread", { count: unread.count })
                    : t("diary.toolbar.coach")
                }
                onClick={() => {
                  setOpen("inbox");
                }}
              >
                {unread.count ? (
                  <Mail aria-hidden size={18} />
                ) : (
                  <MessagesSquare aria-hidden size={18} />
                )}
              </Button>
            )}
            {!isRailShown && (
              <>
                <Button
                  aria-label={t("diary.toolbar.load")}
                  onClick={() => {
                    setLoadSheet({});
                  }}
                >
                  <Library aria-hidden size={18} />
                </Button>
                <Button
                  aria-label={t("diary.toolbar.gymTools")}
                  onClick={() => {
                    setOpen("gymTools");
                  }}
                >
                  <Calculator aria-hidden size={18} />
                </Button>
                <Button
                  aria-label={t("diary.toolbar.bodyStats")}
                  onClick={() => {
                    setOpen("bodyStats");
                  }}
                >
                  <Scale aria-hidden size={18} />
                </Button>
              </>
            )}
            <Menu
              label={t("diary.toolbar.actions")}
              align="end"
              items={workoutActions.map((action) => ({
                id: action.id,
                text: action.text,
                tone: action.isDanger ? "danger" : "default",
                onSelect: () => {
                  runAction(action.id);
                },
              }))}
            >
              <Button aria-label={t("diary.toolbar.actions")}>
                <EllipsisVertical aria-hidden size={18} />
              </Button>
            </Menu>
            {isWide ? (
              <Button
                aria-label={
                  railMode === "pinned"
                    ? t("diary.overview.hide")
                    : t("diary.toolbar.overview")
                }
                aria-pressed={railMode === "pinned"}
                onClick={() => {
                  setRail(railMode === "pinned" ? "hidden" : "pinned");
                }}
              >
                {railMode === "pinned" ? (
                  <PanelRightClose aria-hidden size={18} />
                ) : (
                  <PanelRight aria-hidden size={18} />
                )}
              </Button>
            ) : (
              <Button
                aria-label={t("diary.toolbar.overview")}
                onClick={() => {
                  setOpen("overview");
                }}
              >
                <PanelRight aria-hidden size={18} />
              </Button>
            )}
          </Row>
        </Row>

        <DateNav
          date={date}
          today={today}
          dateFormat={settings.dateFormat}
          streak={streak}
          activeDates={activeDates.dates}
          unreadDates={unread.dates}
          onSelect={goTo}
          onOpenCalendar={() => {
            activeDates.reload();
            unread.reload();
          }}
        />

        {isShown && (
          <SessionTabs
            sessions={diary.sessions}
            sessionId={diary.sessionId}
            onSwitch={(id) => void diaryStore.switchSession(date, id)}
            onDelete={(id) => void actions.deleteWorkout(id)}
            onAdd={() => {
              setLoadSheet({ forcedMode: "new_session" });
            }}
          />
        )}

        {isFuture && (
          <Banner text={t("diary.planning", { date: shortDate(date) })} />
        )}

        <CoachSection
          today={today}
          dayPrescription={prescription.value}
          upcoming={upcoming.value}
          loadedTemplateId={log?.template_id}
          hasExercises={exercises.length > 0}
          isFuture={isFuture}
          onAnswer={answer}
          onLoad={(p) => void actions.loadPrescription(p)}
          onStartSuggestion={(p) => void actions.startSuggestion(p)}
        />

        {workoutNotes(feedback.value).map((note) => (
          <CoachNote key={note.id} note={note} {...reply} />
        ))}

        {exercises.length > 0 && (
          <>
            <SummaryBar
              date={date}
              count={count}
              exercises={exercises.length}
              volume={volume}
              unit={unit}
              minutes={log?.duration_min ?? 0}
              isCompleted={!!log?.completed}
            />
            {status && (
              <Pressable
                label={t("diary.now.jump")}
                onPress={() => {
                  document
                    .querySelector(`[data-ex-idx="${status.anchorIdx}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                padding={2}
                surface="surface"
                className="border-s-4 border-accent"
                align="start"
              >
                <span className="flex w-full items-center gap-2">
                  <Play aria-hidden size={14} />
                  <Text variant="label" as="span">
                    {t("diary.now.label")}
                  </Text>
                  <Text as="span" isTruncated className="min-w-0 flex-1">
                    {status.isSuperset
                      ? t("diary.now.superset", {
                          names: status.names.join(" / "),
                        })
                      : (status.names[0] ??
                        t("diary.now.exercise", {
                          number: status.anchorIdx + 1,
                        }))}
                  </Text>
                  <Text variant="caption" tone="muted" as="span">
                    {t("diary.now.set", {
                      set: status.setNumber,
                      total: status.setCount,
                    })}
                  </Text>
                </span>
              </Pressable>
            )}
            <Row gap={2} align="center" shouldWrap>
              {/* A new workout under the same field starts it over */}
              <InlineEdit
                key={`${date}:${diary.sessionId ?? "new"}`}
                label={t("diary.rename")}
                placeholder={t("diary.untitled")}
                value={log?.name ?? ""}
                variant="heading"
                className="min-w-0 flex-1"
                onCommit={(name) => {
                  if (name.trim() !== (log?.name ?? "")) {
                    void actions.save({ name: name.trim() });
                  }
                }}
              />
              {!!log?.program_week && (
                <Chip
                  text={
                    log.program_duration_weeks
                      ? t("diary.weekChipOf", {
                          week: log.program_week,
                          total: log.program_duration_weeks,
                        })
                      : t("diary.weekChip", { week: log.program_week })
                  }
                />
              )}
            </Row>
          </>
        )}

        {diary.date === date && diary.loadError ? (
          <Banner
            text={t("diary.loadError")}
            actionText={t("diary.retry")}
            onAction={() => void diaryStore.load(date)}
          />
        ) : !isShown ? (
          <Row justify="center" padding={6}>
            <Spinner label={t("diary.loading")} />
          </Row>
        ) : exercises.length === 0 ? (
          <EmptyDay
            isFuture={isFuture}
            activeProgram={activeProgram}
            coachPick={coachPick}
            lastWorkout={recent.value[0] ?? null}
            onLoadWorkout={() => {
              setLoadSheet({});
            }}
            onAddExercise={() => {
              setPicker({ kind: "add" });
            }}
            onStartSuggestion={(p) => void actions.startSuggestion(p)}
            onQuickLoad={(workout) => void actions.quickLoad(workout)}
          />
        ) : (
          <>
            {groups.map(group)}
            <SessionNotes
              key={`${date}:${diary.sessionId ?? "new"}`}
              value={log?.notes ?? ""}
              onSave={(notes) => void actions.save({ notes })}
            />
            {count.completed > 0 && !isFuture && (
              <Button
                variant={log?.completed ? "secondary" : "primary"}
                size="lg"
                isFullWidth
                text={
                  log?.completed
                    ? t("diary.finish.view")
                    : `${t("diary.finish.finish")} · ${t(
                        "diary.finish.detail",
                        {
                          done: count.completed,
                          total: count.total,
                          time: timerText,
                        },
                      )}`
                }
                onClick={() => void actions.finish(false)}
              >
                {log?.completed ? (
                  <CircleCheck aria-hidden size={18} />
                ) : (
                  <Flag aria-hidden size={18} />
                )}
              </Button>
            )}
          </>
        )}

        {settings.cardioEnabled && (
          <CardioCard date={date} onChange={activeDates.reload} />
        )}

        <HoldBar date={date} onOpenDate={goTo} />
      </Stack>

      {isRailShown && (
        <aside
          aria-label={t("diary.overview.title")}
          className="sticky top-3 w-80 shrink-0"
        >
          {overview}
        </aside>
      )}

      <Sheet
        isOpen={open === "overview"}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeSheet();
        }}
        title={t("diary.overview.title")}
      >
        {open === "overview" ? overview : null}
      </Sheet>
      <ActionSheet
        isOpen={open === "add"}
        onClose={closeSheet}
        title={t("diary.add.title")}
        actions={[
          { id: "exercise", text: t("diary.add.exercise") },
          { id: "session", text: t("diary.add.session") },
        ]}
        onSelect={(id) => {
          if (id === "exercise") setPicker({ kind: "add" });
          else setLoadSheet({ forcedMode: "new_session" });
        }}
      />
      <ExercisePickerSheet
        isOpen={picker !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPicker(null);
        }}
        onSelect={(picked) => {
          const target = picker ?? { kind: "add" as const };
          // Plain adding keeps the picker open for the next one
          if (target.kind !== "add") setPicker(null);
          void actions.pickExercise(picked, target);
        }}
      />
      <LoadWorkoutSheet
        isOpen={loadSheet !== null}
        onClose={() => {
          setLoadSheet(null);
        }}
        unit={unit}
        onLoad={({ template, program }) => {
          const forcedMode = loadSheet?.forcedMode;
          setLoadSheet(null);
          // The plan week only counts inside the active program
          const planWeek = program.is_active
            ? (program.current_week ?? null)
            : null;
          void actions.loadTemplate(
            {
              exercises: template.exercises,
              name: template.name,
              id: template.id,
            },
            {
              programId: program.id,
              planWeek,
              programWeeks: program.duration_weeks ?? null,
              question: "template",
              forcedMode,
            },
          );
        }}
      />
      <ExerciseInfoSheet
        isOpen={info !== null}
        onClose={() => {
          setInfo(null);
        }}
        exerciseId={infoExercise?.exercise_id ?? null}
        // Searched for without an id; it also titles the sheet
        exerciseName={infoExercise?.exercise_name}
        onReplace={() => {
          if (info !== null) setPicker({ kind: "replace", idx: info });
          setInfo(null);
        }}
      />
      <JoinSupersetSheet
        isOpen={joinFor !== null}
        onClose={() => {
          setJoinFor(null);
        }}
        supersets={supersets}
        onJoin={(id) => {
          if (joinFor !== null) void actions.join(joinFor, id);
        }}
      />
      <NewSupersetSheet
        idx={newFor}
        exercises={exercises}
        onClose={() => {
          setNewFor(null);
        }}
        onCreate={(indices) => void actions.makeSuperset(indices)}
      />
      <SetVideoSheet
        isOpen={videoFor !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setVideoFor(null);
        }}
        exercise={videoFor}
        workoutId={log?.id ?? null}
        onAttached={media.reload}
      />
      <SetVideoPlayer
        media={clip}
        subtitle={clipSubtitle(clip, exercises)}
        onClose={() => {
          setClip(null);
        }}
        onDeleted={media.reload}
        onReplied={media.reload}
      />
      <BodyStatsSheet
        isOpen={open === "bodyStats"}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeSheet();
        }}
        date={date}
      />
      <GymToolsSheet
        isOpen={open === "gymTools"}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeSheet();
        }}
        unit={unit}
      />
      <CoachInboxSheet
        isOpen={open === "inbox"}
        onClose={closeSheet}
        rows={inbox.value}
        onOpenRow={openInboxRow}
        onMarkAll={() => {
          void feedbackApi
            .markSeen()
            .catch(() => undefined)
            .then(() => {
              inbox.reload();
              reloadUnread();
            });
        }}
      />
      <WorkoutSummarySheet
        isOpen={isSummaryOpen}
        onOpenChange={setIsSummaryOpen}
        workout={log}
        prCount={countPrs(records)}
        streak={streak}
        timerMinutes={isTimerOfDay ? timerMinutes(timer) : null}
        onDurationChange={(minutes) => void actions.changeDuration(minutes)}
        profile={profile}
      />
      {actions.dialogs.confirm}
      {actions.dialogs.choice}
    </div>
  );
}

/** "Bench press, set 2": which set a clip opened from a card shows */
function clipSubtitle(
  clip: SetMedia | null,
  exercises: WorkoutExercise[],
): string | undefined {
  const exercise = exercises.find((e) => e.uuid === clip?.exercise_uuid);
  if (!exercise) return undefined;
  const number =
    (exercise.sets ?? []).findIndex((s) => s.uuid === clip?.set_uuid) + 1;
  return number > 0
    ? `${exercise.exercise_name ?? ""} · ${number}`
    : exercise.exercise_name;
}
