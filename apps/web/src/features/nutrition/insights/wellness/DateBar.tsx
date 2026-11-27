import { Button, DatePicker, Row } from "@monocircuit/monolithium/components";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { addDays, formatDay, localDateStr } from "../../lib/insights/dates";
import { useInsightsT } from "../useInsightsT";
import { useDayName } from "./useDayName";

export interface DateBarProps {
  date: string;
  dateFormat: string;
  onDateChange: (date: string) => void;
}

export function DateBar({ date, dateFormat, onDateChange }: DateBarProps) {
  const { t, locale } = useInsightsT();
  const dayName = useDayName();
  const today = localDateStr();
  return (
    <Row gap={2} align="center" justify="center">
      <Button
        size="sm"
        variant="secondary"
        aria-label={t("wellness.nav.previousDay")}
        onClick={() => {
          onDateChange(addDays(date, -1));
        }}
      >
        <ChevronLeft aria-hidden size={18} />
      </Button>
      <div className="w-64 max-w-full">
        <DatePicker
          value={date}
          maxDate={today}
          format={(day) =>
            `${dayName(day)} · ${formatDay(day, dateFormat, locale)}`
          }
          onChange={(next) => {
            if (next) onDateChange(next);
          }}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        aria-label={t("wellness.nav.nextDay")}
        isDisabled={date >= today}
        onClick={() => {
          onDateChange(addDays(date, 1));
        }}
      >
        <ChevronRight aria-hidden size={18} />
      </Button>
    </Row>
  );
}
