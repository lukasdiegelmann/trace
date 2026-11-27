import {
  Banner,
  Button,
  Disclosure,
  EmptyState,
  InplaceMultiSelect,
  Input,
  Row,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowLeft,
  ListChecks,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { proxyGet } from "../api";
import { AppDialog } from "../components/AppDialog";
import { useNotify } from "../components/useNotify";
import {
  diaryPath,
  pickFromSearch,
  type FoodEditorState,
} from "../editorLinks";
import { findByBarcode } from "../lib/barcode";
import { arrangeLibrary } from "../lib/foodSearch";
import { hydrateOffHit, lookupBarcode } from "../lib/sources/openFoodFacts";
import {
  filterByOffTier,
  OFF_TIERS,
  type OffTier,
} from "../lib/sources/offRank";
import {
  filterByUsdaTier,
  USDA_TIERS,
  type UsdaTier,
} from "../lib/sources/usda";
import { useNtSettings } from "../settings";
import { useIsWide } from "../useIsWide";
import { useMediaQuery } from "../useMediaQuery";
import { useNutritionFormat } from "../useNutritionFormat";
import {
  entryName,
  externalEntry,
  foodEntry,
  isOwn,
  mealEntry,
  TABS,
  type Entry,
  type OutsideSource,
  type SourceId,
  type Tab,
} from "./entries";
import { EntryRow } from "./EntryRow";
import {
  CategoryFilter,
  FilterSection,
  SourceFilter,
  TierFilters,
} from "./Filters";
import { FoodDetail, type FoodDetailEntry } from "./FoodDetail";
import { importRecipe } from "./importRecipe";
import { MealContents } from "./MealContents";
import { QuantityDialog } from "./QuantityDialog";
import { ScannerDialog } from "./ScannerDialog";
import { offOptions, outsideSources } from "./sourceConfig";
import { useExternalSearch, type SourceResult } from "./useExternalSearch";
import { useFoodActions } from "./useFoodActions";
import { useLibrary, useShared } from "./useLibrary";
import { useListScroll } from "./useListScroll";
import { usePickActions } from "./usePickActions";
import { useYesterday } from "./useYesterday";
import { YesterdayMeals } from "./YesterdayMeals";

/** The order of the combined view */
const ALL_ORDER: SourceId[] = [
  "local",
  "shared",
  "mealie",
  "cooktrace",
  "cooktracePantry",
  "off",
  "usda",
];

const SORT_KEYS = {
  foods: "foodsSort",
  meals: "mealsSort",
  recipes: "recipesSort",
} as const;

export function FoodsPage() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && TABS.includes(asked) ? asked : "foods";
  const setTab = (next: Tab) => {
    const updated = new URLSearchParams(params);
    updated.set("tab", next);
    setParams(updated, { replace: true });
  };
  // Keyed by tab: source, category, selection and preview start over
  return <FoodList key={tab} tab={tab} onTabChange={setTab} />;
}

