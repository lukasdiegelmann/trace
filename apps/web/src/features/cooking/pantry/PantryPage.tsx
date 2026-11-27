import {
  Banner,
  Button,
  InplaceMultiSelect,
  Input,
  Row,
  SegmentedControl,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  LayoutGrid,
  List,
  Plus,
  Refrigerator,
  ScanBarcode,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings, useSetting } from "@/features/shared/settings";

import { BarcodeScanner } from "../common/BarcodeScanner";
import { CategoryIcon } from "../common/CategoryIcon";
import { EmptyNotice } from "../common/EmptyNotice";
import { PageHeader } from "../common/PageHeader";
import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useCookingDataChanged } from "../common/dataChanged";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import {
  offLookupBarcode,
  offTier,
  usdaLookupBarcode,
  type ExternalFood,
} from "../lib/externalFoods";
import {
  autoExpandedIds,
  countPantry,
  expiringSpotlight,
  filterPantry,
  groupPantry,
  isShownInStock,
  itemSlug,
  localMatches,
  type PantryQuery,
  type PantryRow,
  type SortKey,
  type StockFilter,
} from "../lib/pantryList";
import {
  aggregateStock,
  buildVariantsByParent,
  displayVariantName,
  isItemInStock,
  nextStockToggle,
} from "../lib/pantryVariants";
import { effectiveExpiry } from "../lib/expiry";
import {
  availableSources,
  defaultSource,
  sourcesToSearch,
  type SourceSelection,
} from "../lib/searchSources";
import { pantryApi, type PantryItem } from "../pantryApi";
import { ExternalResultsList, type ResultRow } from "./ExternalResultsList";
import { PantryCard } from "./PantryCard";
import { PantryItemSheet, type SheetTarget } from "./PantryItemSheet";
import { PantrySpotlight } from "./PantrySpotlight";
import { SourceChips } from "./SourceChips";
import { allTiers, type TierFilters } from "./tierFilters";
import { useExternalSearch } from "./useExternalSearch";

/** The old UI's key, so a dismissal there counts here too */
const BANNER_KEY = "ct:pantry:variant-announce-v1";

function readBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) !== null;
  } catch {
    return false;
  }
}

async function loadPantry() {
  const [items, categories] = await Promise.all([
    pantryApi.list(),
    pantryApi.categories().catch(() => []),
  ]);
  return { items, categories };
}

