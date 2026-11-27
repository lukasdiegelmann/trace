import {
  Button,
  Dialog,
  Disclosure,
  Meter,
  Row,
  Stack,
  Stat,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { localDateStr } from "../../lib/insights/dates";
import {
  fastingDays,
  fastingStats,
  formatFastDuration,
  isFastGoalMet,
  type Fast,
} from "../../lib/insights/fasting";
import { deleteFast, getFasting } from "../api";
import { SectionCard } from "../components/Panel";
import { useAsync } from "../useAsync";
import { useInsightsT } from "../useInsightsT";

/** The chart's smallest full scale, in hours */
const MIN_SCALE_HOURS = 16;

export function FastingCard() {
  const { t, locale } = useInsightsT();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [removing, setRemoving] = useState<Fast | null>(null);
  const load = useCallback(
    async () => ({ ...(await getFasting()), version, now: new Date() }),
    [version],
  );
  const { data } = useAsync(load);
  if (!data) return null;

  const { history, active, now } = data;
  const stats = fastingStats(history, active, now);
  const days = fastingDays(history, active, now);
  const scale = Math.max(MIN_SCALE_HOURS, ...days.map((d) => d.hours));
  const finished = history.filter((f) => f.end_at).slice(0, 20);
  const dayOf = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
  const hours = (n: number) => `${n.toLocaleString(locale)} h`;

  async function remove(fast: Fast) {
    try {
      await deleteFast(fast.id);
      setVersion((v) => v + 1);
    } catch (error) {
      toast.error(
        t("fasting.removeFailed", { message: (error as Error).message }),
      );
    }
    setRemoving(null);
  }

  return (
    <SectionCard title={t("fasting.title")}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("fasting.average")} value={hours(stats.avg_hours)} />
        <Stat label={t("fasting.longest")} value={hours(stats.longest_hours)} />
        <Stat
          label={t("fasting.currentStreak")}
          value={t("fasting.days", { count: stats.current_streak })}
        />
        <Stat
          label={t("fasting.longestStreak")}
          value={t("fasting.days", { count: stats.longest_streak })}
        />
      </div>
      {/* TODO(monolithium): a bar chart; a Meter per day until then. */}
      <div role="group" aria-label={t("fasting.lastDays")}>
        <Stack gap={1}>
          {days.map((day) => (
            <Meter
              key={day.day}
              size="sm"
              label={new Date(`${day.day}T12:00:00`).toLocaleDateString(
                locale,
                { weekday: "short", day: "numeric", month: "short" },
              )}
              value={day.hours}
              max={scale}
              valueText={day.hours > 0 ? `${day.hours.toFixed(1)} h` : "—"}
            />
          ))}
        </Stack>
      </div>
      <Text variant="caption">
        {t("fasting.caption", { count: stats.count })}
      </Text>

      {finished.length ? (
        <Disclosure title={t("fasting.recent")} count={finished.length}>
          <ul>
            {finished.map((fast) => (
              <li
                key={fast.id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <Row gap={3} align="center" shouldWrap>
                  <Text as="span" variant="small">
                    {dayOf(fast.start_at)}
                  </Text>
                  <Text as="span" variant="mono">
                    {formatFastDuration(fast)}
                  </Text>
                  <Text
                    as="span"
                    variant="caption"
                    tone={isFastGoalMet(fast) ? "success" : "muted"}
                  >
                    {`${t("fasting.goal", { hours: fast.goal_hours ?? 16 })}${isFastGoalMet(fast) ? " ✓" : ""}`}
                  </Text>
                </Row>
                <Button
                  size="sm"
                  aria-label={t("fasting.remove", {
                    date: localDateStr(new Date(fast.start_at)),
                  })}
                  onClick={() => {
                    setRemoving(fast);
                  }}
                >
                  <X aria-hidden size={16} />
                </Button>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      <Dialog
        open={removing !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoving(null);
        }}
        title={t("fasting.removeTitle")}
        description={
          removing
            ? t("fasting.removeText", {
                duration: formatFastDuration(removing),
                date: dayOf(removing.start_at),
              })
            : undefined
        }
        variant="danger"
        confirmText={t("common.remove")}
        cancelText={t("common.cancel")}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </SectionCard>
  );
}
