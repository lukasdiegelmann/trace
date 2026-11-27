import { Button, Chip, Menu } from "@monocircuit/monolithium/components";
import {
  ChevronDown,
  Circle,
  CircleCheck,
  CircleStop,
  Link2Off,
  Minus,
  Play,
  Plus,
  Split,
  Timer,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { vibrate } from "../lib/cues";
import {
  fmtSetDuration,
  maskDurationInput,
  parseDuration,
} from "../lib/workout";
import type { LoadType, SetType, WorkoutSet } from "../lib/workoutTypes";
import { DraftInput } from "./DraftInput";

const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8];

export interface SetRowProps {
  set: WorkoutSet;
  /** Position among the working sets, 1-based */
  setNum: number;
  unit: string;
  loadType: LoadType;
  setType: SetType;
  /** The first open working set */
  isNext: boolean;
  isRecord: boolean;
  hasClip: boolean;
  isHoldRunning: boolean;
  hasRpe: boolean;
  onChange: (set: WorkoutSet) => void;
  onRemove: () => void;
  onStartHold: () => void;
  onStopHold: () => void;
  onOpenClip: () => void;
}

const asText = (value: number | null | undefined) =>
  value == null || Number.isNaN(value) ? "" : String(value);

/** One set: number, weight, reps or duration, tick, RPE */
export function SetRow({
  set,
  setNum,
  unit,
  loadType,
  setType,
  isNext,
  isRecord,
  hasClip,
  isHoldRunning,
  hasRpe,
  onChange,
  onRemove,
  onStartHold,
  onStopHold,
  onOpenClip,
}: SetRowProps) {
  const { t } = useTranslation("training");
  const isTimed = setType === "time";
  const isSplit =
    !isTimed &&
    loadType === "unilateral" &&
    (set.reps_l != null || set.reps_r != null);
  const isDone = !!set.completed;
  const number = set.number ?? setNum;
  /** Plate-aware step: the smallest common plate pair */
  const step = unit === "kg" ? 2.5 : 5;

  /** Empty counts as 0; half-typed text is left alone */
  const commit = (
    field: "weight" | "reps" | "reps_l" | "reps_r",
    text: string,
  ) => {
    if (text === "") {
      onChange({ ...set, [field]: 0 });
      return;
    }
    const value =
      field === "weight"
        ? parseFloat(text.replace(",", "."))
        : parseInt(text, 10);
    if (!Number.isNaN(value) && value !== set[field]) {
      onChange({ ...set, [field]: value });
    }
  };

  const commitDuration = (text: string) => {
    if (text === "") {
      if (set.duration_sec) onChange({ ...set, duration_sec: 0 });
      return;
    }
    const seconds = parseDuration(text);
    if (seconds != null && seconds !== set.duration_sec) {
      onChange({ ...set, duration_sec: seconds });
    }
  };

  const bumpWeight = (delta: number) => {
    const next = Math.max(
      0,
      Math.round(((set.weight ?? 0) + delta) * 100) / 100,
    );
    onChange({ ...set, weight: next });
  };

  const toggleSplit = () => {
    if (isSplit) {
      // Merging keeps the higher side
      const reps = Math.max(set.reps_l ?? 0, set.reps_r ?? 0);
      onChange({ ...set, reps, reps_l: null, reps_r: null });
    } else {
      const reps = set.reps ?? 0;
      onChange({ ...set, reps_l: reps, reps_r: reps });
    }
  };

  return (
    <div
      data-set-row=""
      className={`flex flex-wrap items-center gap-1 rounded-control border-s-2 py-1 ps-1 transition-colors duration-500 motion-reduce:transition-none ${
        isNext ? "border-accent bg-accent/5" : "border-transparent"
      } ${set.warmup ? "text-muted" : ""} ${isDone ? "bg-success/5" : ""}`}
    >
      <div className="flex w-11 shrink-0 justify-center">
        {set.warmup ? (
          <Chip
            text={t("diary.set.warmup")}
            tone="muted"
            title={t("diary.set.warmupLabel")}
          />
        ) : (
          <Menu
            label={t("diary.set.number", { number })}
            items={[
              ...ROUNDS.map((round) => ({
                id: String(round),
                text: t("diary.set.numberItem", { number: round }),
                isChecked: round === number,
                onSelect: () => {
                  // The automatic number again clears the override
                  onChange({ ...set, number: round === setNum ? null : round });
                },
              })),
              ...(set.number != null
                ? [
                    {
                      id: "auto",
                      text: t("diary.set.numberAuto"),
                      hasSeparatorBefore: true,
                      onSelect: () => {
                        onChange({ ...set, number: null });
                      },
                    },
                  ]
                : []),
            ]}
          >
            <Button
              size="sm"
              variant={set.number != null ? "secondary" : "ghost"}
              text={String(number)}
              aria-label={t("diary.set.number", { number })}
              isIconTrailing
            >
              <ChevronDown aria-hidden size={12} />
            </Button>
          </Menu>
        )}
      </div>

      <div className="flex min-w-36 flex-1 items-center gap-0.5">
        <Button
          size="sm"
          aria-label={t("diary.set.decrease")}
          onClick={() => {
            bumpWeight(-step);
          }}
        >
          <Minus aria-hidden size={14} />
        </Button>
        <DraftInput
          className="min-w-14 flex-1"
          label={t("diary.set.weight", { unit, number })}
          value={asText(set.weight)}
          onDraft={(text) => {
            commit("weight", text);
          }}
        />
        <Button
          size="sm"
          aria-label={t("diary.set.increase")}
          onClick={() => {
            bumpWeight(step);
          }}
        >
          <Plus aria-hidden size={14} />
        </Button>
        <span className="shrink-0 text-xs text-muted">
          {loadType === "paired" ? t("diary.set.each", { unit }) : unit}
        </span>
      </div>

      <div className="flex min-w-24 flex-1 items-center gap-1">
        {isSplit ? (
          <>
            <span className="text-xs text-muted">{t("diary.set.left")}</span>
            <DraftInput
              className="min-w-12 flex-1"
              inputMode="numeric"
              label={t("diary.set.repsLeft", { number })}
              value={asText(set.reps_l)}
              onDraft={(text) => {
                commit("reps_l", text);
              }}
            />
            <span className="text-xs text-muted">{t("diary.set.right")}</span>
            <DraftInput
              className="min-w-12 flex-1"
              inputMode="numeric"
              label={t("diary.set.repsRight", { number })}
              value={asText(set.reps_r)}
              onDraft={(text) => {
                commit("reps_r", text);
              }}
            />
          </>
        ) : isTimed ? (
          <DraftInput
            className="min-w-16 flex-1"
            inputMode="numeric"
            placeholder="0:00"
            label={t("diary.set.duration", { number })}
            value={fmtSetDuration(set.duration_sec)}
            mask={maskDurationInput}
            onDraft={commitDuration}
          />
        ) : (
          <DraftInput
            className="min-w-12 flex-1"
            inputMode="numeric"
            label={t("diary.set.reps", { number })}
            value={asText(set.reps)}
            onDraft={(text) => {
              commit("reps", text);
            }}
          />
        )}
        {isTimed && (!isDone || isHoldRunning) && (
          <Button
            size="sm"
            variant={isHoldRunning ? "primary" : "ghost"}
            aria-label={
              isHoldRunning ? t("diary.set.stopHold") : t("diary.set.startHold")
            }
            onClick={isHoldRunning ? onStopHold : onStartHold}
          >
            {isHoldRunning ? (
              <CircleStop aria-hidden size={16} />
            ) : (
              <Timer aria-hidden size={16} />
            )}
          </Button>
        )}
        {!isTimed && loadType === "unilateral" && (
          <Button
            size="sm"
            aria-label={isSplit ? t("diary.set.merge") : t("diary.set.split")}
            aria-pressed={isSplit}
            onClick={toggleSplit}
          >
            {isSplit ? (
              <Link2Off aria-hidden size={14} />
            ) : (
              <Split aria-hidden size={14} />
            )}
          </Button>
        )}
      </div>

      <div className="ms-auto flex items-center gap-0.5">
        {isRecord && <Chip text="PR" tone="accent" title={t("diary.set.pr")} />}
        {hasClip && (
          <Button
            size="sm"
            aria-label={t("diary.set.watch", { number })}
            onClick={onOpenClip}
          >
            <Play aria-hidden size={16} />
          </Button>
        )}
        {hasRpe && !set.warmup && (
          <Menu
            label={t("diary.set.rpe", { number })}
            items={[
              ...RPE_VALUES.map((value) => ({
                id: String(value),
                text: `@${value}`,
                isChecked: set.rpe === value,
                onSelect: () => {
                  onChange({ ...set, rpe: value });
                },
              })),
              ...(set.rpe != null
                ? [
                    {
                      id: "clear",
                      text: t("diary.set.rpeClear"),
                      hasSeparatorBefore: true,
                      onSelect: () => {
                        onChange({ ...set, rpe: null });
                      },
                    },
                  ]
                : []),
            ]}
          >
            <Button
              size="sm"
              variant={set.rpe != null ? "secondary" : "ghost"}
              text={set.rpe != null ? `@${set.rpe}` : t("diary.set.rpeShort")}
              aria-label={t("diary.set.rpe", { number })}
            />
          </Menu>
        )}
        <Button
          size="sm"
          variant={isDone ? "primary" : "secondary"}
          aria-pressed={isDone}
          aria-label={
            isDone
              ? t("diary.set.incomplete", { number })
              : t("diary.set.complete", { number })
          }
          onClick={() => {
            if (!isDone) vibrate(12);
            onChange({ ...set, completed: !isDone });
          }}
        >
          {isDone ? (
            <CircleCheck aria-hidden size={18} />
          ) : (
            <Circle aria-hidden size={18} />
          )}
        </Button>
        <Button
          size="sm"
          aria-label={t("diary.set.remove", { number })}
          onClick={onRemove}
        >
          <X aria-hidden size={14} />
        </Button>
      </div>
    </div>
  );
}
