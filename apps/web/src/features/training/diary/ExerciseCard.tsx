import {
  Button,
  Chip,
  Menu,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Info,
  Play,
  Plus,
  Ruler,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCollapseState, setCollapsed } from "../lib/cardCollapse";
import {
  updateSetInList,
  nextSetIndex,
  workingSetNumber,
} from "../lib/supersets";
import { progressionSuggestion, volumeDeltaPct } from "../lib/templateLoad";
import {
  exerciseVolume,
  fmtSetDuration,
  fmtSetLabel,
  generateWarmupSets,
  parseDuration,
  resolveLoadType,
  resolveSetType,
} from "../lib/workout";
import type {
  LastSession,
  LoadType,
  SetType,
  WorkoutExercise,
  WorkoutSet,
} from "../lib/workoutTypes";
import { useDiaryFormats } from "./format";
import { LoadTypeMenu } from "./LoadTypeMenu";
import { SetRow } from "./SetRow";
import type { SetMedia } from "./setMediaApi";

export interface ExerciseCardSettings {
  unit: "kg" | "lbs";
  shouldAutoCollapse: boolean;
  hasRpe: boolean;
  loadTypePrefs: Record<string, LoadType | undefined>;
  setTypePrefs: Record<string, SetType | undefined>;
  rememberLoadType: (exerciseId: number, loadType: LoadType) => void;
  rememberSetType: (exerciseId: number, setType: SetType) => void;
}

