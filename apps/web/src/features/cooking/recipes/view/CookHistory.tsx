import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { relativeTime, shortDate } from "../../lib/relativeTime";
import type { Cook } from "../../recipesApi";

import { PhotoStrip } from "./PhotoLightbox";

export interface CookHistoryProps {
  cooks: Cook[];
  /** Only the recipe's owner may change entries; without it none can */
  onEdit?: (cook: Cook) => void;
  onDelete?: (cook: Cook) => void;
}

export function CookHistory({ cooks, onEdit, onDelete }: CookHistoryProps) {
  const { t, i18n } = useTranslation("cooking");
  if (cooks.length === 0) return null;
  return (
    <Stack gap={3} as="section" className="print:hidden">
      <Text variant="heading" as="h2">
        {t("recipeView.history")}
      </Text>
      <Stack gap={3} as="ul">
        {cooks.map((cook) => {
          const by = cook.cooked_by_full_name || cook.cooked_by_username;
          return (
            <li
              key={cook.id}
              className="flex flex-col gap-2 rounded-container border border-border bg-level-1 p-3"
            >
              <PhotoStrip
                photos={
                  cook.photos?.length
                    ? cook.photos
                    : cook.photo_url
                      ? [cook.photo_url]
                      : []
                }
              />
              <Row justify="between" align="center" gap={2} shouldWrap>
                <Stack gap={0}>
                  <Text>
                    {shortDate(cook.date, i18n.language)} ·{" "}
                    {relativeTime(cook.date, i18n.language)}
                  </Text>
                  {by ? (
                    <Text variant="caption" tone="muted">
                      {t("recipeView.cookedBy", { name: by })}
                    </Text>
                  ) : null}
                </Stack>
                {onEdit && onDelete ? (
                  <Row gap={1}>
                    <Button
                      variant="ghost"
                      size="sm"
                      text={t("cookingCommon.edit")}
                      onClick={() => {
                        onEdit(cook);
                      }}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      text={t("cookingCommon.delete")}
                      onClick={() => {
                        onDelete(cook);
                      }}
                    />
                  </Row>
                ) : null}
              </Row>
              {cook.notes ? (
                <Text shouldKeepLineBreaks>{cook.notes}</Text>
              ) : null}
            </li>
          );
        })}
      </Stack>
    </Stack>
  );
}
