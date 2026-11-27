import { Button } from "@monocircuit/monolithium/components";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  elapsedMs,
  formatTimerMs,
  pauseTimer,
  resumeTimer,
  startTimer,
  workoutTimer,
} from "../lib/workoutTimer";
import { useNow, useStore } from "./format";

/** Start, pause and resume the workout's clock */
export function WorkoutTimerButton({
  date,
  minutes,
}: {
  date: string;
  /** The duration already logged, continued from */
  minutes: number;
}) {
  const { t } = useTranslation("training");
  const state = useStore(workoutTimer);
  const isActive = state?.date === date;
  const isRunning = isActive && !state.paused;
  const now = useNow(90, isRunning);
  const time = isActive
    ? formatTimerMs(elapsedMs(state, Math.max(now, 0)))
    : formatTimerMs(minutes * 60000, false);
  const label = isRunning
    ? t("diary.timer.pause")
    : isActive
      ? t("diary.timer.resume")
      : t("diary.timer.start");
  return (
    <Button
      variant={isRunning ? "primary" : "secondary"}
      text={time}
      aria-label={`${label} (${time})`}
      className="font-data tabular-nums"
      onClick={() => {
        if (isRunning) pauseTimer();
        else if (isActive) resumeTimer();
        else startTimer(date, minutes);
      }}
    >
      {isRunning ? (
        <Pause aria-hidden size={16} />
      ) : (
        <Play aria-hidden size={16} />
      )}
    </Button>
  );
}
