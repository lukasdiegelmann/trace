import {
  Box,
  Chip,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { Utensils } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RowMenu } from "../common/RowMenu";
import type { CookEntry } from "../diaryApi";
import { assetUrl } from "../lib/assetUrl";
import { asMealType, type DiaryDay } from "../lib/cookDiary";
import { relativeTime, shortDate, toDate } from "../lib/relativeTime";
import { MealIcon } from "./mealIcons";
import { Stars } from "./Stars";

function Entry({
  entry,
  onOpen,
  actions,
}: {
  entry: CookEntry;
  onOpen: () => void;
  actions: MenuItem[];
}) {
  const { t } = useTranslation("cooking");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const meal = asMealType(entry.meal_type);
  const name = entry.recipe_name || t("diary.recipeFallback");
  const cook = entry.cooked_by_full_name || entry.cooked_by_username;
  return (
    <li
      className="flex items-start gap-2"
      onContextMenu={(event) => {
        event.preventDefault();
        setIsMenuOpen(true);
      }}
    >
      <Pressable
        onPress={onOpen}
        isDisabled={entry.recipe_id === null}
        className="flex min-w-0 flex-1 flex-row items-start justify-start gap-3 rounded-control p-1 text-start hover:bg-level-3"
      >
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-control bg-level-3">
          {entry.recipe_img_url ? (
            <img
              src={assetUrl(entry.recipe_img_url)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <Utensils aria-hidden size={20} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Text as="span">
              <strong>{name}</strong>
            </Text>
            {meal ? (
              <Chip
                tone="muted"
                icon={<MealIcon meal={meal} size={12} />}
                text={t(`diary.meals.${meal}`)}
              />
            ) : null}
            {entry.kind === "planned" ? (
              <Chip tone="accent" text={t("diary.planned")} />
            ) : null}
          </span>
          <Stars rating={entry.rating} />
          {cook ? (
            <Text as="span" variant="caption" tone="muted">
              {t("diary.cookedBy", { name: cook })}
            </Text>
          ) : null}
          {entry.notes ? (
            <Text as="span" variant="small" shouldKeepLineBreaks>
              {entry.notes}
            </Text>
          ) : null}
        </span>
      </Pressable>
      <RowMenu
        label={t("cookingCommon.actionsFor", { name })}
        items={actions}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      />
    </li>
  );
}

export function DiaryListView({
  days,
  onOpen,
  actionsFor,
}: {
  days: readonly DiaryDay[];
  onOpen: (entry: CookEntry) => void;
  actionsFor: (entry: CookEntry) => MenuItem[];
}) {
  const { t, i18n } = useTranslation("cooking");
  const now = toDate(new Date());
  return (
    <div className="gap-3 xl:columns-2">
      {days.map((day) => (
        <Box
          key={day.date}
          as="section"
          border="all"
          radius="lg"
          padding={3}
          surface="surface"
          aria-label={shortDate(day.date, i18n.language)}
          className={`mb-3 break-inside-avoid ${day.isUpcoming ? "border-dashed" : ""}`}
        >
          <Stack gap={2}>
            <Row gap={2} align="center" shouldWrap>
              <Text variant="heading" as="h2">
                {shortDate(day.date, i18n.language)}
              </Text>
              <Text as="span" variant="caption" tone="muted">
                {relativeTime(day.date, i18n.language, now.getTime())}
              </Text>
              <Text as="span" variant="caption" tone="muted">
                {t("diary.cookCount", { count: day.entries.length })}
              </Text>
              {day.isUpcoming ? <Chip text={t("diary.planned")} /> : null}
            </Row>
            <Stack gap={2} as="ul">
              {day.entries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  onOpen={() => {
                    onOpen(entry);
                  }}
                  actions={actionsFor(entry)}
                />
              ))}
            </Stack>
          </Stack>
        </Box>
      ))}
    </div>
  );
}