function FoodList({
  tab,
  onTabChange,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings, set, isLoaded } = useNtSettings();
  const format = useNutritionFormat();
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const pick = useMemo(() => pickFromSearch(params), [params]);
  const isWide = useIsWide();
  const hasRoomForPane = useMediaQuery("(min-width: 1440px)") && isWide;

  const { own, sharing } = useLibrary();
  const reload = () => {
    own.reload();
    sharing.reload();
  };
  const pickActions = usePickActions(pick, own.data, reload);
  const actions = useFoodActions(reload);

  const [query, setQuery] = useState("");
  const [chosenSource, setSource] = useState<SourceId | null>(null);
  const [pinned, setPinned] = useState<SourceId[]>([]);
  const [category, setCategory] = useState("");
  const [offTiers, setOffTiers] = useState<Set<OffTier>>(new Set(OFF_TIERS));
  const [usdaTiers, setUsdaTiers] = useState<Set<UsdaTier>>(
    new Set(USDA_TIERS),
  );
  const [selected, setSelected] = useState<Map<string, Entry>>(new Map());
  const [isManaging, setIsManaging] = useState(false);
  const [preview, setPreview] = useState<Entry | null>(null);
  const [contents, setContents] = useState<Entry | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // Sources of this tab
  const sharedCount = sharing.data?.sharing_enabled ? sharing.data[tab] : 0;
  const outside = outsideSources(tab, settings);
  const single: SourceId[] = [
    "local",
    ...outside,
    ...(sharedCount > 0 ? (["shared"] as const) : []),
  ];
  const sources: SourceId[] = single.length >= 2 ? [...single, "all"] : single;
  const wantedSource =
    chosenSource ?? (settings.foodsDefaultSource as SourceId);
  const source: SourceId = sources.includes(wantedSource)
    ? wantedSource
    : "local";
  const activePins = pinned.filter((id) => sources.includes(id));
  const isCombined = activePins.length >= 2 || source === "all";
  const included: SourceId[] =
    activePins.length >= 2 ? activePins : source === "all" ? single : [source];

  const shared = useShared(included.includes("shared") && sharedCount > 0);
  const search = useExternalSearch(
    included.filter((id): id is OutsideSource =>
      (outside as SourceId[]).includes(id),
    ),
    query,
    isCombined,
  );

  const yesterday = useYesterday(
    Boolean(pick) &&
      tab === "meals" &&
      query.trim() === "" &&
      source === "local" &&
      settings.foodsShowYesterdayMeals,
    [
      ...(own.data?.foods ?? []),
      ...(own.data?.meals ?? []),
      ...(own.data?.recipes ?? []),
    ],
  );

  const sortKey = SORT_KEYS[tab];
  const toEntries = (list: "own" | "shared"): Entry[] => {
    const data = list === "own" ? own.data : shared.data;
    if (!data) return [];
    const view = {
      sort: settings[sortKey],
      query,
      category: tab === "foods" && list === "own" ? category : "",
    };
    return tab === "foods"
      ? arrangeLibrary(data.foods, view).map((row) =>
          foodEntry(row, list === "shared"),
        )
      : arrangeLibrary(data[tab], view).map((row) =>
          mealEntry(row, list === "shared"),
        );
  };

  const tiered = (id: OutsideSource, result: SourceResult | undefined) => {
    const items = result?.items ?? [];
    if (id !== "off" && id !== "usda") return { shown: items, hidden: 0 };
    const foods = items.flatMap((entry) =>
      entry.kind === "external" ? [entry.food] : [],
    );
    const kept = new Set<unknown>(
      id === "off"
        ? filterByOffTier(foods, offTiers)
        : filterByUsdaTier(foods, usdaTiers),
    );
    const shown = items.filter(
      (entry) => entry.kind === "external" && kept.has(entry.food),
    );
    return { shown, hidden: items.length - shown.length };
  };

  const hasQuery = query.trim() !== "";
  // The combined view waits for a query instead of listing the library
  const isWaitingForQuery = isCombined && !hasQuery;
  const groups = isWaitingForQuery
    ? []
    : ALL_ORDER.filter((id) => included.includes(id)).map((id) => {
        if (id === "local") {
          return { id, entries: toEntries("own"), hidden: 0 };
        }
        if (id === "shared") {
          return { id, entries: toEntries("shared"), hidden: 0 };
        }
        const filtered = tiered(
          id as OutsideSource,
          search.results[id as OutsideSource],
        );
        return { id, entries: filtered.shown, hidden: filtered.hidden };
      });
  const entries = groups.flatMap((group) =>
    group.entries.map((entry) => ({ entry, source: group.id })),
  );
  const hiddenByTier = groups.reduce((sum, group) => sum + group.hidden, 0);
  const results = Object.entries(search.results) as [
    OutsideSource,
    SourceResult,
  ][];
  const hasMore = results.some(([, result]) => result.hasMore);
  const isLoadingMore = results.some(
    ([, result]) => result.isLoading && result.items.length > 0,
  );

  // Back from an editor the list is where it was left
  const root = useRef<HTMLDivElement>(null);
  useListScroll(root, `${tab}:${String(Boolean(pick))}`, own.data !== null);

  // Sharing may have changed while the tab was away
  const reloadSharing = sharing.reload;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadSharing();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadSharing]);

  const sharedError = shared.error;
  useEffect(() => {
    if (sharedError) notify.error(t("foods.toast.sharedFailed"));
  }, [sharedError, notify, t]);

  // "/" and Ctrl-K / Cmd-K jump to the search field
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = /^(INPUT|TEXTAREA)$/.test(target.tagName);
      const isShortcut =
        (event.key === "/" && !isTyping) ||
        (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey));
      if (!isShortcut) return;
      event.preventDefault();
      searchInput.current?.focus();
      searchInput.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Infinite scroll: the next page when the end of the list comes into view
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const loadMore = search.loadMore;
  useEffect(() => {
    if (!sentinel || !hasMore) return;
    if (typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((seen) => {
      if (seen.some((item) => item.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [sentinel, hasMore, loadMore]);

  const toggleSelected = (entry: Entry) => {
    const next = new Map(selected);
    if (!next.delete(entry.key)) next.set(entry.key, entry);
    setSelected(next);
    if (next.size === 0 && isManaging) setIsManaging(false);
  };

  const openEntry = (entry: Entry) => {
    if (pick) {
      pickActions.pickEntry(entry, tab);
      return;
    }
    if (entry.kind === "mealie" || entry.kind === "ctRecipe") {
      // Browsing a recipe imports it into its editor
      importOutside(entry);
      return;
    }
    if (entry.kind === "meal") {
      if (hasRoomForPane) setPreview(entry);
      else if (entry.isShared) setContents(entry);
      else actions.edit(entry);
      return;
    }
    setPreview(entry);
    if (entry.kind === "external" && entry.food.source === "off") {
      void hydrateOffHit(proxyGet, entry.food, offOptions(settings)).then(
        (food) => {
          // A failed lookup counts as done too, or the view waits for ever
          const done = food.offInfo
            ? { ...food, offInfo: { ...food.offInfo, isFull: true } }
            : food;
          // Only if the same hit is still the one on show
          setPreview((shown) =>
            shown?.key === entry.key ? { ...entry, food: done } : shown,
          );
        },
      );
    }
  };
  const importOutside = (entry: Entry) => {
    importRecipe(entry, settings, navigate).catch((caught: unknown) => {
      notify.error(
        t("foods.toast.importFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    });
  };

  const handleCode = (code: string) => {
    setIsScanning(false);
    const known = findByBarcode(own.data?.foods ?? [], code);
    if (known) {
      if (pick) pickActions.pickEntry(foodEntry(known), "foods");
      else actions.edit(foodEntry(known));
      return;
    }
    // The "looking up" card only for lookups that take a moment
    const timer = setTimeout(() => {
      setLookingUp(code);
    }, 400);
    const toEditor = () => {
      const state: FoodEditorState = { barcode: code, pick: pick ?? undefined };
      void navigate("/nutrition/foods/edit", { state });
    };
    lookupBarcode(proxyGet, code, offOptions(settings))
      .then(
        (food) => {
          if (!food) {
            notify.info(t("foods.scanner.notFound", { code }));
            toEditor();
          } else if (pick) {
            pickActions.pickEntry(externalEntry(food), "foods");
          } else {
            setPreview(externalEntry(food));
          }
        },
        (caught: unknown) => {
          notify.error(
            t("foods.scanner.lookupFailed", {
              message:
                caught instanceof Error ? caught.message : String(caught),
            }),
          );
          toEditor();
        },
      )
      .finally(() => {
        clearTimeout(timer);
        setLookingUp(null);
      });
  };

  const rowActions = (entry: Entry): MenuItem[] => {
    if (isOwn(entry)) {
      return [
        {
          id: "edit",
          text: t("foods.actions.edit"),
          onSelect: () => {
            actions.edit(entry);
          },
        },
        ...(entry.kind === "meal"
          ? [
              {
                id: "clone",
                text: t("foods.actions.clone"),
                onSelect: () => {
                  actions.clone(entry);
                },
              },
            ]
          : []),
        ...(pick
          ? []
          : [
              {
                id: "select",
                text: t("foods.actions.select"),
                onSelect: () => {
                  setIsManaging(true);
                  setSelected(new Map([[entry.key, entry]]));
                },
              },
            ]),
        {
          id: "delete",
          text: t("foods.actions.delete"),
          tone: "danger" as const,
          onSelect: () => void actions.remove(entry),
        },
      ];
    }
    if (entry.kind === "food" || entry.kind === "meal") {
      return [
        {
          id: "catalog",
          text: t("foods.actions.saveToCatalog"),
          onSelect: () => {
            actions.saveToCatalog(entry);
          },
        },
      ];
    }
    if (entry.kind === "external") {
      return [
        {
          id: "foods",
          text: t("foods.actions.saveToFoods"),
          onSelect: () => {
            actions.saveToFoods(entry);
          },
        },
      ];
    }
    return [];
  };

  const selectionFor = (entry: Entry, from: SourceId) => {
    if (isManaging) {
      return isOwn(entry)
        ? {
            isSelected: selected.has(entry.key),
            onToggle: () => {
              toggleSelected(entry);
            },
          }
        : null;
    }
    // Picking many: the library, shared entries and the OFF and USDA lists
    const canPickMany =
      Boolean(pick) &&
      !isCombined &&
      ["local", "shared", "off", "usda"].includes(from);
    return canPickMany
      ? {
          isSelected: selected.has(entry.key),
          onToggle: () => {
            toggleSelected(entry);
          },
        }
      : null;
  };

  const mealTitle = pick
    ? format.mealName(settings.mealNames[pick.meal] ?? String(pick.meal + 1))
    : "";
  const visibleOwn = entries
    .map((item) => item.entry)
    .filter((entry) => isOwn(entry));

  const sourceFilter = sources.length > 1 && (
    <SourceFilter
      sources={sources}
      value={source}
      pinned={activePins}
      onSelect={(next) => {
        setSource(next);
        setPreview(null);
      }}
      onPinnedChange={setPinned}
    />
  );
  const categoryFilter = tab === "foods" &&
    source === "local" &&
    !isCombined &&
    settings.foodsShowCategories && (
      <CategoryFilter
        value={category}
        onChange={(next) => {
          setCategory(next);
          setPreview(null);
        }}
      />
    );
  const tierFilters = (
    <TierFilters
      offTiers={offTiers}
      usdaTiers={usdaTiers}
      onOffChange={setOffTiers}
      onUsdaChange={setUsdaTiers}
      shouldShowOff={included.includes("off")}
      shouldShowUsda={included.includes("usda")}
    />
  );

  const rows = (
    <ul className="m-0 flex flex-col p-0">
      {entries.map(({ entry, source: from }) => (
        <EntryRow
          key={entry.key}
          entry={entry}
          sourceLabel={
            isCombined && from !== "local"
              ? t(`foods.sources.${from}`)
              : undefined
          }
          selection={selectionFor(entry, from)}
          shouldPressSelect={isManaging}
          isHighlighted={preview?.key === entry.key}
          onPress={() => {
            openEntry(entry);
          }}
          actions={
            isManaging || (isCombined && entry.kind === "external")
              ? []
              : rowActions(entry)
          }
          onInfo={
            entry.kind === "meal" && !isManaging
              ? () => {
                  setContents(entry);
                }
              : undefined
          }
        />
      ))}
    </ul>
  );

  const isLoadingOwn = own.data === null && !own.error;
  let emptyText: string | null = null;
  if (isWaitingForQuery) emptyText = t("foods.empty.typeToSearch");
  else if (entries.length === 0 && !isLoadingOwn) {
    if (search.isSearching) emptyText = t("foods.empty.searching");
    else if (hasQuery) emptyText = t("foods.empty.noMatch");
    else if (results.length > 0 || source !== "local") {
      emptyText = included.some((id) => id === "off" || id === "usda")
        ? t("foods.empty.typeToSearch")
        : t("foods.empty.noResults");
    } else emptyText = t("foods.empty.library");
  }

  const list = (
    <Stack gap={2}>
      {isLoadingOwn && (
        <Stack align="center" padding={6}>
          <Spinner label={t("common.loading")} />
        </Stack>
      )}
      {results
        .filter(([, result]) => result.error)
        .map(([id, result]) => (
          <Banner
            key={id}
            text={t("foods.results.failed", {
              source: t(`foods.sources.${id}`),
              message: result.error ?? "",
            })}
          />
        ))}
      {yesterday.length > 0 ? (
        <>
          <YesterdayMeals
            groups={yesterday}
            onRepeat={(items) => {
              pickActions.repeat(items);
            }}
          />
          <Disclosure
            title={t("foods.yesterday.saved")}
            isOpen={!settings.foodsSavedCollapsed}
            onOpenChange={(isOpen) => {
              set("foodsSavedCollapsed", !isOpen);
            }}
          >
            {rows}
          </Disclosure>
        </>
      ) : (
        rows
      )}
      {emptyText && (
        <Stack gap={1} padding={4} align="center">
          <EmptyState
            text={emptyText}
            action={
              source === "local" && !hasQuery && !pick
                ? {
                    text: t(`foods.new.${tab}`),
                    onClick: () => {
                      actions.create(tab);
                    },
                  }
                : undefined
            }
          />
          {hasQuery && source === "local" && !isCombined && (
            <Text variant="caption">{t("foods.empty.noMatchHint")}</Text>
          )}
        </Stack>
      )}
      {hiddenByTier > 0 && (
        <Text variant="caption" align="center">
          {t("foods.tier.hidden", { count: hiddenByTier })}
        </Text>
      )}
      {results.length > 0 && entries.length > 0 && (
        <Text variant="caption" align="center">
          {isCombined
            ? results
                .map(([id, result]) =>
                  t(
                    result.total > 0
                      ? "foods.results.countOf"
                      : "foods.results.countShort",
                    {
                      source: t(`foods.sources.${id}`),
                      shown: result.items.length,
                      total: result.total,
                    },
                  ),
                )
                .join(" · ")
            : t("foods.results.count", {
                shown: results[0][1].items.length,
                total: Math.max(
                  results[0][1].total,
                  results[0][1].items.length,
                ),
              })}
        </Text>
      )}
      {search.isSearching && entries.length > 0 && (
        <Text variant="caption" align="center">
          {t(
            isLoadingMore
              ? "foods.results.loadingMore"
              : "foods.empty.searching",
          )}
        </Text>
      )}
      {hasMore && (
        <div ref={setSentinel} className="flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            text={t("foods.results.loadMore")}
            onClick={loadMore}
          />
        </div>
      )}
    </Stack>
  );

  const detail = (entry: FoodDetailEntry, isInPane: boolean) => (
    <FoodDetail
      key={entry.key}
      entry={entry}
      isInPane={isInPane}
      onAdd={(meal) => {
        pickActions.logFromDetail(entry, meal);
      }}
      onEdit={() => {
        if (entry.kind === "food") actions.edit(entry);
        else {
          const state: FoodEditorState = { prefill: entry.food };
          void navigate("/nutrition/foods/edit", { state });
        }
      }}
      onDelete={
        isOwn(entry)
          ? () =>
              void actions.remove(entry).then((isDone) => {
                if (isDone) setPreview(null);
              })
          : undefined
      }
    />
  );

  const isPaneShown = hasRoomForPane && !isManaging;

  return (
    <Stack gap={3} padding={4} ref={root}>
      <Row gap={2} align="center" justify="between" shouldWrap>
        {pick ? (
          <Row gap={2} align="center">
            <Button
              size="sm"
              aria-label={t("foods.backToDiary")}
              onClick={() => void navigate(diaryPath(pick.date))}
            >
              <ArrowLeft aria-hidden size={18} />
            </Button>
            <Text variant="heading" as="h2">
              {selected.size > 0
                ? t("foods.selected", { count: selected.size })
                : t("foods.pickTitle", { meal: mealTitle })}
            </Text>
          </Row>
        ) : isManaging ? (
          <Text variant="heading" as="h2">
            {t("foods.selected", { count: selected.size })}
          </Text>
        ) : null}
        <SegmentedControl<Tab>
          aria-label={t("foods.tabs.label")}
          options={TABS.map((id) => ({
            value: id,
            label: t(`foods.tabs.${id}`),
          }))}
          value={tab}
          onChange={onTabChange}
        />
        <Row gap={1} align="center">
          {pick && selected.size > 0 && (
            <>
              <Button
                size="sm"
                aria-label={t("foods.clearSelection")}
                onClick={() => {
                  setSelected(new Map());
                }}
              >
                <X aria-hidden size={16} />
              </Button>
              <Button
                size="sm"
                variant="primary"
                text={t("foods.addSelected", { count: selected.size })}
                isLoading={pickActions.isBusy}
                onClick={() => {
                  pickActions.addSelected([...selected.values()], tab);
                }}
              />
            </>
          )}
          {!pick && !isManaging && (
            <Button
              size="sm"
              text={t("foods.manage.start")}
              onClick={() => {
                setIsManaging(true);
                setPreview(null);
              }}
            >
              <ListChecks aria-hidden size={16} />
            </Button>
          )}
          {!isManaging && (
            <Button
              size="sm"
              variant="primary"
              aria-label={t(`foods.new.${tab}`)}
              onClick={() => {
                actions.create(tab);
              }}
            >
              <Plus aria-hidden size={18} />
            </Button>
          )}
        </Row>
      </Row>

      {isManaging && (
        <Row gap={2} shouldWrap>
          <Button
            size="sm"
            text={t("foods.manage.cancel")}
            onClick={() => {
              setIsManaging(false);
              setSelected(new Map());
            }}
          />
          <Button
            size="sm"
            text={t("foods.manage.selectAll")}
            isDisabled={visibleOwn.length === 0}
            onClick={() => {
              setSelected(
                new Map(visibleOwn.map((entry) => [entry.key, entry])),
              );
            }}
          />
          <Button
            size="sm"
            text={t("foods.manage.selectNone")}
            isDisabled={selected.size === 0}
            onClick={() => {
              setSelected(new Map());
            }}
          />
          <Button
            size="sm"
            variant="danger"
            text={t("foods.manage.delete")}
            isDisabled={selected.size === 0}
            onClick={() => {
              void actions.removeMany([...selected.values()]).then((isDone) => {
                if (!isDone) return;
                setSelected(new Map());
                setIsManaging(false);
              });
            }}
          >
            <Trash2 aria-hidden size={14} />
          </Button>
        </Row>
      )}

      <Row gap={2} align="center">
        <div className="min-w-0 flex-1">
          <Input
            type="search"
            aria-label={t("foods.search.label")}
            placeholder={t("foods.search.placeholder")}
            value={query}
            onValueChange={setQuery}
            inputElementRef={searchInput}
            icon={<Search aria-hidden size={16} />}
            fieldSize="lg"
          />
        </div>
        {query !== "" && (
          <Button
            size="md"
            aria-label={t("foods.search.clear")}
            onClick={() => {
              setQuery("");
            }}
          >
            <X aria-hidden size={16} />
          </Button>
        )}
        <Button
          size="md"
          variant="secondary"
          aria-label={t("foods.search.scan")}
          onClick={() => {
            setIsScanning(true);
          }}
        >
          <ScanBarcode aria-hidden size={18} />
        </Button>
        <InplaceMultiSelect
          label={undefined}
          value={settings[sortKey]}
          onChange={(value) => {
            set(sortKey, value);
          }}
          options={(["alpha", "recent", "most"] as const).map((value) => ({
            value,
            label: t(`foods.sort.${value}`),
          }))}
          placeholder={t("foods.sort.label")}
        />
      </Row>

      {own.error && (
        <Banner
          text={t("common.loadError")}
          actionText={t("common.retry")}
          onAction={own.reload}
        />
      )}
      {lookingUp && (
        <Banner text={t("foods.scanner.lookingUp", { code: lookingUp })} />
      )}

      <div
        className={
          isWide
            ? isPaneShown
              ? "grid grid-cols-[14rem_minmax(0,1fr)_24rem] items-start gap-4"
              : "grid grid-cols-[14rem_minmax(0,1fr)] items-start gap-4"
            : "flex flex-col gap-2"
        }
      >
        {isWide ? (
          <aside aria-label={t("foods.filters.label")}>
            <Stack gap={4}>
              {sourceFilter && (
                <FilterSection title={t("foods.sources.label")}>
                  {sourceFilter}
                </FilterSection>
              )}
              {categoryFilter && settings.foodCategories.length > 0 && (
                <FilterSection title={t("foods.categories.label")}>
                  {categoryFilter}
                </FilterSection>
              )}
              {tierFilters}
              {!sourceFilter && settings.foodCategories.length === 0 && (
                <Text variant="caption">{t("foods.filters.none")}</Text>
              )}
            </Stack>
          </aside>
        ) : (
          <>
            {sourceFilter}
            {categoryFilter}
            {tierFilters}
          </>
        )}
        {isLoaded && list}
        {isPaneShown && (
          <aside aria-label={t("foods.detail.previewEmpty")}>
            {preview ? (
              <Stack gap={2}>
                <Row justify="end">
                  <Button
                    size="sm"
                    aria-label={t("foods.detail.closePreview")}
                    onClick={() => {
                      setPreview(null);
                    }}
                  >
                    <X aria-hidden size={16} />
                  </Button>
                </Row>
                {preview.kind === "meal" ? (
                  <Stack gap={3}>
                    <Text variant="heading" as="h2">
                      {preview.row.name}
                    </Text>
                    <MealContents items={preview.row.items} />
                    <Button
                      variant="secondary"
                      size="md"
                      text={t(
                        preview.isShared
                          ? "foods.actions.saveToCatalog"
                          : "common.edit",
                      )}
                      onClick={() => {
                        if (preview.isShared) actions.saveToCatalog(preview);
                        else actions.edit(preview);
                      }}
                    />
                  </Stack>
                ) : preview.kind === "food" || preview.kind === "external" ? (
                  detail(preview, true)
                ) : null}
              </Stack>
            ) : (
              <EmptyState text={t("foods.detail.previewEmpty")} />
            )}
          </aside>
        )}
      </div>

      {!isPaneShown &&
        preview &&
        (preview.kind === "food" || preview.kind === "external") &&
        !pickActions.pending && (
          <AppDialog
            title={entryName(preview)}
            onClose={() => {
              setPreview(null);
            }}
          >
            {detail(preview, false)}
          </AppDialog>
        )}
      {contents?.kind === "meal" && (
        <AppDialog
          title={contents.row.name}
          onClose={() => {
            setContents(null);
          }}
        >
          <MealContents
            items={contents.row.items}
            action={
              pick
                ? {
                    text: t(
                      contents.row.is_recipe
                        ? "foods.contents.addRecipe"
                        : "foods.contents.addMeal",
                    ),
                    onClick: () => {
                      setContents(null);
                      pickActions.pickEntry(contents, tab);
                    },
                  }
                : undefined
            }
          />
        </AppDialog>
      )}
      {pickActions.pending && (
        <QuantityDialog
          foods={pickActions.pending.foods}
          onConfirm={(amounts) => {
            pickActions.confirmPending(amounts);
          }}
          onClose={() => {
            pickActions.cancelPending();
          }}
        />
      )}
      {isScanning && (
        <ScannerDialog
          onCode={handleCode}
          onClose={() => {
            setIsScanning(false);
          }}
        />
      )}
    </Stack>
  );
}