export interface ExerciseCardProps {
  exercise: WorkoutExercise;
  /** Position in the day's list */
  idx: number;
  date: string;
  today: string;
  settings: ExerciseCardSettings;
  lastSession: LastSession | null;
  /** Set indices that are records */
  records?: Set<number>;
  /** set uuid to its clip */
  media: Map<string, SetMedia>;
  /** Index of the set whose hold is running, -1 when none */
  holdSetIdx: number;
  menuItems: MenuItem[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onChange: (exercise: WorkoutExercise) => void;
  onRemove: () => void;
  onInfo: () => void;
  onStartHold: (setIdx: number) => void;
  onStopHold: () => void;
  onOpenClip: (media: SetMedia) => void;
}

/** One exercise of the day with its sets */
export function ExerciseCard({
  exercise,
  idx,
  date,
  today,
  settings,
  lastSession,
  records,
  media,
  holdSetIdx,
  menuItems,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
  onInfo,
  onStartHold,
  onStopHold,
  onOpenClip,
}: ExerciseCardProps) {
  const { t } = useTranslation("training");
  const { daysAgo } = useDiaryFormats();
  const [isRemembered, setIsRemembered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const sets = exercise.sets ?? [];
  const working = sets.filter((s) => !s.warmup);
  const doneCount = working.filter((s) => s.completed).length;
  const isAllDone = working.length > 0 && doneCount === working.length;
  const name = exercise.exercise_name ?? "";
  const rowKey = `ex:${idx}:${exercise.exercise_id ?? name}`;
  const loadType = resolveLoadType(
    exercise,
    exercise._library_load_type,
    settings.loadTypePrefs,
  );
  const setType = resolveSetType(
    exercise,
    exercise._library_set_type,
    settings.setTypePrefs,
  );
  const isTimed = setType === "time";

  const [isExpanded, setIsExpanded] = useState(
    () => getCollapseState(date, rowKey) !== "collapsed",
  );
  const expand = (isOpen: boolean) => {
    setIsExpanded(isOpen);
    setCollapsed(date, rowKey, !isOpen);
  };

  // Collapses once when every working set is done, unless the user opened it
  const collapsedFor = useRef("");
  useEffect(() => {
    if (!settings.shouldAutoCollapse || !isAllDone) return;
    const signature = `${exercise.exercise_id ?? name}|${working.length}`;
    if (collapsedFor.current === signature) return;
    collapsedFor.current = signature;
    if (getCollapseState(date, rowKey) !== "expanded") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- once, when the last set is ticked
      setIsExpanded(false);
      setCollapsed(date, rowKey, true);
    }
  }, [
    settings.shouldAutoCollapse,
    isAllDone,
    working.length,
    exercise.exercise_id,
    name,
    date,
    rowKey,
  ]);

  const volume = exerciseVolume({ ...exercise, load_type: loadType });
  const lastVolume = lastSession
    ? exerciseVolume({
        load_type: loadType,
        sets: lastSession.completed.map((s) => ({ ...s, completed: true })),
      })
    : 0;
  const delta = volumeDeltaPct(volume, lastVolume);
  const suggestion = progressionSuggestion(
    exercise,
    lastSession,
    settings.unit,
    isTimed,
  );
  const clips = sets.flatMap((s) => {
    const clip = s.uuid ? media.get(s.uuid) : undefined;
    return clip ? [clip] : [];
  });
  const next = nextSetIndex(sets);
  const workingWeight =
    parseFloat(
      String(
        sets.find((s) => !s.warmup)?.weight ?? exercise.target_weight ?? 0,
      ),
    ) || 0;
  const canWarmUp =
    !isTimed && !sets.some((s) => s.warmup) && workingWeight > 0;

  const changeSets = (updated: WorkoutSet[]) => {
    onChange({ ...exercise, sets: updated });
  };

  const addSet = () => {
    const last = sets[sets.length - 1] ?? { reps: 0, weight: 0 };
    changeSets([
      ...sets,
      {
        reps: last.reps,
        weight: last.weight,
        completed: false,
        notes: "",
        ...(last.duration_sec ? { duration_sec: last.duration_sec } : {}),
      },
    ]);
  };

  const chipText = [
    loadType === "paired" ? t("diary.card.paired") : null,
    loadType === "unilateral" ? t("diary.card.unilateral") : null,
    isTimed ? t("diary.card.time") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Stack
      gap={2}
      padding={3}
      radius="lg"
      surface="surface"
      className={`border ${isAllDone ? "border-success/40" : "border-border-subtle"}`}
    >
      <Row gap={1} align="center">
        <div
          className="min-w-0 flex-1"
          onContextMenu={(event) => {
            event.preventDefault();
            setIsMenuOpen(true);
          }}
        >
          <Pressable
            label={`${name}: ${
              isExpanded ? t("diary.card.collapse") : t("diary.card.expand")
            }`}
            isExpanded={isExpanded}
            onPress={() => {
              expand(!isExpanded);
            }}
            align="start"
            className="w-full"
          >
            <span className="flex w-full min-w-0 items-center gap-1">
              {isExpanded ? (
                <ChevronDown aria-hidden size={16} className="shrink-0" />
              ) : (
                <ChevronRight aria-hidden size={16} className="shrink-0" />
              )}
              <Text variant="heading" as="span" isTruncated>
                {name}
              </Text>
            </span>
            <Text variant="caption" tone={isAllDone ? "success" : "muted"}>
              {t("diary.card.sets", {
                done: doneCount,
                total: working.length,
              })}
            </Text>
          </Pressable>
        </div>
        {clips[0] && (
          <Button
            size="sm"
            text={clips.length > 1 ? String(clips.length) : undefined}
            aria-label={t("diary.card.watchClip")}
            onClick={() => {
              if (clips[0]) onOpenClip(clips[0]);
            }}
          >
            <Play aria-hidden size={16} />
          </Button>
        )}
        {onMoveUp && (
          <Button
            size="sm"
            aria-label={t("diary.card.moveUp", { name })}
            onClick={onMoveUp}
          >
            <ArrowUp aria-hidden size={16} />
          </Button>
        )}
        {onMoveDown && (
          <Button
            size="sm"
            aria-label={t("diary.card.moveDown", { name })}
            onClick={onMoveDown}
          >
            <ArrowDown aria-hidden size={16} />
          </Button>
        )}
        <Button
          size="sm"
          aria-label={t("diary.card.info", { name })}
          onClick={onInfo}
        >
          <Info aria-hidden size={16} />
        </Button>
        <Menu
          label={t("diary.card.menu", { name })}
          items={menuItems}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          align="end"
        >
          <Button size="sm" aria-label={t("diary.card.menu", { name })}>
            <EllipsisVertical aria-hidden size={16} />
          </Button>
        </Menu>
        <Button
          size="sm"
          aria-label={t("diary.card.remove", { name })}
          onClick={onRemove}
        >
          <X aria-hidden size={16} />
        </Button>
      </Row>

      {isExpanded && (
        <>
          <Row gap={2} align="center" shouldWrap>
            <LoadTypeMenu
              loadType={loadType}
              setType={setType}
              isRemembered={isRemembered}
              onRememberChange={setIsRemembered}
              onPickLoad={(picked) => {
                onChange({ ...exercise, load_type: picked });
                if (isRemembered && exercise.exercise_id != null) {
                  settings.rememberLoadType(exercise.exercise_id, picked);
                }
              }}
              onPickSetType={(picked) => {
                // The sets stay as they are: typed reps come back on Reps
                onChange({ ...exercise, set_type: picked });
                if (isRemembered && exercise.exercise_id != null) {
                  settings.rememberSetType(exercise.exercise_id, picked);
                }
              }}
            >
              <Button
                size="sm"
                variant="secondary"
                text={chipText || undefined}
                aria-label={t("diary.card.loadType")}
              >
                <Ruler aria-hidden size={14} />
              </Button>
            </LoadTypeMenu>
            {lastSession?.date && (
              <Row gap={1} align="center" shouldWrap className="min-w-0">
                <Text variant="caption" tone="muted">
                  {t("diary.card.last", {
                    when: daysAgo(lastSession.date, today),
                  })}
                </Text>
                <Text variant="mono">
                  {lastSession.completed
                    .map((s) =>
                      fmtSetLabel({ set_type: lastSession.set_type }, s),
                    )
                    .join(" · ")}
                </Text>
                {delta !== null && delta !== 0 && (
                  <Chip
                    text={`${delta > 0 ? "+" : ""}${delta}%`}
                    tone={delta > 0 ? "accent" : "danger"}
                    title={t("diary.card.volumeDelta")}
                  />
                )}
              </Row>
            )}
          </Row>

          <Stack gap={1}>
            {sets.map((set, setIdx) => (
              <SetRow
                key={set.uuid ?? setIdx}
                set={set}
                setNum={workingSetNumber(sets, setIdx)}
                unit={settings.unit}
                loadType={loadType}
                setType={setType}
                isNext={setIdx === next}
                isRecord={records?.has(setIdx) ?? false}
                hasClip={!!(set.uuid && media.get(set.uuid))}
                isHoldRunning={holdSetIdx === setIdx}
                hasRpe={settings.hasRpe}
                onChange={(updated) => {
                  changeSets(updateSetInList(sets, setIdx, updated));
                }}
                onRemove={() => {
                  changeSets(sets.filter((_, i) => i !== setIdx));
                }}
                onStartHold={() => {
                  onStartHold(setIdx);
                }}
                onStopHold={onStopHold}
                onOpenClip={() => {
                  const clip = set.uuid ? media.get(set.uuid) : undefined;
                  if (clip) onOpenClip(clip);
                }}
              />
            ))}
          </Stack>

          <Row gap={2} shouldWrap>
            <Button
              size="sm"
              variant="secondary"
              text={t("diary.card.addSet")}
              onClick={addSet}
            >
              <Plus aria-hidden size={14} />
            </Button>
            {canWarmUp && (
              <Button
                size="sm"
                text={t("diary.card.warmups")}
                onClick={() => {
                  const warmups = generateWarmupSets(
                    workingWeight,
                    settings.unit,
                  );
                  if (warmups.length) changeSets([...warmups, ...sets]);
                }}
              >
                <Zap aria-hidden size={14} />
              </Button>
            )}
          </Row>

          {(exercise.target_weight ||
            (!isTimed && exercise.target_reps) ||
            (isTimed && exercise.target_duration) ||
            exercise.notes ||
            suggestion) && (
            <Row gap={2} shouldWrap align="center">
              {!!exercise.target_weight && (
                <Chip
                  text={t("diary.card.targetWeight", {
                    weight: exercise.target_weight,
                  })}
                />
              )}
              {!isTimed && !!exercise.target_reps && (
                <Chip
                  text={t("diary.card.targetReps", {
                    reps: exercise.target_reps,
                  })}
                />
              )}
              {isTimed && !!exercise.target_duration && (
                <Chip
                  text={
                    fmtSetDuration(parseDuration(exercise.target_duration)) ||
                    String(exercise.target_duration)
                  }
                />
              )}
              {suggestion && (
                <Chip
                  tone="accent"
                  icon={<TrendingUp aria-hidden size={12} />}
                  title={t("diary.card.suggestionHint")}
                  text={t("diary.card.suggestion", {
                    weight: suggestion.weight,
                    step: suggestion.step,
                  })}
                />
              )}
              {exercise.notes && (
                <Text variant="caption" tone="muted" shouldKeepLineBreaks>
                  {exercise.notes}
                </Text>
              )}
            </Row>
          )}
        </>
      )}
    </Stack>
  );
}
