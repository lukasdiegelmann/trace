import {
  Button,
  Panel,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Camera, Scale } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { EmptyNote } from "../common/EmptyNote";
import { formatDay } from "../common/format";
import { type ChartLine, LineChart } from "../common/LineChart";
import { ToggleChips } from "../common/ToggleChips";
import {
  datedLine,
  dayDomain,
  type Measurement,
  measurementSeries,
  measurementUnit,
  OVERLAY_MEASUREMENTS,
  weightSummary,
} from "../lib/statistics";
import { StatCards } from "./StatCards";
import type { ViewProps } from "./viewProps";

/** Body weight over time, with one measurement laid over it */
export function WeightView({ data }: ViewProps) {
  const { t, i18n } = useTranslation("training");
  const navigate = useNavigate();
  const [unit] = useSetting("lt", "weightUnit");
  const [visible] = useSetting("lt", "bodyStatsVisible");
  const [picked, setPicked] = useState<Measurement | null>(null);

  const photos = (
    <Button
      variant="secondary"
      isFullWidth
      text={t("statistics.weight.photos")}
      onClick={() => void navigate("/training/progress")}
    >
      <Camera aria-hidden size={16} />
    </Button>
  );
  const rows = data.bodyStats;
  if (!rows) return photos;
  const weights = measurementSeries(rows, "weight");
  const summary = weightSummary(weights);
  if (!summary) {
    return (
      <Stack gap={3}>
        {photos}
        <EmptyNote
          icon={<Scale aria-hidden />}
          text={t("statistics.weight.empty")}
        />
      </Stack>
    );
  }

  const choices = OVERLAY_MEASUREMENTS.filter(
    (key) => visible.includes(key) && measurementSeries(rows, key).length > 0,
  );
  const overlay = picked && choices.includes(picked) ? picked : null;
  const overlaySeries = overlay ? measurementSeries(rows, overlay) : [];
  const domain = dayDomain(weights, overlaySeries);
  const number = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  });
  const withUnit = (value: number) => `${number.format(value)} ${unit}`;

  const lines: ChartLine[] = [
    {
      label: t("statistics.weight.line", { unit }),
      ...datedLine(weights),
      format: withUnit,
    },
  ];
  if (overlay && overlaySeries.length > 1) {
    const overlayUnit = measurementUnit(overlay, unit);
    lines.push({
      label: `${t(`statistics.measurements.${overlay}`)} (${overlayUnit})`,
      ...datedLine(overlaySeries),
      format: (value) => `${number.format(value)} ${overlayUnit}`,
    });
  }
  const dates = [...weights, ...overlaySeries].map((p) => p.date).sort();

  return (
    <Stack gap={3}>
      {photos}
      <StatCards
        cards={[
          {
            label: t("statistics.weight.current"),
            value: withUnit(summary.current),
          },
          { label: t("statistics.min"), value: withUnit(summary.min) },
          { label: t("statistics.max"), value: withUnit(summary.max) },
          {
            label: t("statistics.weight.change"),
            value: `${summary.change > 0 ? "+" : ""}${number.format(summary.change)} ${unit}`,
          },
        ]}
      />
      <Panel title={t("statistics.weight.trend")}>
        <Stack gap={3}>
          {choices.length > 0 && (
            <ToggleChips
              label={t("statistics.weight.overlay")}
              options={[
                { value: "", label: t("statistics.weight.none") },
                ...choices.map((key) => ({
                  value: key,
                  label: t(`statistics.measurements.${key}`),
                })),
              ]}
              selected={[overlay ?? ""]}
              onToggle={(value) => {
                setPicked((value || null) as Measurement | null);
              }}
            />
          )}
          {domain && (
            <LineChart
              ariaLabel={t("statistics.weight.trend")}
              lines={lines}
              from={domain.from}
              until={domain.until}
              start={formatDay(dates[0] ?? "", i18n.language)}
              end={formatDay(dates.at(-1) ?? "", i18n.language)}
            />
          )}
        </Stack>
      </Panel>
      <Panel title={t("statistics.weight.history")}>
        <ul className="flex flex-col gap-2">
          {[...weights].reverse().map((entry) => (
            <li key={entry.date} className="flex justify-between gap-2">
              <Text variant="small" tone="muted">
                {formatDay(entry.date, i18n.language)}
              </Text>
              <Text variant="small">{withUnit(entry.value)}</Text>
            </li>
          ))}
        </ul>
      </Panel>
    </Stack>
  );
}
