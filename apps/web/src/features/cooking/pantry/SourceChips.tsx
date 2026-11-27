import { Button, Menu, Row } from "@monocircuit/monolithium/components";
import { ChevronDown, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OFF_TIERS, USDA_TIERS } from "../lib/externalFoods";
import {
  togglePinned,
  toggleTier,
  type SearchSource,
  type SourceSelection,
} from "../lib/searchSources";
import type { TierFilters } from "./tierFilters";

const TIER_KEYS = {
  hi: "complete",
  mid: "partial",
  lo: "sparse",
  unknown: "unknown",
} as const;

export interface SourceChipsProps {
  sources: readonly SearchSource[];
  selection: SourceSelection;
  onSelectionChange: (selection: SourceSelection) => void;
  tiers: TierFilters;
  onTiersChange: (tiers: TierFilters) => void;
}

/**
 * Where the search looks. A tap picks one source; a long press (or the
 * "combine" menu) pins several. OFF and USDA have a quality filter.
 * TODO(monolithium): filter chips that toggle, with a split menu button
 */
export function SourceChips({
  sources,
  selection,
  onSelectionChange,
  tiers,
  onTiersChange,
}: SourceChipsProps) {
  const { t } = useTranslation("cooking");
  const { source: current, pinned } = selection;
  const isActive = (source: SearchSource) =>
    pinned.size > 0 ? pinned.has(source) : current === source;
  const name = (source: SearchSource) => t(`pantry.sources.${source}`);
  const external = sources.filter(
    (source) => source !== "all" && source !== "local",
  );

  const tierMenu = (source: "off" | "usda") => {
    const active = tiers[source];
    const all: readonly string[] = source === "off" ? OFF_TIERS : USDA_TIERS;
    const isFiltered = active.size !== all.length;
    const label = t(
      source === "off" ? "pantry.tiers.offTitle" : "pantry.tiers.usdaTitle",
    );
    return (
      <Menu
        label={label}
        items={[
          ...all.map((tier) => ({
            id: tier,
            text:
              source === "off"
                ? t(`pantry.tiers.${TIER_KEYS[tier as keyof typeof TIER_KEYS]}`)
                : tier === "unknown"
                  ? t("pantry.tiers.unknown")
                  : tier,
            isChecked: active.has(tier),
            onSelect: () => {
              onTiersChange({ ...tiers, [source]: toggleTier(active, tier) });
            },
          })),
          {
            id: "reset",
            text: t("pantry.tiers.reset"),
            hasSeparatorBefore: true,
            isDisabled: !isFiltered,
            onSelect: () => {
              onTiersChange({ ...tiers, [source]: new Set(all) });
            },
          },
        ]}
      >
        <Button
          size="sm"
          aria-label={
            isFiltered ? `${label} (${t("pantry.tiers.active")})` : label
          }
          variant={isFiltered ? "secondary" : "ghost"}
        >
          <ChevronDown aria-hidden size={14} />
        </Button>
      </Menu>
    );
  };

  return (
    <Row
      gap={1}
      align="center"
      shouldWrap
      role="group"
      aria-label={t("pantry.sources.label")}
    >
      {sources.map((source) => (
        <div
          key={source}
          className="flex items-center"
          onContextMenu={(event) => {
            if (source === "all" || source === "local") return;
            event.preventDefault();
            onSelectionChange(togglePinned(selection, source));
          }}
        >
          <Button
            size="sm"
            variant={isActive(source) ? "primary" : "secondary"}
            aria-pressed={isActive(source)}
            text={name(source)}
            onClick={() => {
              onSelectionChange({ source, pinned: new Set() });
            }}
          />
          {source === "off" || source === "usda" ? tierMenu(source) : null}
        </div>
      ))}
      {external.length > 0 ? (
        <Menu
          label={t("pantry.sources.combine")}
          items={external.map((source) => ({
            id: source,
            text: name(source),
            isChecked: isActive(source),
            onSelect: () => {
              onSelectionChange(togglePinned(selection, source));
            },
          }))}
        >
          <Button size="sm" aria-label={t("pantry.sources.combine")}>
            <Layers aria-hidden size={14} />
          </Button>
        </Menu>
      ) : null}
    </Row>
  );
}
