import {
  Button,
  DatePicker,
  Row,
  SegmentedControl,
  Stack,
} from "@monocircuit/monolithium/components";

import { formatDay, localDateStr } from "../../lib/insights/dates";
import {
  quickRange,
  RANGES,
  type QuickRange,
  type Range,
} from "../../lib/insights/statistics";
import { useInsightsT } from "../useInsightsT";

export interface CustomRange {
  start: string;
  end: string;
}

export interface RangeControlsProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  custom: CustomRange;
  onCustomChange: (custom: CustomRange) => void;
}

const QUICK_RANGES: readonly QuickRange[] = [
  "last7",
  "last30",
  "last90",
  "thisMonth",
  "lastMonth",
  "yearToDate",
];

export function RangeControls({
  range,
  onRangeChange,
  custom,
  onCustomChange,
}: RangeControlsProps) {
  const { t, locale } = useInsightsT();
  const today = localDateStr();
  const format = (day: string) => formatDay(day, "natural", locale);

  return (
    <Stack gap={3}>
      <div className="min-w-0 overflow-x-auto">
        <SegmentedControl<Range>
          aria-label={t("statistics.range.label")}
          value={range}
          onChange={onRangeChange}
          options={[...RANGES, "custom" as const].map((value) => ({
            value,
            label: t(`statistics.range.options.${value}`),
          }))}
        />
      </div>
      {range === "custom" ? (
        <Stack gap={3}>
          <Row gap={1} shouldWrap>
            {QUICK_RANGES.map((pick) => (
              <Button
                key={pick}
                size="sm"
                variant="secondary"
                text={t(`statistics.range.quick.${pick}`)}
                onClick={() => {
                  onCustomChange(quickRange(pick, today));
                }}
              />
            ))}
          </Row>
          <Row gap={3} shouldWrap>
            <DatePicker
              label={t("statistics.range.from")}
              placeholder={t("statistics.range.pickDate")}
              value={custom.start || null}
              maxDate={custom.end || today}
              format={format}
              onChange={(start) => {
                onCustomChange({ ...custom, start: start ?? "" });
              }}
            />
            <DatePicker
              label={t("statistics.range.to")}
              placeholder={t("statistics.range.pickDate")}
              value={custom.end || null}
              minDate={custom.start || undefined}
              maxDate={today}
              format={format}
              onChange={(end) => {
                onCustomChange({ ...custom, end: end ?? "" });
              }}
            />
          </Row>
        </Stack>
      ) : null}
    </Stack>
  );
}
