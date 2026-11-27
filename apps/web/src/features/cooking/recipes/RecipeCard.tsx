import {
  Button,
  Chip,
  Menu,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  Clock,
  CookingPot,
  Heart,
  History,
  MoreVertical,
  SquareCheck,
  Square,
  Users,
  Utensils,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../lib/assetUrl";
import { formatDuration, totalMinutes } from "../lib/duration";
import { pantryMatch } from "../lib/recipeList";
import { relativeTime } from "../lib/relativeTime";
import type { Recipe } from "../recipesApi";

import { StarRating } from "./ui/StarRating";

/** A cover with an icon when there is no image */
export function Cover({
  url,
  fallback,
}: {
  url: string | null;
  fallback: ReactNode;
}) {
  const source = assetUrl(url);
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-level-2 text-muted">
      {source ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        fallback
      )}
    </div>
  );
}

/** "Shared by X", and through which kitchen */
export function SharedBadges({
  sharedBy,
  kitchen,
}: {
  sharedBy: string | null | undefined;
  kitchen: string | null | undefined;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Row gap={1} shouldWrap>
      <Chip
        tone="accent"
        icon={<Users aria-hidden size={14} />}
        text={sharedBy || t("recipes.shared.badge")}
        title={
          sharedBy
            ? t("recipes.shared.by", { name: sharedBy })
            : t("recipes.shared.withYou")
        }
      />
      {kitchen ? (
        <Chip icon={<CookingPot aria-hidden size={14} />} text={kitchen} />
      ) : null}
    </Row>
  );
}

export interface RecipeCardProps {
  recipe: Recipe;
  onOpen: () => void;
  /** Without actions there is no menu button */
  menu?: MenuItem[];
  /** Set while selecting several recipes */
  isSelected?: boolean;
  /** The shared tab shows less */
  isCompactMeta?: boolean;
}

export function RecipeCard({
  recipe,
  onOpen,
  menu,
  isSelected,
  isCompactMeta,
}: RecipeCardProps) {
  const { t, i18n } = useTranslation("cooking");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSelecting = isSelected !== undefined;
  const minutes = totalMinutes(recipe);
  const match = pantryMatch(recipe.pantry_match);
  const color = recipe.category?.color ?? undefined;

  return (
    <div
      className="relative overflow-hidden rounded-container border border-border bg-level-1"
      style={color ? { borderLeft: `3px solid ${color}` } : undefined}
      onContextMenu={
        menu && !isSelecting
          ? (event) => {
              event.preventDefault();
              setIsMenuOpen(true);
            }
          : undefined
      }
    >
      <Pressable
        fill="width"
        align="stretch"
        justify="start"
        label={recipe.name}
        isPressed={isSelected}
        onPress={onOpen}
        // Pressable sets its own background; `!` wins over it.
        className={isSelected ? "bg-accent/10!" : undefined}
      >
        <Cover
          url={recipe.img_url}
          fallback={<Utensils aria-hidden size={40} />}
        />
        <Stack gap={2} padding={3}>
          {recipe.shared_with_me ? (
            <SharedBadges
              sharedBy={recipe.shared_by}
              kitchen={recipe.via_kitchen_name}
            />
          ) : null}
          {recipe.category ? (
            <Text variant="label" tone="muted">
              {recipe.category.name}
            </Text>
          ) : null}
          <Text variant="heading" as="h3">
            {recipe.name}
          </Text>
          {!isCompactMeta && recipe.rating ? (
            <StarRating value={recipe.rating} size={14} />
          ) : null}
          {recipe.description ? (
            <Text variant="small" tone="muted" className="line-clamp-2">
              {recipe.description}
            </Text>
          ) : null}
          <Row gap={1} shouldWrap>
            {minutes > 0 ? (
              <Chip
                icon={<Clock aria-hidden size={14} />}
                text={formatDuration(minutes)}
              />
            ) : null}
            {recipe.servings ? (
              <Chip
                icon={<Utensils aria-hidden size={14} />}
                text={String(recipe.servings)}
                title={t("recipes.card.servings", { count: recipe.servings })}
              />
            ) : null}
            {!isCompactMeta && recipe.last_cooked_at ? (
              <Chip
                tone="muted"
                icon={<History aria-hidden size={14} />}
                text={relativeTime(recipe.last_cooked_at, i18n.language)}
              />
            ) : null}
            {!isCompactMeta && match && recipe.pantry_match ? (
              <Chip
                tone={
                  match === "full"
                    ? "accent"
                    : match === "partial"
                      ? "default"
                      : "muted"
                }
                icon={<CookingPot aria-hidden size={14} />}
                text={`${recipe.pantry_match.have}/${recipe.pantry_match.need}`}
                title={t("recipes.card.pantry")}
              />
            ) : null}
            {isCompactMeta
              ? null
              : recipe.tags
                  .slice(0, 2)
                  .map((tag) => <Chip key={tag} tone="muted" text={tag} />)}
          </Row>
        </Stack>
      </Pressable>
      {recipe.favorite ? (
        <span className="pointer-events-none absolute top-2 right-2 text-destructive">
          <Heart
            size={20}
            className="fill-current"
            aria-label={t("recipes.card.favorite")}
            role="img"
          />
        </span>
      ) : null}
      {isSelecting ? (
        <span className="pointer-events-none absolute top-2 left-2 rounded-control bg-level-1 p-1">
          {isSelected ? (
            <SquareCheck aria-hidden size={20} />
          ) : (
            <Square aria-hidden size={20} />
          )}
        </span>
      ) : menu ? (
        <div className="absolute right-2 bottom-2">
          <Menu
            items={menu}
            label={t("recipes.card.actions", { name: recipe.name })}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            align="end"
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("recipes.card.actions", { name: recipe.name })}
            >
              <MoreVertical aria-hidden size={18} />
            </Button>
          </Menu>
        </div>
      ) : null}
    </div>
  );
}
