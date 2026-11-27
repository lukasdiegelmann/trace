import {
  Box,
  Button,
  Chip,
  KeyValue,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  CalendarClock,
  CalendarX,
  ChevronRight,
  CircleCheck,
  Minus,
  Plus,
  ScanBarcode,
  ShoppingCart,
  Utensils,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { CategoryIcon } from "../common/CategoryIcon";
import { NutritionFactsBox } from "../common/NutritionFactsBox";
import { useLoad } from "../common/useLoad";
import { assetUrl } from "../lib/assetUrl";
import {
  earliestVariantExpiry,
  expiryStatus,
  type ExpiryStatus,
} from "../lib/expiry";
import { hasNutritionValues } from "../lib/nutriments";
import { displayVariantName, isItemInStock } from "../lib/pantryVariants";
import { shortDate } from "../lib/relativeTime";
import { pantryApi, type PantryCategory, type PantryItem } from "../pantryApi";

/** "Used in" a recipe, loaded on its own so the item shows at once */
function UsedIn({ itemId }: { itemId: number }) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const load = useCallback(() => pantryApi.recipes(itemId), [itemId]);
  const { data, error } = useLoad(load);
  if (error) return null;
  return (
    <Stack gap={2} as="section">
      <Text variant="heading" as="h3">
        {data
          ? t("pantryItem.usedIn.titleCount", { count: data.length })
          : t("pantryItem.usedIn.title")}
      </Text>
      {data?.length === 0 ? (
        <Text tone="muted">{t("pantryItem.usedIn.none")}</Text>
      ) : null}
      {data?.map((recipe) => (
        <Pressable
          key={recipe.id}
          onPress={() => void navigate(`/cooking/recipes/${recipe.id}`)}
          className="flex w-full flex-row items-center gap-3 rounded-control bg-level-2! p-2 text-start hover:bg-level-3!"
        >
          {recipe.img_url ? (
            <img
              src={assetUrl(recipe.img_url)}
              alt=""
              loading="lazy"
              className="size-10 rounded-control object-cover"
            />
          ) : (
            <span className="flex size-10 items-center justify-center">
              <Utensils aria-hidden size={18} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <Text as="span" isTruncated>
              {recipe.name}
            </Text>
          </span>
          <ChevronRight aria-hidden size={16} />
        </Pressable>
      ))}
    </Stack>
  );
}

function ExpiryLine({ status, text }: { status: ExpiryStatus; text: string }) {
  const Icon = status === "past" ? CalendarX : CalendarClock;
  return (
    <Row gap={2} align="center">
      <Icon aria-hidden size={16} />
      <Text
        tone={
          status === "past" ? "danger" : status === "warn" ? "warning" : "muted"
        }
      >
        {text}
      </Text>
    </Row>
  );
}

export interface PantryItemViewProps {
  item: PantryItem;
  category: PantryCategory | null;
  /** Non-empty for a generic */
  variants: readonly PantryItem[];
  onToggleStock: () => void;
  onBumpQuantity: (delta: number) => void;
  isBusy: boolean;
}

/** The read view (PantryItemSheet view mode and PantryView) */
export function PantryItemView({
  item,
  category,
  variants,
  onToggleStock,
  onBumpQuantity,
  isBusy,
}: PantryItemViewProps) {
  const { t, i18n } = useTranslation("cooking");
  const isInStock = isItemInStock(item);
  const earliest = variants.length > 0 ? earliestVariantExpiry(variants) : null;
  const quantity = item.quantity ?? 0;
  const serving = item.serving_size
    ? `${item.serving_size} ${item.serving_unit || "g"}${item.serving_label ? ` (${item.serving_label})` : ""}`
    : (item.serving_label ?? "");
  const expired = (status: ExpiryStatus) =>
    status === "past" ? ` (${t("pantryItem.alreadyExpired")})` : "";

  return (
    <Stack gap={4}>
      <Row gap={4} align="start" shouldWrap>
        <Box
          radius="lg"
          surface="raised"
          isClipped
          className="flex aspect-square w-48 max-w-full items-center justify-center"
        >
          {item.img_url ? (
            <img
              src={assetUrl(item.img_url)}
              alt={item.name}
              className="size-full object-cover"
            />
          ) : (
            <CategoryIcon name={category?.icon} size={56} />
          )}
        </Box>
        <Stack gap={2} className="min-w-0 flex-1">
          {item.brand ? <Text>{item.brand}</Text> : null}
          <Row gap={1} shouldWrap>
            {category ? (
              <Chip
                icon={<CategoryIcon name={category.icon} size={12} />}
                text={category.name}
              />
            ) : null}
            {item.barcode ? (
              <Chip
                tone="muted"
                icon={<ScanBarcode aria-hidden size={12} />}
                text={item.barcode}
              />
            ) : null}
            <Chip
              tone={isInStock ? "accent" : "danger"}
              icon={
                isInStock ? (
                  <CircleCheck aria-hidden size={12} />
                ) : (
                  <ShoppingCart aria-hidden size={12} />
                )
              }
              text={t(
                isInStock ? "pantryItem.inStock" : "pantryItem.outOfStock",
              )}
            />
          </Row>
          <Row gap={2} shouldWrap>
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={isInStock}
              isDisabled={isBusy}
              text={t(
                isInStock ? "pantry.actions.markOut" : "pantry.actions.markIn",
              )}
              onClick={onToggleStock}
            />
          </Row>
          <Row gap={2} align="end" shouldWrap>
            <KeyValue
              layout="stacked"
              label={t("pantryItem.onHand")}
              value={
                item.quantity === null
                  ? "—"
                  : `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
              }
            />
            <Button
              size="sm"
              variant="secondary"
              aria-label={t("pantryItem.decrease")}
              isDisabled={isBusy || quantity <= 0}
              onClick={() => {
                onBumpQuantity(-1);
              }}
            >
              <Minus aria-hidden size={14} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label={t("pantryItem.increase")}
              isDisabled={isBusy}
              onClick={() => {
                onBumpQuantity(1);
              }}
            >
              <Plus aria-hidden size={14} />
            </Button>
          </Row>
          <KeyValue
            layout="stacked"
            label={t("pantryItem.fields.servingSize")}
            value={serving || t("pantryItem.notSet")}
          />
        </Stack>
      </Row>

      {hasNutritionValues(item.nutrition) ? (
        <NutritionFactsBox
          nutrition={item.nutrition}
          servingDescription={serving}
        />
      ) : null}

      {variants.length > 0 ? (
        earliest?.variant.expires_on ? (
          <ExpiryLine
            status={earliest.status}
            text={`${t("pantryItem.earliestVariant", {
              name: displayVariantName(earliest.variant, item),
              date: shortDate(earliest.variant.expires_on, i18n.language),
            })}${expired(earliest.status)}`}
          />
        ) : null
      ) : item.expires_on ? (
        <ExpiryLine
          status={expiryStatus(item.expires_on)}
          text={`${t("pantry.expiry.on", {
            date: shortDate(item.expires_on, i18n.language),
          })}${expired(expiryStatus(item.expires_on))}`}
        />
      ) : null}

      {item.notes ? (
        <Stack gap={1}>
          <Text variant="label">{t("pantryItem.fields.notes")}</Text>
          <Text shouldKeepLineBreaks>{item.notes}</Text>
        </Stack>
      ) : null}

      <UsedIn itemId={item.id} />
    </Stack>
  );
}
