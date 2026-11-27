import {
  Box,
  Button,
  Chip,
  Pressable,
  Row,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  Boxes,
  CalendarX,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  Tag,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CategoryIcon } from "../common/CategoryIcon";
import { RowMenu } from "../common/RowMenu";
import { assetUrl } from "../lib/assetUrl";
import { expiryStatus } from "../lib/expiry";
import type { StockAggregate } from "../lib/pantryVariants";
import type { PantryCategory, PantryItem } from "../pantryApi";
import { useExpiryLabel } from "./useExpiryLabel";

export interface PantryCardProps {
  item: PantryItem;
  /** The name to show (a variant under its parent shows its brand) */
  name: string;
  isInStock: boolean;
  /** Set for a generic */
  aggregate: StockAggregate | null;
  /** Shown when the list isn't grouped */
  category: PantryCategory | null;
  categoryIcon: string;
  expiry: string | null;
  variantOf?: string;
  isNested?: boolean;
  isList: boolean;
  /** Null: not selecting; else whether this card is picked */
  isSelected: boolean | null;
  isExpanded?: boolean;
  onOpen: () => void;
  onToggleStock?: () => void;
  onToggleExpand?: () => void;
  actions: MenuItem[];
}

export function PantryCard({
  item,
  name,
  isInStock,
  aggregate,
  category,
  categoryIcon,
  expiry,
  variantOf,
  isNested = false,
  isList,
  isSelected,
  isExpanded,
  onOpen,
  onToggleStock,
  onToggleExpand,
  actions,
}: PantryCardProps) {
  const { t } = useTranslation("cooking");
  const expiryLabel = useExpiryLabel();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSelecting = isSelected !== null;
  const warning = expiry ? expiryLabel(expiry) : null;
  const quantity = [item.quantity, item.unit]
    .filter((part) => part !== null && part !== "")
    .join(" ");

  return (
    <div
      className={`min-w-0 ${isNested ? "ml-3" : ""}`}
      // The old long press: touch devices send contextmenu for it.
      onContextMenu={(event) => {
        if (isSelecting) return;
        event.preventDefault();
        setIsMenuOpen(true);
      }}
    >
      <Box
        as="article"
        border="all"
        radius="lg"
        surface={isNested ? "base" : "surface"}
        padding={2}
        aria-label={name}
        className={`h-full min-w-0 gap-2 ${isList ? "flex-row items-center" : "flex-col"} ${isNested ? "border-dashed" : ""} ${isInStock ? "" : "opacity-70"} ${isSelected ? "border-accent" : ""}`}
      >
        <Pressable
          onPress={onOpen}
          isPressed={isSelected ?? undefined}
          className={`flex min-w-0 flex-1 gap-2 text-start ${isList ? "flex-row items-center" : "flex-col"}`}
        >
          <span
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-level-3 ${isList ? "size-12" : "aspect-square w-full"}`}
          >
            {item.img_url ? (
              <img
                src={assetUrl(item.img_url)}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <CategoryIcon name={categoryIcon} size={isList ? 20 : 32} />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <Text as="span" isTruncated>
              <strong>{name}</strong>
            </Text>
            {item.brand && !isNested ? (
              <Text as="span" variant="small" tone="muted" isTruncated>
                {item.brand}
              </Text>
            ) : null}
            {variantOf ? (
              <Text as="span" variant="caption" tone="muted">
                {t("pantry.card.variantOf", { name: variantOf })}
              </Text>
            ) : null}
            <span className="flex flex-wrap items-center gap-1">
              {aggregate ? (
                <Chip
                  icon={<Boxes aria-hidden size={12} />}
                  text={`${aggregate.stocked} / ${aggregate.total}`}
                  title={t("pantry.card.variantsInStock", {
                    stocked: aggregate.stocked,
                    total: aggregate.total,
                  })}
                />
              ) : quantity ? (
                <Text as="span" variant="small">
                  {quantity}
                </Text>
              ) : null}
              {item.recipe_count ? (
                <Chip
                  tone="muted"
                  icon={<Utensils aria-hidden size={12} />}
                  text={String(item.recipe_count)}
                  title={t("pantry.card.usedIn", { count: item.recipe_count })}
                />
              ) : null}
              {warning && expiry ? (
                <Chip
                  tone={expiryStatus(expiry) === "past" ? "danger" : "accent"}
                  icon={
                    expiryStatus(expiry) === "past" ? (
                      <CalendarX aria-hidden size={12} />
                    ) : (
                      <Clock aria-hidden size={12} />
                    )
                  }
                  text={warning}
                  title={t("pantry.expiry.on", { date: expiry })}
                />
              ) : null}
              {category ? (
                <Chip
                  tone="muted"
                  icon={<Tag aria-hidden size={12} />}
                  text={category.name}
                />
              ) : null}
            </span>
          </span>
        </Pressable>
        <Row gap={1} align="center" justify="end">
          {isSelecting ? (
            <Button
              size="sm"
              variant={isSelected ? "primary" : "secondary"}
              aria-pressed={isSelected}
              aria-label={t(
                isSelected ? "pantry.select.deselect" : "pantry.select.select",
                { name },
              )}
              onClick={onOpen}
            >
              {isSelected ? (
                <Check aria-hidden size={16} />
              ) : (
                <Plus aria-hidden size={16} />
              )}
            </Button>
          ) : (
            <>
              {onToggleStock ? (
                <Button
                  size="sm"
                  variant={isInStock ? "primary" : "secondary"}
                  aria-pressed={isInStock}
                  aria-label={t(
                    isInStock ? "pantry.card.markOut" : "pantry.card.markIn",
                    { name },
                  )}
                  onClick={onToggleStock}
                >
                  {isInStock ? (
                    <Check aria-hidden size={16} />
                  ) : (
                    <Plus aria-hidden size={16} />
                  )}
                </Button>
              ) : null}
              <RowMenu
                label={t("cookingCommon.actionsFor", { name })}
                items={actions}
                isOpen={isMenuOpen}
                onOpenChange={setIsMenuOpen}
              />
            </>
          )}
          {onToggleExpand ? (
            <Button
              size="sm"
              aria-expanded={isExpanded}
              aria-label={t(
                isExpanded ? "pantry.card.collapse" : "pantry.card.expand",
                { name },
              )}
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronUp aria-hidden size={16} />
              ) : (
                <ChevronDown aria-hidden size={16} />
              )}
            </Button>
          ) : null}
        </Row>
      </Box>
    </div>
  );
}
