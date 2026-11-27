import {
  Legend,
  Meter,
  SegmentedControl,
  Stat,
  Text,
} from "@monocircuit/monolithium/components";

import {
  formatClock,
  formatSleepText,
  sleepDebtLevel,
  type Chronotype,
  type ChronotypeId,
  type SleepDebt,
  type SleepStage,
} from "../../lib/insights/wellness";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";

const STAGE_COLORS: Record<SleepStage["id"], string> = {
  deep: "var(--color-accent)",
  rem: "var(--color-incoming)",
  light: "var(--color-success)",
  awake: "var(--color-warning)",
};

export interface SleepStagesCardProps {
  duration: number | null;
  total: number;
  stages: SleepStage[];
}

export function SleepStagesCard({
  duration,
  total,
  stages,
}: SleepStagesCardProps) {
  const { t } = useInsightsT();
  const shown = stages.filter((s) => s.minutes > 0);
  const describe = (stage: SleepStage) =>
    `${t(`wellness.stages.${stage.id}`)} ${formatSleepText(stage.minutes)} · ${Math.round(stage.pct)} %`;
  return (
    <SectionCard
      title={t("wellness.stages.title")}
      actions={
        duration === null ? undefined : (
          <Text variant="heading">{formatSleepText(duration)}</Text>
        )
      }
    >
      {total > 0 ? (
        <>
          <Meter
            size="lg"
            max={total}
            ariaLabel={t("wellness.stages.title")}
            valueText={shown.map(describe).join(", ")}
            segments={shown.map((s) => ({
              value: s.minutes,
              color: STAGE_COLORS[s.id],
            }))}
          />
          <Legend
            items={shown.map((s) => ({
              label: describe(s),
              color: STAGE_COLORS[s.id],
            }))}
          />
        </>
      ) : (
        <Text variant="small" tone="muted">
          {t("wellness.stages.none")}
        </Text>
      )}
    </SectionCard>
  );
}

const DEBT_RANGES = [7, 14, 30] as const;

export interface SleepDebtCardProps {
  debt: SleepDebt;
  range: number;
  onRangeChange: (range: number) => void;
}

export function SleepDebtCard({
  debt,
  range,
  onRangeChange,
}: SleepDebtCardProps) {
  const { t } = useInsightsT();
  const level = sleepDebtLevel(debt.debtMin);
  const short = formatSleepText(debt.debtMin);
  return (
    <SectionCard
      title={t("wellness.debt.title")}
      hint={t("wellness.debt.nights", { count: debt.nights })}
    >
      <Stat
        label={t("wellness.debt.value")}
        value={level === "good" ? t("wellness.debt.onTrack") : short}
        tone={
          level === "good" ? "default" : level === "warn" ? "warning" : "danger"
        }
      />
      <Text variant="small">
        {level === "good"
          ? t("wellness.debt.meeting")
          : `${t("wellness.debt.short", { short, goal: formatSleepText(debt.goalMin), count: debt.nights })} ${t(level === "bad" ? "wellness.debt.adviceBad" : "wellness.debt.adviceWarn")}`}
      </Text>
      <SegmentedControl
        aria-label={t("wellness.debt.rangeLabel")}
        value={range}
        onChange={onRangeChange}
        options={DEBT_RANGES.map((value) => ({
          value,
          label: t("wellness.debt.range", { days: value }),
        }))}
      />
    </SectionCard>
  );
}

const CHRONOTYPE_EMOJI: Record<ChronotypeId, string> = {
  earlyBird: "🌅",
  morning: "☀️",
  intermediate: "⚖️",
  evening: "🌆",
  nightOwl: "🦉",
};

export interface ChronotypeCardProps {
  chronotype: Chronotype;
  timeFormat: string;
}

export function ChronotypeCard({
  chronotype,
  timeFormat,
}: ChronotypeCardProps) {
  const { t } = useInsightsT();
  if (chronotype.type === null) {
    return (
      <SectionCard
        title={`⏳ ${t("wellness.chronotype.building")}`}
        hint={t("wellness.chronotype.collected", {
          nights: chronotype.nights,
          needed: chronotype.needed,
        })}
      >
        <Text variant="small">
          {t("wellness.chronotype.buildingText", {
            needed: chronotype.needed,
          })}
        </Text>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={`${CHRONOTYPE_EMOJI[chronotype.type]} ${t(`wellness.chronotype.types.${chronotype.type}.label`)}`}
      hint={t("wellness.chronotype.midpoint", {
        time: formatClock(chronotype.midpointMin, timeFormat),
        count: chronotype.nights,
      })}
    >
      <Text variant="small">
        {t(`wellness.chronotype.types.${chronotype.type}.text`)}
      </Text>
    </SectionCard>
  );
}
