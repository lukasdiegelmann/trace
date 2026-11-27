import {
  Button,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CircleStop } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  cancelHold,
  holdTimer,
  resumeHoldTimer,
  skipLeadIn,
  stopHold,
} from "../lib/holdTimer";
import { disableWakeLock, enableWakeLock, wakeLock } from "../lib/wakeLock";
import { fmtSetDuration } from "../lib/workout";
import { useNow, useStore } from "./format";

const clock = (seconds: number) => fmtSetDuration(seconds) || "0:00";

/**
 * The large clock of a running hold (issue #89): the phone is usually on the
 * floor. The screen stays on for the length of the hold.
 */
export function HoldBar({
  date,
  onOpenDate,
}: {
  date: string;
  onOpenDate: (date: string) => void;
}) {
  const { t } = useTranslation("training");
  const hold = useStore(holdTimer);
  const isActive = hold !== null;
  const now = useNow(200, isActive);

  useEffect(() => {
    resumeHoldTimer();
  }, []);

  const tookWakeLock = useRef(false);
  useEffect(() => {
    if (!isActive || wakeLock.get().isWanted) return;
    tookWakeLock.current = true;
    void enableWakeLock();
    return () => {
      // Only given back when this bar took it
      if (tookWakeLock.current) void disableWakeLock();
      tookWakeLock.current = false;
    };
  }, [isActive]);

  if (!hold) return null;
  const lead = Math.max(0, Math.ceil((hold.goAt - now) / 1000));
  const elapsed = lead > 0 ? 0 : Math.floor((now - hold.goAt) / 1000);
  const isPastTarget = hold.targetSec > 0 && elapsed >= hold.targetSec;

  return (
    <Stack
      gap={2}
      padding={4}
      align="center"
      surface="raised"
      radius="lg"
      role="timer"
      className="sticky bottom-2 z-10 border-2 border-accent shadow-lg"
    >
      <Text variant="label">{`${t("diary.hold.label")} · ${hold.exerciseName}`}</Text>
      {lead > 0 ? (
        <>
          <Button
            variant="secondary"
            size="lg"
            text={String(lead)}
            aria-label={t("diary.hold.skipLeadIn")}
            onClick={skipLeadIn}
          />
          <Text variant="caption" tone="muted">
            {t("diary.hold.getReady")}
          </Text>
        </>
      ) : (
        <>
          <span className="font-data text-5xl tabular-nums">
            {clock(elapsed)}
          </span>
          {hold.targetSec > 0 && (
            <Stack gap={1} className="w-full max-w-sm" align="center">
              <ProgressBar
                value={elapsed / hold.targetSec}
                label={t("diary.hold.target", { time: clock(hold.targetSec) })}
                className="h-1.5"
              />
              <Text variant="caption" tone={isPastTarget ? "success" : "muted"}>
                {t(
                  isPastTarget
                    ? "diary.hold.targetReached"
                    : "diary.hold.target",
                  { time: clock(hold.targetSec) },
                )}
              </Text>
            </Stack>
          )}
        </>
      )}
      {hold.date !== date ? (
        <Button
          variant="primary"
          text={t("diary.hold.openDate", { date: hold.date })}
          onClick={() => {
            onOpenDate(hold.date);
          }}
        />
      ) : (
        <Row gap={2}>
          <Button text={t("diary.hold.cancel")} onClick={cancelHold} />
          <Button
            variant="primary"
            size="lg"
            text={t("diary.hold.stop")}
            onClick={() => {
              stopHold();
            }}
          >
            <CircleStop aria-hidden size={20} />
          </Button>
        </Row>
      )}
    </Stack>
  );
}