export function PantryPage() {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const { data, error, reload, setData } = useLoad(loadPantry);
  useCookingDataChanged(() => void reload({ isQuiet: true }));
  const { values: settings } = useSettings("ct");
  const [view, setView] = useSetting("ct", "pantryView");

  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  /** Null until a chip is picked: then `pantryDefaultSource` */
  const [picked, setPicked] = useState<SourceSelection | null>(null);
  const [tiers, setTiers] = useState<TierFilters>(allTiers);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<number> | null>(null);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] =
    useState(readBannerDismissed);

  const selection: SourceSelection = picked ?? {
    source: defaultSource(settings.pantryDefaultSource, settings),
    pinned: new Set(),
  };
  const sources = availableSources(settings);
  const external = sourcesToSearch(selection, settings);
  const { results, isSearching } = useExternalSearch(
    query,
    external,
    {
      language: settings.offSearchLanguage,
      country: settings.offSearchCountry,
    },
    settings.usdaApiKey,
  );

  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const variantsByParent = buildVariantsByParent(items);
  const filter: PantryQuery = { query, stockFilter, categoryFilter, sortKey };
  const rows = filterPantry(items, variantsByParent, categories, filter);
  const sections = groupPantry(rows, categories, filter);
  const counts = countPantry(items, variantsByParent, categories);
  const spotlight = expiringSpotlight(items, variantsByParent);
  const isExternalView = selection.source !== "local" && query.trim() !== "";

  const categoryOf = (item: PantryItem) => {
    const slug = itemSlug(item, categories);
    return categories.find((category) => category.slug === slug) ?? null;
  };
  const iconOf = (item: PantryItem) =>
    categoryOf(item)?.icon ?? (itemSlug(item, categories) ? "kitchen" : "help");

  const changeQuery = (next: string) => {
    setQuery(next);
    // A query naming a parent and a variant opens the parent.
    const auto = autoExpandedIds(items, variantsByParent, next);
    if (auto.length > 0) setExpanded((open) => new Set([...open, ...auto]));
  };

  const open = (item: PantryItem, shouldEdit = false) => {
    setTarget({ itemId: item.id, shouldEdit });
  };
  const create = (prefill?: Partial<ExternalFood>) => {
    setTarget({ itemId: null, shouldEdit: true, prefill });
  };

  const toggleSelected = (id: number) => {
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size > 0 ? next : null;
    });
  };

  const patchItem = (id: number, patch: Partial<PantryItem>) => {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  };

  const toggleStock = async (item: PantryItem) => {
    const next = nextStockToggle(item);
    patchItem(item.id, next);
    try {
      await pantryApi.update(item.id, next);
    } catch (caught) {
      patchItem(item.id, {
        quantity: item.quantity,
        in_stock: item.in_stock,
      });
      notify.failure(caught, t("pantry.toast.updateFailed"));
    }
  };

  const remove = async (item: PantryItem) => {
    const isConfirmed = await confirm({
      title: t("pantry.confirmRemove.title"),
      message: t("pantry.confirmRemove.message", { name: item.name }),
      confirmText: t("cookingCommon.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    try {
      await pantryApi.remove(item.id);
      notify.success(t("pantry.toast.removed"));
      await reload({ isQuiet: true });
    } catch (caught) {
      notify.failure(caught, t("pantry.toast.deleteFailed"));
    }
  };

  const removeSelected = async () => {
    const ids = [...(selected ?? [])];
    if (ids.length === 0) return;
    const isConfirmed = await confirm({
      title: t("pantry.confirmBulk.title", { count: ids.length }),
      message: t("pantry.confirmBulk.message"),
      confirmText: t("pantry.confirmBulk.confirm", { count: ids.length }),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    let failed = 0;
    for (const id of ids) {
      try {
        await pantryApi.remove(id);
      } catch {
        failed++;
      }
    }
    setSelected(null);
    if (failed === 0) {
      notify.success(t("pantry.toast.removedMany", { count: ids.length }));
    } else {
      notify.error(
        t("pantry.toast.removedPartly", {
          done: ids.length - failed,
          total: ids.length,
          failed,
        }),
      );
    }
    await reload({ isQuiet: true });
  };

  /** Known barcode: edit it; else prefill from OFF, then USDA */
  const handleScan = async (code: string) => {
    setIsScannerOpen(false);
    try {
      const existing = await pantryApi.byBarcode(code);
      if (existing) {
        open(existing, true);
        return;
      }
    } catch (caught) {
      notify.failure(caught, t("pantry.toast.lookupFailed"));
    }
    let found: ExternalFood | null = null;
    if (settings.offEnabled) {
      found = await offLookupBarcode(code, {
        language: settings.offSearchLanguage,
        country: settings.offSearchCountry,
      });
    }
    if (!found && settings.usdaEnabled && settings.usdaApiKey) {
      found = await usdaLookupBarcode(code, settings.usdaApiKey);
    }
    create({ ...(found ?? { name: "" }), barcode: code });
  };

  const actionsFor = (item: PantryItem): MenuItem[] => [
    {
      id: "edit",
      text: t("cookingCommon.edit"),
      onSelect: () => {
        open(item, true);
      },
    },
    {
      id: "stock",
      text: t(
        isItemInStock(item)
          ? "pantry.actions.markOut"
          : "pantry.actions.markIn",
      ),
      onSelect: () => void toggleStock(item),
    },
    {
      id: "select",
      text: t("pantry.actions.select"),
      onSelect: () => {
        setSelected(new Set([item.id]));
      },
    },
    {
      id: "delete",
      text: t("cookingCommon.delete"),
      tone: "danger",
      onSelect: () => void remove(item),
    },
  ];

  const card = (item: PantryRow, isGrouped: boolean) => {
    const aggregate = aggregateStock(item, variantsByParent);
    const variants = variantsByParent.get(item.id) ?? [];
    const isGeneric = aggregate.isGeneric;
    const isOpen = expanded.has(item.id);
    const name = item.standaloneParent
      ? displayVariantName(item, item.standaloneParent)
      : item.name;
    return [
      <PantryCard
        key={item.id}
        item={item}
        name={name}
        isInStock={isShownInStock(item, variantsByParent)}
        aggregate={isGeneric ? aggregate : null}
        category={isGrouped ? null : categoryOf(item)}
        categoryIcon={iconOf(item)}
        expiry={effectiveExpiry(item, variants)}
        variantOf={item.standaloneParent?.name}
        isList={view === "list"}
        isSelected={selected ? selected.has(item.id) : null}
        isExpanded={isOpen}
        onOpen={() => {
          if (selected) toggleSelected(item.id);
          else open(item);
        }}
        onToggleStock={isGeneric ? undefined : () => void toggleStock(item)}
        onToggleExpand={
          isGeneric
            ? () => {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                });
              }
            : undefined
        }
        actions={actionsFor(item)}
      />,
      ...(isGeneric && isOpen
        ? variants.map((variant) => (
            <PantryCard
              key={variant.id}
              item={variant}
              name={displayVariantName(variant, item, { isNested: true })}
              isInStock={isItemInStock(variant)}
              aggregate={null}
              category={null}
              categoryIcon="label"
              expiry={variant.expires_on}
              isNested
              isList={view === "list"}
              isSelected={selected ? selected.has(variant.id) : null}
              onOpen={() => {
                if (selected) toggleSelected(variant.id);
                else open(variant);
              }}
              onToggleStock={() => void toggleStock(variant)}
              actions={actionsFor(variant)}
            />
          ))
        : []),
    ];
  };

  const offVisible = results.off.filter((food) =>
    tiers.off.has(offTier(food.completeness)),
  );
  const usdaVisible = results.usda.filter((food) =>
    tiers.usda.has(food.dataType || "unknown"),
  );
  const isActiveSource = (source: "local" | "off" | "usda" | "nt") =>
    selection.pinned.size === 0 || selection.pinned.has(source);

  const resultRows = (): ResultRow[] => {
    const wrap = (source: "off" | "usda" | "nt", foods: ExternalFood[]) =>
      foods.map((food): ResultRow => ({ source, food }));
    if (selection.source === "off") return wrap("off", offVisible);
    if (selection.source === "usda") return wrap("usda", usdaVisible);
    if (selection.source === "nt") return wrap("nt", results.nt);
    return [
      ...(isActiveSource("local")
        ? localMatches(items, variantsByParent, query).map(
            (item): ResultRow => ({ source: "local", item }),
          )
        : []),
      ...(isActiveSource("off") ? wrap("off", offVisible) : []),
      ...(isActiveSource("usda") ? wrap("usda", usdaVisible) : []),
      ...(isActiveSource("nt") ? wrap("nt", results.nt) : []),
    ];
  };
  const isAllFiltered =
    (selection.source === "off" &&
      results.off.length > 0 &&
      offVisible.length === 0) ||
    (selection.source === "usda" &&
      results.usda.length > 0 &&
      usdaVisible.length === 0);

  const stockOptions = (
    [
      ["all", counts.all],
      ["in", counts.inStock],
      ["out", counts.out],
      ["expiring", counts.expiring],
    ] as const
  ).map(([value, count]) => ({
    value: value,
    label: `${t(`pantry.stock.${value}`)} ${count}`,
  }));

  const categoryOptions = [
    { value: "all", label: t("pantry.allCategories") },
    ...categories
      .filter((category) => (counts.bySlug.get(category.slug) ?? 0) > 0)
      .map((category) => ({
        value: category.slug,
        label: (
          <span className="flex items-center gap-1">
            <CategoryIcon name={category.icon} size={14} />
            {category.name} {counts.bySlug.get(category.slug)}
          </span>
        ),
      })),
    ...(counts.uncategorized > 0
      ? [
          {
            value: "uncategorized",
            label: `${t("pantry.uncategorized")} ${counts.uncategorized}`,
          },
        ]
      : []),
  ];

  const gridClasses =
    view === "list"
      ? "flex flex-col gap-2"
      : "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3";

  return (
    <Stack gap={4} padding={4}>
      <PageHeader
        title={
          selected
            ? t("pantry.select.count", { count: selected.size })
            : t("pantry.title")
        }
      >
        {selected ? (
          <>
            <Button
              variant="danger"
              size="md"
              aria-label={t("pantry.select.delete")}
              onClick={() => void removeSelected()}
            >
              <Trash2 aria-hidden size={18} />
            </Button>
            <Button
              size="md"
              aria-label={t("pantry.select.cancel")}
              onClick={() => {
                setSelected(null);
              }}
            >
              <X aria-hidden size={18} />
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="md"
            text={t("pantry.add")}
            onClick={() => {
              create();
            }}
          >
            <Plus aria-hidden size={18} />
          </Button>
        )}
      </PageHeader>

      {!isBannerDismissed && items.length > 0 ? (
        <Banner
          text={`${t("pantry.variantBanner.title")}: ${t("pantry.variantBanner.text")}`}
          dismissText={t("pantry.variantBanner.dismiss")}
          onDismiss={() => {
            setIsBannerDismissed(true);
            try {
              localStorage.setItem(BANNER_KEY, "1");
            } catch {
              // Private mode: dismissed for this visit only.
            }
          }}
        />
      ) : null}

      {data ? (
        <Stack gap={3}>
          <Row gap={2} align="end">
            <Input
              type="search"
              label={t("pantry.search")}
              value={query}
              wrapperClassName="min-w-0 flex-1"
              onChange={(event) => {
                changeQuery(event.target.value);
              }}
            />
            <Button
              variant="secondary"
              size="md"
              aria-label={t("cookingCommon.barcode.title")}
              onClick={() => {
                setIsScannerOpen(true);
              }}
            >
              <ScanBarcode aria-hidden size={18} />
            </Button>
          </Row>
          {sources.length > 1 ? (
            <SourceChips
              sources={sources}
              selection={selection}
              onSelectionChange={setPicked}
              tiers={tiers}
              onTiersChange={setTiers}
            />
          ) : null}
          {items.length > 0 ? (
            <>
              <Row gap={3} align="center" shouldWrap justify="between">
                <SegmentedControl<StockFilter>
                  aria-label={t("pantry.stock.label")}
                  variant="pill"
                  value={stockFilter}
                  options={stockOptions}
                  onChange={setStockFilter}
                  className="max-w-full overflow-x-auto"
                />
                <Row gap={2} align="center">
                  <InplaceMultiSelect
                    label={t("pantry.sort.label")}
                    value={sortKey}
                    options={(["name", "updated", "usage"] as const).map(
                      (value) => ({
                        value,
                        label: t(`pantry.sort.${value}`),
                      }),
                    )}
                    onChange={(value) => {
                      setSortKey(value as SortKey);
                    }}
                  />
                  {isExternalView ? null : (
                    <SegmentedControl
                      aria-label={t("pantry.view.label")}
                      value={view === "list" ? "list" : "grid"}
                      options={[
                        {
                          value: "grid",
                          label: (
                            <LayoutGrid
                              size={16}
                              role="img"
                              aria-label={t("pantry.view.grid")}
                            />
                          ),
                        },
                        {
                          value: "list",
                          label: (
                            <List
                              size={16}
                              role="img"
                              aria-label={t("pantry.view.list")}
                            />
                          ),
                        },
                      ]}
                      onChange={setView}
                    />
                  )}
                </Row>
              </Row>
              <SegmentedControl
                aria-label={t("pantry.categoryFilter")}
                variant="pill"
                value={categoryFilter}
                options={categoryOptions}
                onChange={setCategoryFilter}
                className="max-w-full self-start overflow-x-auto"
              />
            </>
          ) : null}
        </Stack>
      ) : null}

      {spotlight.length > 0 ? (
        <PantrySpotlight
          entries={spotlight}
          total={counts.expiring}
          iconOf={iconOf}
          onOpen={(item) => {
            open(item);
          }}
          onShowAll={() => {
            setStockFilter("expiring");
          }}
        />
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingState />
      ) : isExternalView ? (
        <ExternalResultsList
          rows={resultRows()}
          isSearching={isSearching}
          sourceName={
            selection.source === "all"
              ? null
              : t(`pantry.sources.${selection.source}`)
          }
          isAllFiltered={isAllFiltered}
          onResetFilter={() => {
            setTiers(allTiers());
          }}
          onPickFood={(food) => {
            create(food);
          }}
          onOpenItem={(item) => {
            open(item);
          }}
        />
      ) : items.length === 0 ? (
        <EmptyNotice
          icon={<Refrigerator aria-hidden size={32} />}
          title={t("pantry.empty.title")}
          text={t("pantry.empty.text")}
          actionText={t("pantry.empty.action")}
          onAction={() => {
            create();
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyNotice
          icon={<SearchX aria-hidden size={24} />}
          title={t("pantry.noMatch", { query })}
        />
      ) : (
        <Stack gap={5}>
          {sections.map((section) => {
            const isGrouped = section.key !== "*";
            const title = section.category?.name ?? t("pantry.uncategorized");
            return (
              <Stack key={section.key} gap={2} as="section">
                {isGrouped ? (
                  <Row gap={2} align="center">
                    <CategoryIcon
                      name={section.category?.icon ?? "help"}
                      size={18}
                    />
                    <Text variant="heading" as="h2">
                      {title}
                    </Text>
                    <Text as="span" tone="muted">
                      {section.rows.length}
                    </Text>
                  </Row>
                ) : null}
                <div className={gridClasses}>
                  {section.rows.flatMap((row) => card(row, isGrouped))}
                </div>
              </Stack>
            );
          })}
        </Stack>
      )}

      {isScannerOpen ? (
        <BarcodeScanner
          onClose={() => {
            setIsScannerOpen(false);
          }}
          onScan={(code) => void handleScan(code)}
        />
      ) : null}
      {target ? (
        <PantryItemSheet
          target={target}
          onClose={() => {
            setTarget(null);
          }}
          onChanged={() => void reload({ isQuiet: true })}
        />
      ) : null}
      {dialog}
    </Stack>
  );
}
