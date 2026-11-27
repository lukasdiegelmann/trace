import { Stat, Text } from "@monocircuit/monolithium/components";

import {
  readinessInsight,
  scoreTone,
  type Readiness,
  type ReadinessCalibrating,
  type ResilienceCategory,
  type ScoreTone,
} from "../../lib/insights/wellness";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";

const STAT_TONES: Record<ScoreTone, "default" | "warning" | "danger"> = {
  good: "default",
  warn: "warning",
  bad: "danger",
};

export function ReadinessCard({
  readiness,
}: {
  readiness: Readiness | ReadinessCalibrating;
}) {
  const { t, locale } = useInsightsT();
  const title = t("wellness.readiness.title");
  const number = (n: number | null) => n?.toLocaleString(locale) ?? "—";

  if (readiness.isCalibrating) {
    return (
      <SectionCard
        title={title}
        hint={t("wellness.readiness.calibrating", {
          days: readiness.data_days,
          needed: readiness.needed,
        })}
      >
        <Text variant="small">
          {t("wellness.readiness.calibratingText", {
            needed: readiness.needed,
          })}
        </Text>
      </SectionCard>
    );
  }

  const penalties = readiness.activity_penalty + readiness.interaction_penalty;
  const { lead, driver } = readinessInsight(readiness);
  const drivers = [
    { label: t("wellness.readiness.hrv"), score: readiness.hrv_score },
    { label: t("wellness.readiness.restingHr"), score: readiness.rhr_score },
    { label: t("wellness.readiness.sleep"), score: readiness.sleep_score_used },
  ];
  const baseline =
    readiness.rhr_baseline === null
      ? t("wellness.readiness.baseline", {
          hrv: number(readiness.hrv_baseline),
        })
      : t("wellness.readiness.baselineWithRhr", {
          hrv: number(readiness.hrv_baseline),
          rhr: number(readiness.rhr_baseline),
        });
  // The driver's numbers in the language's notation
  const driverValues = Object.fromEntries(
    Object.entries(driver).map(([key, value]) => [
      key,
      typeof value === "number" ? number(value) : value,
    ]),
  );

  return (
    <SectionCard
      title={title}
      hint={`${baseline} · ${t("wellness.readiness.days", { count: readiness.data_days })}`}
    >
      <Stat
        label={t("wellness.readiness.score")}
        value={String(readiness.score)}
        hint={t(`wellness.readiness.bands.${readiness.band}`)}
        tone={STAT_TONES[scoreTone(readiness.score)]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {drivers.map((d) => (
          <Stat
            key={d.label}
            label={d.label}
            value={String(d.score)}
            tone={STAT_TONES[scoreTone(d.score)]}
          />
        ))}
        <Stat
          label={t("wellness.readiness.penalties")}
          value={penalties > 0 ? `−${penalties}` : "—"}
          tone={penalties > 0 ? "danger" : "default"}
        />
      </div>
      <Text variant="small">{t(`wellness.readiness.leads.${lead}`)}</Text>
      <Text variant="small" tone="muted">
        {t(`wellness.readiness.drivers.${driver.kind}`, driverValues)}
      </Text>
      {readiness.data_days < 30 ? (
        <Text variant="caption">
          {t("wellness.readiness.accuracy", { count: readiness.data_days })}
        </Text>
      ) : null}
    </SectionCard>
  );
}

export interface ResilienceCardProps {
  category: ResilienceCategory;
  score: number;
  calmness: number;
  activity: number;
  sleep: number;
}

export function ResilienceCard(props: ResilienceCardProps) {
  const { t } = useInsightsT();
  const parts = [
    { id: "calmness", value: props.calmness, max: 30 },
    { id: "activity", value: props.activity, max: 40 },
    { id: "sleep", value: props.sleep, max: 30 },
  ];
  return (
    <SectionCard
      title={t("wellness.resilience.title")}
      hint={t("wellness.resilience.score", { score: Math.round(props.score) })}
    >
      <Stat
        label={t("wellness.resilience.today")}
        value={t(`wellness.resilience.categories.${props.category}.label`)}
        tone={
          props.category === "optimal"
            ? "default"
            : props.category === "balanced"
              ? "warning"
              : "danger"
        }
      />
      <Text variant="small">
        {t(`wellness.resilience.categories.${props.category}.text`)}
      </Text>
      <div className="grid grid-cols-3 gap-3">
        {parts.map((part) => (
          <Stat
            key={part.id}
            label={t(`wellness.resilience.parts.${part.id}`)}
            value={`${Math.round(part.value)} / ${part.max}`}
          />
        ))}
      </div>
    </SectionCard>
  );
}
