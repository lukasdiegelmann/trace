/** Volume, frequency and cardio over the range's weeks */
import {
  Chip,
  Panel,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { formatDay } from "../common/format";
import {
  cardioSummary,
  compactVolume,
  mostActiveDay,
  weekLabel,
} from "../lib/statistics";
import { rankOf } from "../lib/statisticsMuscles";
import { Bars } from "./Bars";
import { BodyMap } from "./BodyMap";
import { LEVEL_CLASS_NAMES, mapMuscleLabel } from "./muscleNames";
import { StatCards } from "./StatCards";
import type { ViewProps } from "./viewProps";
import { FrequencyBars, VolumeBars } from "./WeekCharts";

const SESSION_LIMIT = 100;

export function VolumeView({ data }: ViewProps) {
  const { t, i18n } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");
  const weeks = data.volume;
  const load = data.muscleLoad ?? {};
  const { worked, missed } = rankOf(load);
  const total = weeks?.reduce((sum, w) => sum + w.volume, 0) ?? 0;
  const peak = weeks?.length ? Math.max(...weeks.map((w) => w.volume)) : 0;
  const sets = worked.reduce((sum, muscle) => sum + (load[muscle] ?? 0), 0);
  return (
    <Stack gap={3}>
      {weeks?.length === 0 ? (
        <EmptyNote text={t("statistics.volume.empty")} />
      ) : (
        weeks && (
          <>
            <StatCards
              cards={[
                {
                  label: t("statistics.volume.total"),
                  value: `${compactVolume(total)} ${unit}`,
                },
                {
                  label: t("statistics.volume.peak"),
                  value: `${compactVolume(peak)} ${unit}`,
                },
                {
                  label: t("statistics.perWeek"),
                  value: `${compactVolume(total / weeks.length)} ${unit}`,
                },
                {
                  label: t("statistics.weeksLabel"),
                  value: String(weeks.length),
                },
              ]}
            />
            <VolumeBars weeks={weeks} />
          </>
        )
      )}
      {worked.length > 0 && (
        <Panel
          title={t("statistics.balance.title")}
          description={t("statistics.balance.description")}
        >
          <Stack gap={3}>
            <BodyMap load={load} />
            <Row gap={1} align="center" justify="center">
              <Text variant="caption" tone="muted">
                {t("statistics.balance.less")}
              </Text>
              <svg aria-hidden viewBox="0 0 70 12" className="h-3 w-20">
                {LEVEL_CLASS_NAMES.map((className, index) => (
                  <rect
                    key={className}
                    x={index * 14}
                    width="12"
                    height="12"
                    rx="2"
                    className={className}
                  />
                ))}
              </svg>
              <Text variant="caption" tone="muted">
                {t("statistics.balance.more")}
              </Text>
            </Row>
            {missed.length > 0 && (
              <Stack gap={2}>
                <Text variant="label">{t("statistics.balance.missed")}</Text>
                <Row gap={1} className="flex-wrap">
                  {missed.map((muscle) => (
                    <Chip
                      key={muscle}
                      tone="muted"
                      text={mapMuscleLabel(t, muscle)}
                    />
                  ))}
                </Row>
              </Stack>
            )}
            <Text variant="caption" tone="muted">
              {t("statistics.balance.summary", {
                sets: new Intl.NumberFormat(i18n.language, {
                  maximumFractionDigits: 1,
                }).format(sets),
                count: worked.length,
              })}
            </Text>
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}

export function FrequencyView({ data }: ViewProps) {
  const { t, i18n } = useTranslation("training");
  const weeks = data.frequency;
  if (!weeks) return null;
  const total = weeks.reduce((sum, w) => sum + w.count, 0);
  if (total === 0) {
    return <EmptyNote text={t("statistics.frequency.empty")} />;
  }
  const number = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  });
  const weekdays = data.weekdays ?? [];
  const busiest = mostActiveDay(weekdays);
  // 2023-01-01 was a Sunday: day n of that week names weekday n.
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(
      new Date(2023, 0, 1 + day, 12),
    );
  return (
    <Stack gap={3}>
      <StatCards
        cards={[
          { label: t("statistics.workoutsLabel"), value: String(total) },
          {
            label: t("statistics.perWeek"),
            value: number.format(total / weeks.length),
          },
          {
            label: t("statistics.frequency.best"),
            value: String(Math.max(...weeks.map((w) => w.count))),
          },
          ...(data.streaks
            ? [
                {
                  label: t("statistics.overview.currentStreak"),
                  value: t("statistics.days", {
                    count: data.streaks.currentStreak,
                  }),
                },
              ]
            : []),
        ]}
      />
      <FrequencyBars weeks={weeks} />
      {busiest !== null && (
        <Bars
          title={t("statistics.frequency.weekdays")}
          bars={weekdays.map((entry) => ({
            id: String(entry.day),
            label: weekday(entry.day),
            value: entry.count,
            valueText: String(entry.count),
          }))}
          footer={t("statistics.frequency.mostActive", {
            day: weekday(busiest),
          })}
        />
      )}
    </Stack>
  );
}

export function CardioView({ data }: ViewProps) {
  const { t, i18n } = useTranslation("training");
  const [goalSetting] = useSetting("lt", "weeklyCardioMinutesGoal");
  const goal = goalSetting || 0;
  const weeks = data.cardioWeeks ?? [];
  const sessions = data.cardioSessions ?? [];
  if (!weeks.length && !sessions.length) {
    return <EmptyNote text={t("statistics.cardio.empty")} />;
  }
  const summary = cardioSummary(weeks, goal);
  const minutes = (value: number) => t("statistics.cardio.minutes", { value });
  return (
    <Stack gap={3}>
      <StatCards
        cards={[
          {
            label: t("statistics.cardio.total"),
            value: minutes(summary.total),
          },
          { label: t("statistics.perWeek"), value: minutes(summary.average) },
          { label: t("statistics.cardio.peak"), value: minutes(summary.peak) },
          ...(goal > 0
            ? [
                {
                  label: t("statistics.cardio.onTarget"),
                  value: `${summary.weeksOnTarget}/${weeks.length}`,
                },
              ]
            : []),
        ]}
      />
      <Bars
        title={t("statistics.cardio.weekly")}
        target={goal}
        bars={weeks.map((w) => ({
          id: w.week,
          label: weekLabel(w.week),
          value: w.minutes,
          valueText: minutes(w.minutes),
          isHighlighted: goal > 0 ? w.minutes >= goal : true,
        }))}
        footer={
          goal > 0
            ? t("statistics.cardio.target", { value: goal })
            : t("statistics.cardio.noTarget")
        }
      />
      <Panel title={t("statistics.sessionsLabel")}>
        <ul className="flex flex-col gap-2">
          {sessions.slice(0, SESSION_LIMIT).map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap justify-between gap-2"
            >
              <Text variant="small">{session.activity}</Text>
              <Text variant="small" tone="muted">
                {[
                  minutes(session.duration_min ?? 0),
                  session.distance
                    ? `${session.distance} ${session.distance_unit || "km"}`
                    : "",
                  session.avg_hr
                    ? t("statistics.cardio.heartRate", {
                        value: session.avg_hr,
                      })
                    : "",
                  formatDay(session.date, i18n.language),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </li>
          ))}
        </ul>
        {sessions.length > SESSION_LIMIT && (
          <Text variant="caption" tone="muted">
            {t("statistics.cardio.more", { count: SESSION_LIMIT })}
          </Text>
        )}
      </Panel>
    </Stack>
  );
}
