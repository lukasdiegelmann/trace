/**
 * The bars above every page while a clock runs: the rest countdown and the
 * workout pill (old `RestTimer.svelte` and `WorkoutModeBar.svelte`). The
 * shell mounts it once.
 */
import {
  Button,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  Pause,
  Play,
  SkipForward,
  Smartphone,
  SmartphoneCharging,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";

import { configureHoldCues } from "../lib/holdTimer";
import {
  addRestTime,
  configureRestTimer,
  remainingSeconds,
  restTimer,
  resumeRestTimer,
  stopRest,
} from "../lib/restTimer";
import { toggleWakeLock, wakeLock } from "../lib/wakeLock";
import {
  elapsedMs,
  formatTimerMs,
  pauseTimer,
  resetTimer,
  resumeTimer,
  workoutTimer,
} from "../lib/workoutTimer";
import { useNow, useStore } from "./format";
import { getLtSettings, setLtSetting } from "./ltSettings";

const cuePrefs = () => {
  const settings = getLtSettings();
  return {
    hasTone: settings.restAlertTone,
    hasVibration: settings.restAlertVibrate,
    toneId: settings.restAlertToneId,
  };
};

configureHoldCues(cuePrefs);
configureRestTimer({
  getPrefs: () => ({
    ...cuePrefs(),
    isEnabled: getLtSettings().restAlert,
    perExercise: getLtSettings().restPerExercise,
  }),
  rememberRest: (exerciseId, seconds) => {
    setLtSetting("restPerExercise", {
      ...getLtSettings().restPerExercise,
      [exerciseId]: seconds,
    });
  },
  getMessages: () => {
    const t = i18n.getFixedT(null, "training");
    return {
      countdown: (seconds) => t("diary.rest.countdown", { seconds }),
      completeTitle: t("diary.rest.completeTitle"),
      completeBody: (name) =>
        name
          ? t("diary.rest.completeBody", { name })
          : t("diary.rest.completeBodyPlain"),
    };
  },
});

function RestBar() {
  const { t } = useTranslation("training");
  const state = useStore(restTimer);
  const now = useNow(250, state !== null);
  if (!state) return null;
  const remaining = remainingSeconds(state, now);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(Math.floor(remaining % 60)).padStart(2, "0");
  return (
    <Stack
      gap={0}
      surface="raised"
      border="top"
      role="region"
      aria-label={t("diary.rest.label")}
    >
      <ProgressBar
        value={state.total > 0 ? 1 - remaining / state.total : 0}
        label={t("diary.rest.progress")}
        className="h-1"
      />
      <Row gap={3} align="center" justify="between" paddingX={3} paddingY={2}>
        <Stack gap={0} canShrink>
          <Text variant="label">{t("diary.rest.label")}</Text>
          {state.exerciseName && (
            <Text variant="caption" tone="muted" isTruncated>
              {t("diary.rest.next", { name: state.exerciseName })}
            </Text>
          )}
        </Stack>
        <span className="font-data text-2xl tabular-nums">
          {`${minutes}:${seconds}`}
        </span>
        <Row gap={1}>
          <Button
            variant="secondary"
            text={t("diary.rest.add")}
            onClick={() => {
              addRestTime(30);
            }}
          />
          <Button
            aria-label={t("diary.rest.skip")}
            onClick={() => {
              stopRest(false);
            }}
          >
            <SkipForward aria-hidden size={18} />
          </Button>
        </Row>
      </Row>
    </Stack>
  );
}

function WorkoutPill() {
  const { t } = useTranslation("training");
  const navigate = useNavigate();
  const timer = useStore(workoutTimer);
  const wake = useStore(wakeLock);
  const isRunning = !!timer && !timer.paused;
  const now = useNow(90, isRunning);
  if (!timer && !wake.isWanted) return null;
  const time = timer ? formatTimerMs(elapsedMs(timer, now)) : "";
  return (
    // TODO(monolithium): a floating toolbar pill with a live clock
    <Row gap={1} justify="center" paddingY={1}>
      {timer && (
        <>
          <Button
            size="sm"
            variant="secondary"
            aria-label={
              isRunning ? t("diary.timer.pause") : t("diary.timer.resume")
            }
            onClick={() => {
              if (isRunning) pauseTimer();
              else resumeTimer();
            }}
          >
            {isRunning ? (
              <Pause aria-hidden size={16} />
            ) : (
              <Play aria-hidden size={16} />
            )}
          </Button>
          <Button
            size="sm"
            text={time}
            aria-label={`${t("diary.timer.open")} (${time})`}
            className="font-data tabular-nums"
            onClick={() => {
              void navigate(`/training?date=${timer.date}`);
            }}
          />
          <Button
            size="sm"
            aria-label={t("diary.timer.dismiss")}
            onClick={resetTimer}
          >
            <X aria-hidden size={16} />
          </Button>
        </>
      )}
      <Button
        size="sm"
        aria-pressed={wake.isWanted}
        aria-label={wake.isWanted ? t("diary.wake.on") : t("diary.wake.off")}
        onClick={() => void toggleWakeLock()}
      >
        {wake.isActive ? (
          <SmartphoneCharging aria-hidden size={16} />
        ) : (
          <Smartphone aria-hidden size={16} />
        )}
      </Button>
    </Row>
  );
}

export function TrainingTimerBars() {
  const rest = useStore(restTimer);
  const timer = useStore(workoutTimer);
  useEffect(() => resumeRestTimer(), []);
  // The cues read the settings: have them before a rest ends
  useEffect(() => {
    if (rest || timer) void settingsStores.lt.ensureLoaded();
  }, [rest, timer]);
  return (
    <>
      <WorkoutPill />
      <RestBar />
    </>
  );
}
