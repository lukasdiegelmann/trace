import {
  Button,
  Pressable,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { BookOpen, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Cookbook } from "../cookbooksApi";

import { Cover, SharedBadges } from "./RecipeCard";

export interface CookbookCardProps {
  cookbook: Cookbook;
  onOpen: () => void;
  /** Own cookbooks only */
  onShare?: () => void;
}

export function CookbookCard({ cookbook, onOpen, onShare }: CookbookCardProps) {
  const { t } = useTranslation("cooking");
  return (
    <div className="relative overflow-hidden rounded-container border border-border bg-level-1">
      <Pressable
        fill="width"
        align="stretch"
        justify="start"
        label={cookbook.name}
        onPress={onOpen}
      >
        <Cover
          url={cookbook.cover_image_url}
          fallback={<BookOpen aria-hidden size={40} />}
        />
        <Stack gap={2} padding={3}>
          {cookbook.shared_with_me ? (
            <SharedBadges
              sharedBy={cookbook.shared_by}
              kitchen={cookbook.via_kitchen_name}
            />
          ) : null}
          <Text variant="heading" as="h3">
            {cookbook.name}
          </Text>
          {cookbook.description ? (
            <Text variant="small" tone="muted" className="line-clamp-2">
              {cookbook.description}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {t("recipes.cookbooks.count", { count: cookbook.recipe_count })}
          </Text>
        </Stack>
      </Pressable>
      {onShare ? (
        <div className="absolute top-2 right-2 rounded-control bg-level-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("recipes.share.cookbookTitle")}
            onClick={onShare}
          >
            <Share2 aria-hidden size={18} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
