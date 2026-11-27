import {
  Disclosure,
  Pressable,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CircleCheck } from "lucide-react";
import { useState } from "react";

import { formatDay, parseDay } from "../../lib/insights/dates";
import {
  groupByMonth,
  hasValue,
  LONG_RANGE_ROWS,
  type DayValue,
} from "../../lib/insights/statistics";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";

export interface HistoryListProps {
  rows: DayValue[];
  unit: string;
  dateFormat: string;
  completedDays: Set<string> | null;
  /** Wellness metrics open their day in Wellness, the others in the diary */
  isWellness: boolean;
  onOpenDay: (date: string) => void;
}

/** The logged days, newest first; by month above 60 days */
export function HistoryList(props: HistoryListProps) {
  const { t, locale } = useInsightsT();
  // What the user opened or closed; the newest month starts open
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const renderRow = (row: { date: string; val: number }) => {
    const day = formatDay(row.date, props.dateFormat, locale);
    const isCompleted = props.completedDays?.has(row.date) ?? false;
    return (
      <li key={row.date}>
        <Pressable
          label={t(
            props.isWellness
              ? "statistics.history.openWellness"
              : "statistics.history.openDiary",
            { date: day },
          )}
          onPress={() => {
            props.onOpenDay(row.date);
          }}
          className="w-full px-1 py-1.5"
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Text as="span" variant="small">
                {day}
              </Text>
              {isCompleted ? (
                <CircleCheck
                  size={14}
                  className="text-success"
                  aria-label={t("statistics.history.completed")}
                />
              ) : null}
            </span>
            <Text as="span" variant="mono" tone="accent">
              {`${row.val.toLocaleString(locale, { maximumFractionDigits: 1 })} ${props.unit}`}
            </Text>
          </span>
        </Pressable>
      </li>
    );
  };

  const months =
    props.rows.length > LONG_RANGE_ROWS ? groupByMonth(props.rows) : null;

  return (
    <SectionCard title={t("statistics.history.title")}>
      {months ? (
        <Stack gap={1}>
          {months.map((month, index) => (
            <Disclosure
              key={month.key}
              title={parseDay(`${month.key}-01`).toLocaleDateString(locale, {
                month: "long",
                year: "numeric",
              })}
              count={month.count}
              isOpen={toggled[month.key] ?? index === 0}
              onOpenChange={(isOpen) => {
                setToggled((current) => ({ ...current, [month.key]: isOpen }));
              }}
            >
              <ul>{month.entries.map(renderRow)}</ul>
            </Disclosure>
          ))}
        </Stack>
      ) : (
        <ul>{props.rows.filter(hasValue).reverse().map(renderRow)}</ul>
      )}
    </SectionCard>
  );
}
