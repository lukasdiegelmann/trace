import {
  Button,
  ProgressBar,
  Row,
  Stack,
  Stat,
} from "@monocircuit/monolithium/components";
import { Smartphone, SmartphoneCharging } from "lucide-react";
import { useTranslation } from "react-i18next";

import { toggleWakeLock, wakeLock } from "../lib/wakeLock";
import type { SetCount } from "../lib/workout";
import { fmtVolume } from "../lib/workoutSummary";
import { useStore } from "./format";
import { WorkoutTimerButton } from "./WorkoutTimerButton";

export interface SummaryBarProps {
  date: string;
  count: SetCount;
  exercises: number;
  volume: number;
  unit: string;
  minutes: number;
  isCompleted: boolean;
}

/** The session at a glance: sets, exercises, volume, clock, keep-awake */
export function SummaryBar({
  date,
  count,
  exercises,
  volume,
  unit,
  minutes,
  isCompleted,
}: SummaryBarProps) {
  const { t, i18n } = useTranslation("training");
  const wake = useStore(wakeLock);
  return (
    <Stack gap={2} padding={3} radius="lg" surface="surface">
      <ProgressBar
        value={count.total ? count.completed / count.total : 0}
        label={t("diary.summaryBar.progress", {
          done: count.completed,
          total: count.total,
        })}
        className="h-1.5 rounded-full"
      />
      <Row gap={4} align="center" justify="between" shouldWrap>
        <Stat
          label={t("diary.summaryBar.sets")}
          value={`${count.completed}/${count.total}`}
        />
        <Stat
          label={t("diary.summaryBar.exercises")}
          value={String(exercises)}
        />
        {volume > 0 && (
          <Stat
            label={t("diary.summaryBar.volume", { unit })}
            value={fmtVolume(volume, i18n.language)}
          />
        )}
        <Row gap={1} align="center">
          {!isCompleted && <WorkoutTimerButton date={date} minutes={minutes} />}
          <Button
            variant={wake.isWanted ? "secondary" : "ghost"}
            aria-pressed={wake.isWanted}
            aria-label={
              wake.isWanted ? t("diary.wake.on") : t("diary.wake.off")
            }
            onClick={() => void toggleWakeLock()}
          >
            {wake.isActive ? (
              <SmartphoneCharging aria-hidden size={18} />
            ) : (
              <Smartphone aria-hidden size={18} />
            )}
          </Button>
        </Row>
      </Row>
    </Stack>
  );
}
