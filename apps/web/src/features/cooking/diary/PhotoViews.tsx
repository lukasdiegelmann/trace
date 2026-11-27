import {
  Button,
  Chip,
  Dialog,
  Pressable,
  Row,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronLeft, ChevronRight, Images, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { CookEntry } from "../diaryApi";
import { assetUrl } from "../lib/assetUrl";
import { asMealType, entryPhotos, type PhotoTile } from "../lib/cookDiary";
import { relativeTime, shortDate, toDate } from "../lib/relativeTime";
import { MealIcon } from "./mealIcons";
import { Stars } from "./Stars";

export function PhotoGrid({
  tiles,
  onOpen,
}: {
  tiles: readonly PhotoTile[];
  onOpen: (tile: PhotoTile) => void;
}) {
  const { t, i18n } = useTranslation("cooking");
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
      {tiles.map((tile) => {
        const name = tile.entry.recipe_name || t("diary.recipeFallback");
        const date = shortDate(tile.entry.date, i18n.language);
        return (
          <Pressable
            key={`${tile.entry.id}:${tile.index}`}
            label={`${name} · ${date}`}
            onPress={() => {
              onOpen(tile);
            }}
            className="relative block aspect-square overflow-hidden rounded-container bg-level-3! text-start"
          >
            <img
              src={assetUrl(tile.url)}
              alt={name}
              loading="lazy"
              className="size-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 flex flex-col bg-bg/75 px-2 py-1">
              <Text as="span" variant="caption" isTruncated>
                {name}
              </Text>
              <Text as="span" variant="caption" tone="muted">
                {date}
              </Text>
            </span>
            <span className="absolute inset-x-1 top-1 flex justify-between">
              {tile.count > 1 ? (
                <Chip
                  icon={<Images aria-hidden size={12} />}
                  text={`${tile.index + 1}/${tile.count}`}
                />
              ) : (
                <span />
              )}
              {tile.entry.rating ? (
                <Chip
                  icon={<Star aria-hidden size={12} />}
                  text={String(tile.entry.rating)}
                />
              ) : null}
            </span>
          </Pressable>
        );
      })}
    </div>
  );
}

/** One cook's photos, large, with its details */
export function Lightbox({
  entry,
  initialIndex,
  onClose,
  onOpenRecipe,
}: {
  entry: CookEntry;
  initialIndex: number;
  onClose: () => void;
  onOpenRecipe: () => void;
}) {
  const { t, i18n } = useTranslation("cooking");
  const photos = entryPhotos(entry);
  const [index, setIndex] = useState(initialIndex);
  const meal = asMealType(entry.meal_type);
  const name = entry.recipe_name || t("diary.recipeFallback");
  const step = (delta: number) => {
    setIndex((current) => (current + delta + photos.length) % photos.length);
  };
  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={name}
      cancelText={t("cookingCommon.close")}
    >
      <div
        className="flex flex-col gap-3"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") step(-1);
          if (event.key === "ArrowRight") step(1);
        }}
      >
        <img
          src={assetUrl(photos[index])}
          alt={name}
          className="max-h-[60dvh] w-full rounded-container object-contain"
        />
        {photos.length > 1 ? (
          <Row gap={3} justify="center" align="center">
            <Button
              size="md"
              variant="secondary"
              aria-label={t("diary.lightbox.previous")}
              onClick={() => {
                step(-1);
              }}
            >
              <ChevronLeft aria-hidden size={18} />
            </Button>
            <Text role="status">
              {index + 1} / {photos.length}
            </Text>
            <Button
              size="md"
              variant="secondary"
              aria-label={t("diary.lightbox.next")}
              onClick={() => {
                step(1);
              }}
            >
              <ChevronRight aria-hidden size={18} />
            </Button>
          </Row>
        ) : null}
        <Row gap={2} align="center" shouldWrap>
          {meal ? (
            <Chip
              icon={<MealIcon meal={meal} size={12} />}
              text={t(`diary.meals.${meal}`)}
            />
          ) : null}
          <Text tone="muted">
            {shortDate(entry.date, i18n.language)} ·{" "}
            {relativeTime(
              entry.date,
              i18n.language,
              toDate(new Date()).getTime(),
            )}
          </Text>
          <Stars rating={entry.rating} />
        </Row>
        {entry.notes ? <Text shouldKeepLineBreaks>{entry.notes}</Text> : null}
        {entry.recipe_id === null ? null : (
          <Button
            size="md"
            variant="secondary"
            text={t("diary.openRecipe")}
            onClick={onOpenRecipe}
          />
        )}
      </div>
    </Dialog>
  );
}
