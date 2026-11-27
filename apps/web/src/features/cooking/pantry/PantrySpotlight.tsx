import {
  Box,
  Button,
  Pressable,
  Row,
  ScrollArea,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CategoryIcon } from "../common/CategoryIcon";
import { assetUrl } from "../lib/assetUrl";
import { daysUntil } from "../lib/expiry";
import type { PantryItem } from "../pantryApi";

export interface PantrySpotlightProps {
  entries: { item: PantryItem; date: string }[];
  total: number;
  iconOf: (item: PantryItem) => string;
  onOpen: (item: PantryItem) => void;
  onShowAll: () => void;
}

/** "Expiring & Expired" on wide screens (phones have the filter chip) */
export function PantrySpotlight({
  entries,
  total,
  iconOf,
  onOpen,
  onShowAll,
}: PantrySpotlightProps) {
  const { t } = useTranslation("cooking");
  const label = (date: string) => {
    const days = daysUntil(date) ?? 0;
    if (days < 0) return t("pantry.expiry.expired");
    if (days === 0) return t("pantry.spotlight.today");
    return t("pantry.spotlight.daysLeft", { count: days });
  };
  return (
    <Box
      as="section"
      border="all"
      radius="lg"
      padding={3}
      aria-label={t("pantry.spotlight.title")}
      className="max-lg:hidden"
    >
      <Stack gap={2}>
        <Row justify="between" align="center">
          <Text variant="heading" as="h2">
            {t("pantry.spotlight.title")} ({total})
          </Text>
          <Button
            size="sm"
            text={t("pantry.spotlight.seeAll")}
            isIconTrailing
            onClick={onShowAll}
          >
            <ChevronRight aria-hidden size={14} />
          </Button>
        </Row>
        <ScrollArea direction="horizontal">
          <Row gap={2}>
            {entries.map(({ item, date }) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onOpen(item);
                }}
                className="flex w-52 shrink-0 flex-row items-center gap-2 rounded-control bg-level-3! p-2 text-start"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control">
                  {item.img_url ? (
                    <img
                      src={assetUrl(item.img_url)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <CategoryIcon name={iconOf(item)} />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <Text as="span" isTruncated>
                    {item.name}
                  </Text>
                  <Text
                    as="span"
                    variant="caption"
                    tone={(daysUntil(date) ?? 0) < 0 ? "danger" : "warning"}
                  >
                    {label(date)}
                  </Text>
                </span>
              </Pressable>
            ))}
          </Row>
        </ScrollArea>
      </Stack>
    </Box>
  );
}
