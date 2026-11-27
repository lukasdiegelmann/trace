import {
  ActionList,
  Banner,
  Button,
  Chip,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../api";
import { NutritionFactsBox } from "../components/NutritionFacts";
import { servingDescription } from "../lib/nutritionFacts";
import { offNutritionStatus } from "../lib/sources/offStatus";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { entryName, type Entry } from "./entries";

export type FoodDetailEntry = Extract<Entry, { kind: "food" | "external" }>;

/** One food at a glance: picture, facts, add to the diary, edit, delete */
export function FoodDetail({
  entry,
  isInPane,
  onAdd,
  onEdit,
  onDelete,
}: {
  entry: FoodDetailEntry;
  isInPane?: boolean;
  onAdd: (meal: number) => void;
  onEdit: () => void;
  /** Left out for what isn't saved (or isn't the user's) */
  onDelete?: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const [isChoosingMeal, setIsChoosingMeal] = useState(false);
  const food = entry.kind === "food" ? entry.row : entry.food;
  const image = assetUrl(
    entry.kind === "food" ? entry.row.img_url : entry.food.imgUrl,
  );
  const isLoadingProduct =
    entry.kind === "external" &&
    entry.food.source === "off" &&
    entry.food.barcode !== "" &&
    entry.food.offInfo?.isFull === false &&
    offNutritionStatus(entry.food) !== "ok";
  const status =
    entry.kind === "external" && entry.food.source === "off"
      ? offNutritionStatus(entry.food)
      : "ok";
  const kcal = food.nutrition.calories;

  return (
    <Stack gap={3}>
      {image && (
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-56 w-full rounded-container object-contain"
        />
      )}
      <div
        className={
          isInPane
            ? "flex flex-col gap-3"
            : "grid gap-3 md:grid-cols-2 md:items-start"
        }
      >
        <Stack gap={2}>
          {isInPane && (
            <Text variant="heading" as="h2">
              {entryName(entry)}
            </Text>
          )}
          {food.brand && <Text tone="muted">{food.brand}</Text>}
          <Row gap={2} shouldWrap>
            {status === "ok" && kcal != null && (
              <Chip tone="accent" text={format.energy(kcal)} />
            )}
            {food.barcode && (
              <Chip text={t("foods.detail.barcode", { code: food.barcode })} />
            )}
          </Row>
          {entry.kind === "food" && entry.row.notes && (
            <Text variant="small" shouldKeepLineBreaks>
              {entry.row.notes}
            </Text>
          )}
        </Stack>
        {isLoadingProduct ? (
          <Spinner label={t("common.loading")} />
        ) : status === "ok" ? (
          <NutritionFactsBox
            nutrition={food.nutrition}
            serving={servingDescription(food)}
          />
        ) : (
          <Banner text={t(`foods.detail.offNotice.${status}`)} />
        )}
      </div>
      <Button
        variant="primary"
        size="lg"
        isFullWidth
        text={t("foods.detail.addToDiary")}
        isDisabled={status !== "ok" || isLoadingProduct}
        aria-expanded={isChoosingMeal}
        onClick={() => {
          setIsChoosingMeal(!isChoosingMeal);
        }}
      >
        <Plus aria-hidden size={16} />
      </Button>
      {isChoosingMeal && (
        <ActionList
          label={t("foods.detail.chooseMeal")}
          items={settings.mealNames.map((name, index) => ({
            id: String(index),
            text: format.mealName(name),
            onSelect: () => {
              setIsChoosingMeal(false);
              onAdd(index);
            },
          }))}
        />
      )}
      <Row gap={2}>
        <Button
          variant="secondary"
          size="md"
          text={t("common.edit")}
          onClick={onEdit}
        >
          <Pencil aria-hidden size={14} />
        </Button>
        {onDelete && (
          <Button
            variant="danger"
            size="md"
            text={t("common.delete")}
            onClick={onDelete}
          >
            <Trash2 aria-hidden size={14} />
          </Button>
        )}
      </Row>
    </Stack>
  );
}
