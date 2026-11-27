import {
  Box,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { HeatmapDay } from "../diaryApi";
import { heatLevel, heatmapTotals, heatmapWeeks } from "../lib/cookDiary";
import { toDate } from "../lib/relativeTime";

/** Today's week is the last column: show it first */
const scrollToEnd = (node: HTMLDivElement | null) => {
  if (node) node.scrollLeft = node.scrollWidth;
};

const LEVELS = [
  "bg-fg/10",
  "bg-accent/30",
  "bg-accent/50",
  "bg-accent/75",
  "bg-accent",
] as const;

/**
 * Cooks per day over the last year, one column per week (CookHeatmap).
 * TODO(monolithium): a calendar heatmap
 */
export function Heatmap({
  data,
  onSelect,
}: {
  data: readonly HeatmapDay[];
  onSelect: (date: string) => void;
}) {
  const { t, i18n } = useTranslation("cooking");
  const weeks = heatmapWeeks(data, new Date());
  const { total, activeDays } = heatmapTotals(data);
  const dayName = (date: string) =>
    toDate(date).toLocaleDateString(i18n.language, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return (
    <Box
      as="section"
      border="all"
      radius="lg"
      padding={3}
      aria-label={t("diary.heatmap.title")}
      className="min-w-0"
    >
      <Stack gap={2}>
        <Row justify="between" gap={2} shouldWrap>
          <Text variant="label">{t("diary.heatmap.title")}</Text>
          <Text variant="caption" tone="muted">
            {t("diary.heatmap.cooks", { count: total })} ·{" "}
            {t("diary.heatmap.activeDays", { count: activeDays })}
          </Text>
        </Row>
        <div ref={scrollToEnd} className="overflow-x-auto">
          <div className="flex w-max gap-0.5 pb-1">
            {weeks.map((week) => (
              <div
                key={week.days[0].date}
                className="flex w-3 flex-col gap-0.5"
              >
                <span className="h-4 overflow-visible whitespace-nowrap">
                  {week.monthStart ? (
                    <Text as="span" variant="caption" tone="muted">
                      {toDate(week.monthStart).toLocaleDateString(
                        i18n.language,
                        { month: "short" },
                      )}
                    </Text>
                  ) : null}
                </span>
                {week.days.map((day) => {
                  if (day.isFuture) {
                    return <span key={day.date} className="size-3" />;
                  }
                  const label =
                    day.count === 0
                      ? t("diary.heatmap.none", { date: dayName(day.date) })
                      : t("diary.heatmap.day", {
                          count: day.count,
                          date: dayName(day.date),
                        });
                  return (
                    <Pressable
                      key={day.date}
                      label={label}
                      title={label}
                      onPress={() => {
                        onSelect(day.date);
                      }}
                      className="block size-3 pointer-coarse:min-h-3"
                    >
                      {/* On a child: Pressable's bg-transparent would win */}
                      <span
                        className={`block size-3 rounded-xs ${LEVELS[heatLevel(day.count)]}`}
                      />
                    </Pressable>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <Row gap={1} align="center" justify="end">
          <Text variant="caption" tone="muted">
            {t("diary.heatmap.less")}
          </Text>
          {LEVELS.map((level) => (
            <span key={level} className={`size-3 rounded-xs ${level}`} />
          ))}
          <Text variant="caption" tone="muted">
            {t("diary.heatmap.more")}
          </Text>
        </Row>
      </Stack>
    </Box>
  );
}
