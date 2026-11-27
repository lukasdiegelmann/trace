import { Pressable, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { CookEntry } from "../diaryApi";
import { asMealType, type MonthCell } from "../lib/cookDiary";
import { shortDate, toDate } from "../lib/relativeTime";
import { MealIcon } from "./mealIcons";

/** Six weeks; each cook is a pill that opens its recipe */
export function MonthView({
  cells,
  onOpen,
}: {
  cells: readonly MonthCell[];
  onOpen: (entry: CookEntry) => void;
}) {
  const { t, i18n } = useTranslation("cooking");
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-container border border-border bg-border">
      {cells.slice(0, 7).map((cell) => (
        <div key={cell.date} className="bg-level-1 p-1 text-center">
          <Text as="span" variant="caption" tone="muted">
            {toDate(cell.date).toLocaleDateString(i18n.language, {
              weekday: "short",
            })}
          </Text>
        </div>
      ))}
      {cells.map((cell) => (
        <div
          key={cell.date}
          role="group"
          aria-label={shortDate(cell.date, i18n.language)}
          aria-current={cell.isToday ? "date" : undefined}
          className={`flex min-h-20 min-w-0 flex-col gap-1 p-1 ${cell.isInMonth ? "bg-level-2" : "bg-level-0 opacity-60"} ${cell.isToday ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
        >
          <Text as="span" variant="caption">
            {cell.day}
          </Text>
          {cell.entries.map((entry) => {
            const meal = asMealType(entry.meal_type);
            const name = entry.recipe_name || t("diary.recipeFallback");
            const label = meal ? `${t(`diary.meals.${meal}`)} · ${name}` : name;
            return (
              <Pressable
                key={entry.id}
                label={label}
                title={label}
                isDisabled={entry.recipe_id === null}
                onPress={() => {
                  onOpen(entry);
                }}
                className={`flex w-full min-w-0 flex-row items-center justify-start gap-1 rounded-xs px-1 text-start ${entry.kind === "planned" ? "border! border-dashed! border-accent!" : "bg-accent/20!"}`}
              >
                {meal ? <MealIcon meal={meal} size={11} /> : null}
                <Text as="span" variant="caption" isTruncated>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </div>
      ))}
    </div>
  );
}
