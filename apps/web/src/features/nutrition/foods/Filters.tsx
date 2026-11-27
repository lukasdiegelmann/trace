import {
  Button,
  Menu,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { Layers, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { categoryDisplay, categoryName } from "../lib/foodSearch";
import { OFF_TIERS, type OffTier } from "../lib/sources/offRank";
import { toggleTier } from "../lib/sources/types";
import { USDA_TIERS, type UsdaTier } from "../lib/sources/usda";
import { useNtSettings } from "../settings";
import type { SourceId } from "./entries";

/** A button that opens a menu of checkable entries and stays usable */
function CheckMenu({
  label,
  text,
  icon,
  isActive,
  items,
}: {
  label: string;
  text: string;
  icon: React.ReactNode;
  isActive: boolean;
  items: MenuItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Menu
      items={items}
      label={label}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      hasExternalTrigger
    >
      <span className="inline-flex">
        <Button
          size="sm"
          text={text}
          isActive={isActive}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          {icon}
        </Button>
      </span>
    </Menu>
  );
}

/**
 * Where to look: one source at a time, or several pinned together (right
 * click a source, or use the "combine" menu).
 */
export function SourceFilter({
  sources,
  value,
  pinned,
  onSelect,
  onPinnedChange,
}: {
  sources: SourceId[];
  value: SourceId;
  pinned: SourceId[];
  onSelect: (source: SourceId) => void;
  onPinnedChange: (pinned: SourceId[]) => void;
}) {
  const { t } = useTranslation("nutrition");
  const label = (source: SourceId) => t(`foods.sources.${source}`);
  const togglePin = (source: SourceId) => {
    if (source === "all") return;
    // The first pin takes the source on show along
    const base =
      pinned.length > 0
        ? pinned
        : value !== "all" && value !== source
          ? [value]
          : [];
    const next = base.includes(source)
      ? base.filter((item) => item !== source)
      : [...base, source];
    if (next.length === 1) {
      onPinnedChange([]);
      onSelect(next[0]);
    } else {
      onPinnedChange(next);
    }
  };
  const isOn = (source: SourceId) =>
    pinned.length > 0 ? pinned.includes(source) : value === source;

  return (
    <Row
      gap={1}
      shouldWrap
      align="center"
      role="group"
      aria-label={t("foods.sources.label")}
    >
      {sources.map((source) => (
        <div
          key={source}
          onContextMenu={(event) => {
            event.preventDefault();
            togglePin(source);
          }}
        >
          <Button
            size="sm"
            variant={isOn(source) ? "secondary" : "ghost"}
            aria-pressed={isOn(source)}
            text={label(source)}
            onClick={() => {
              onPinnedChange([]);
              onSelect(source);
            }}
          />
        </div>
      ))}
      <CheckMenu
        label={t("foods.sources.combine")}
        text=""
        icon={<Layers aria-hidden size={14} />}
        isActive={pinned.length > 0}
        items={sources
          .filter((source) => source !== "all")
          .map((source) => ({
            id: source,
            text: label(source),
            isChecked: pinned.includes(source),
            onSelect: () => {
              togglePin(source);
            },
          }))}
      />
    </Row>
  );
}

export function CategoryFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (category: string) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  if (settings.foodCategories.length === 0) return null;
  const options = [
    { id: "", label: t("foods.categories.all") },
    ...settings.foodCategories.map((category) => ({
      id: categoryName(category),
      label: categoryDisplay(category, settings.foodsShowLabels),
    })),
  ];
  return (
    <Row
      gap={1}
      shouldWrap
      role="group"
      aria-label={t("foods.categories.label")}
    >
      {options.map((option) => (
        <Button
          key={option.id}
          size="sm"
          variant={value === option.id ? "secondary" : "ghost"}
          aria-pressed={value === option.id}
          text={option.label}
          // The active one again clears the filter
          onClick={() => {
            onChange(value === option.id ? "" : option.id);
          }}
        />
      ))}
    </Row>
  );
}

function TierMenu<T extends string>({
  label,
  tiers,
  active,
  onChange,
  nameOf,
}: {
  label: string;
  tiers: readonly T[];
  active: ReadonlySet<T>;
  onChange: (active: Set<T>) => void;
  nameOf: (tier: T) => string;
}) {
  const { t } = useTranslation("nutrition");
  const isFiltered = active.size < tiers.length;
  return (
    <CheckMenu
      label={label}
      text={isFiltered ? `${label} · ${t("foods.tier.filtered")}` : label}
      icon={<SlidersHorizontal aria-hidden size={14} />}
      isActive={isFiltered}
      items={[
        ...tiers.map((tier) => ({
          id: tier,
          text: nameOf(tier),
          isChecked: active.has(tier),
          // The last one stays ticked
          onSelect: () => {
            onChange(toggleTier(active, tier));
          },
        })),
        {
          id: "reset",
          text: t("foods.tier.reset"),
          hasSeparatorBefore: true,
          isDisabled: !isFiltered,
          onSelect: () => {
            onChange(new Set(tiers));
          },
        },
      ]}
    />
  );
}

export function TierFilters({
  offTiers,
  usdaTiers,
  onOffChange,
  onUsdaChange,
  shouldShowOff,
  shouldShowUsda,
}: {
  offTiers: ReadonlySet<OffTier>;
  usdaTiers: ReadonlySet<UsdaTier>;
  onOffChange: (tiers: Set<OffTier>) => void;
  onUsdaChange: (tiers: Set<UsdaTier>) => void;
  shouldShowOff: boolean;
  shouldShowUsda: boolean;
}) {
  const { t } = useTranslation("nutrition");
  if (!shouldShowOff && !shouldShowUsda) return null;
  return (
    <Row gap={1} shouldWrap>
      {shouldShowOff && (
        <TierMenu
          label={t("foods.tier.offLabel")}
          tiers={OFF_TIERS}
          active={offTiers}
          onChange={onOffChange}
          nameOf={(tier) => t(`foods.tier.${tier}`)}
        />
      )}
      {shouldShowUsda && (
        <TierMenu
          label={t("foods.tier.usdaLabel")}
          tiers={USDA_TIERS}
          active={usdaTiers}
          onChange={onUsdaChange}
          nameOf={(tier) =>
            tier === "Unknown" ? t("foods.tier.unknown") : tier
          }
        />
      )}
    </Row>
  );
}

export function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={1}>
      <Text variant="label">{title}</Text>
      {children}
    </Stack>
  );
}
