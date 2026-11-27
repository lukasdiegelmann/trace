import { Panel, Stat } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { compactVolume, weekLabel } from "../lib/statistics";
import type { WeekCount, WeekVolume } from "./api";
import { Bars } from "./Bars";

export function VolumeBars({
  weeks,
  isDetailed = false,
}: {
  weeks: WeekVolume[];
  isDetailed?: boolean;
}) {
  const { t } = useTranslation("training");
  const [unit] = useSetting("lt", "weightUnit");
  const first = weeks.at(0);
  if (!first) return null;
  const description = isDetailed
    ? t("statistics.volume.description")
    : undefined;
  if (weeks.length === 1) {
    return (
      <Panel title={t("statistics.volume.weekly")} description={description}>
        <Stat
          label={t("statistics.thisWeek")}
          value={`${compactVolume(first.volume)} ${unit}`}
          hint={isDetailed ? t("statistics.oneWeekHint") : undefined}
        />
      </Panel>
    );
  }
  const total = weeks.reduce((sum, w) => sum + w.volume, 0);
  const peak = Math.max(...weeks.map((w) => w.volume));
  return (
    <Bars
      title={t("statistics.volume.weekly")}
      description={description}
      bars={weeks.map((w) => ({
        id: w.week,
        label: weekLabel(w.week),
        value: w.volume,
        valueText: `${compactVolume(w.volume)} ${unit}`,
      }))}
      footer={
        isDetailed
          ? t("statistics.volume.footer", {
              total: `${compactVolume(total)} ${unit}`,
              peak: `${compactVolume(peak)} ${unit}`,
            })
          : undefined
      }
    />
  );
}

export function FrequencyBars({
  weeks,
  isDetailed = false,
}: {
  weeks: WeekCount[];
  isDetailed?: boolean;
}) {
  const { t, i18n } = useTranslation("training");
  const [goalSetting] = useSetting("lt", "weeklyWorkoutGoal");
  const goal = goalSetting || 0;
  const first = weeks.at(0);
  if (!first) return null;
  const description = isDetailed
    ? t("statistics.frequency.description")
    : undefined;
  if (weeks.length === 1) {
    return (
      <Panel title={t("statistics.frequency.weekly")} description={description}>
        <Stat
          label={t("statistics.thisWeek")}
          value={String(first.count)}
          hint={isDetailed ? t("statistics.oneWeekHint") : undefined}
        />
      </Panel>
    );
  }
  const average =
    weeks.reduce((sum, w) => sum + w.count, 0) / (weeks.length || 1);
  const footer = [
    goal > 0 ? t("statistics.frequency.goal", { goal }) : "",
    isDetailed
      ? t("statistics.frequency.average", {
          average: new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: 1,
          }).format(average),
        })
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Bars
      title={t("statistics.frequency.weekly")}
      description={description}
      target={goal}
      bars={weeks.map((w) => {
        const isHit = goal > 0 && w.count >= goal;
        return {
          id: w.week,
          label: weekLabel(w.week),
          value: w.count,
          valueText: isHit
            ? t("statistics.frequency.hit", { count: w.count })
            : String(w.count),
          isHighlighted: goal > 0 ? isHit : true,
        };
      })}
      footer={footer || undefined}
    />
  );
}
