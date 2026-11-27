import {
  Button,
  DatePickerCalendar as Calendar,
  Menu,
  Chip,
  Row,
  Sheet,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { addDays, localDateStr, parseLocalDate } from "../lib/dates";
import { numericDate, useDiaryFormats } from "./format";

export interface DateNavProps {
  date: string;
  today: string;
  dateFormat: string;
  streak: number;
  /** Days with a completed set or cardio */
  activeDates: Set<string>;
  /** Days with unread coach feedback */
  unreadDates: Set<string>;
  onSelect: (date: string) => void;
  /** The calendar is opening: refresh its marks */
  onOpenCalendar: () => void;
}

function DayList({
  title,
  days,
  language,
  onSelect,
}: {
  title: string;
  days: string[];
  language: string;
  onSelect: (date: string) => void;
}) {
  const { t } = useTranslation("training");
  if (!days.length) return null;
  return (
    <Stack gap={1}>
      <Text variant="label">{title}</Text>
      <Row gap={1} shouldWrap>
        {days.map((day) => (
          <Button
            key={day}
            size="sm"
            variant="secondary"
            text={String(parseLocalDate(day).getDate())}
            aria-label={t("diary.calendar.openDay", {
              date: parseLocalDate(day).toLocaleDateString(language),
            })}
            onClick={() => {
              onSelect(day);
            }}
          />
        ))}
      </Row>
    </Stack>
  );
}

/** Jumps the calendar to a month or a year, as the old picker's grids did */
function MonthYearJump({
  month,
  today,
  language,
  onChange,
}: {
  /** Any day of the month shown */
  month: string;
  today: string;
  language: string;
  onChange: (month: string) => void;
}) {
  const { t } = useTranslation("training");
  const shown = parseLocalDate(month);
  const year = shown.getFullYear();
  const index = shown.getMonth();
  const monthName = (i: number) =>
    new Date(2026, i, 1).toLocaleDateString(language, { month: "long" });
  const firstYear = parseLocalDate(today).getFullYear() - 10;
  const jump = (y: number, m: number) => {
    onChange(localDateStr(new Date(y, m, 1, 12)));
  };
  return (
    <Row gap={2}>
      <Menu
        label={t("diary.calendar.month")}
        items={Array.from({ length: 12 }, (_, i) => ({
          id: String(i),
          text: monthName(i),
          isChecked: i === index,
          onSelect: () => {
            jump(year, i);
          },
        }))}
      >
        <Button
          size="sm"
          variant="secondary"
          text={monthName(index)}
          aria-label={`${t("diary.calendar.month")}: ${monthName(index)}`}
        />
      </Menu>
      <Menu
        label={t("diary.calendar.year")}
        items={Array.from({ length: 22 }, (_, i) => firstYear + i).map((y) => ({
          id: String(y),
          text: String(y),
          isChecked: y === year,
          onSelect: () => {
            jump(y, index);
          },
        }))}
      >
        <Button
          size="sm"
          variant="secondary"
          text={String(year)}
          aria-label={`${t("diary.calendar.year")}: ${year}`}
        />
      </Menu>
    </Row>
  );
}

/** Previous and next day, the date (opening a calendar), streak, Today */
export function DateNav({
  date,
  today,
  dateFormat,
  streak,
  activeDates,
  unreadDates,
  onSelect,
  onOpenCalendar,
}: DateNavProps) {
  const { t } = useTranslation("training");
  const { dayTitle, language } = useDiaryFormats();
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(date);

  const pick = (day: string) => {
    setIsOpen(false);
    onSelect(day);
  };
  const inMonth = (days: Set<string>) =>
    [...days].filter((day) => day.slice(0, 7) === month.slice(0, 7)).sort();

  return (
    <Row gap={1} align="center" justify="between">
      <Button
        aria-label={t("diary.nav.previousDay")}
        onClick={() => {
          onSelect(addDays(date, -1));
        }}
      >
        <ChevronLeft aria-hidden size={20} />
      </Button>
      <Row gap={2} align="center" justify="center" shouldWrap>
        <Button
          variant="secondary"
          text={`${dayTitle(date, today)} · ${numericDate(date, dateFormat)}`}
          aria-label={`${t("diary.nav.jumpToDate")}: ${dayTitle(date, today)}, ${numericDate(date, dateFormat)}`}
          onClick={() => {
            setMonth(date);
            onOpenCalendar();
            setIsOpen(true);
          }}
        >
          <CalendarDays aria-hidden size={16} />
        </Button>
        {streak >= 2 && (
          <Chip
            text={t("diary.streakShort", { count: streak })}
            title={t("diary.streak", { count: streak })}
            tone="accent"
          />
        )}
        {date !== today && (
          <Button
            size="sm"
            text={t("diary.nav.today")}
            aria-label={t("diary.nav.jumpToToday")}
            onClick={() => {
              onSelect(today);
            }}
          />
        )}
      </Row>
      <Button
        aria-label={t("diary.nav.nextDay")}
        onClick={() => {
          onSelect(addDays(date, 1));
        }}
      >
        <ChevronRight aria-hidden size={20} />
      </Button>

      <Sheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t("diary.calendar.title")}
      >
        <Stack gap={3} align="center">
          {/* TODO(monolithium): day markers in Calendar (trained, unread
              feedback); the lists below stand in for the old dots */}
          <MonthYearJump
            month={month}
            today={today}
            language={language}
            onChange={setMonth}
          />
          <Calendar
            value={date}
            onSelect={pick}
            monthAnchorIso={month}
            onMonthAnchorIsoChange={setMonth}
          />
          <DayList
            title={t("diary.calendar.trained")}
            days={inMonth(activeDates)}
            language={language}
            onSelect={pick}
          />
          <DayList
            title={t("diary.calendar.unread")}
            days={inMonth(unreadDates)}
            language={language}
            onSelect={pick}
          />
        </Stack>
      </Sheet>
    </Row>
  );
}
