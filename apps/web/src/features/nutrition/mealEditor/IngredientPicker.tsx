import {
  Banner,
  Button,
  Input,
  Row,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ScanBarcode, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { foodsApi, integrationsApi, proxyGet } from "../api";
import { AppDialog } from "../components/AppDialog";
import { useNotify } from "../components/useNotify";
import {
  externalEntry,
  foodEntry,
  mealEntry,
  TABS,
  type Entry,
  type OutsideSource,
  type SourceId,
  type Tab,
} from "../foods/entries";
import { EntryRow } from "../foods/EntryRow";
import { ScannerDialog } from "../foods/ScannerDialog";
import {
  mealieConfig,
  offOptions,
  outsideSources,
} from "../foods/sourceConfig";
import { getMealieRecipe, mapMealieRecipe } from "../lib/sources/mealie";
import { useExternalSearch } from "../foods/useExternalSearch";
import { useLibrary, useShared } from "../foods/useLibrary";
import { findByBarcode } from "../lib/barcode";
import { arrangeLibrary } from "../lib/foodSearch";
import type { IngredientSource } from "../lib/mealForm";
import { completeOffFood, lookupBarcode } from "../lib/sources/openFoodFacts";
import { toFoodWrite } from "../lib/sources/types";
import { useNtSettings } from "../settings";
import { ingredientSourceOf } from "./ingredientSources";

const SORT_KEYS = {
  foods: "foodsSort",
  meals: "mealsSort",
  recipes: "recipesSort",
} as const;

/**
 * Picks ingredients from the library, from others or from an outside
 * source. Outside and shared picks are saved to the library first.
 */
export function IngredientPicker({
  excludeId,
  onPick,
  onClose,
}: {
  /** The meal being edited can't contain itself */
  excludeId: number | null;
  onPick: (sources: IngredientSource[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const notify = useNotify();
  const { own, sharing } = useLibrary();
  const [tab, setTab] = useState<Tab>("foods");
  const [chosen, setSource] = useState<SourceId>("local");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, Entry>>(new Map());
  const [isBusy, setIsBusy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const sharedCount = sharing.data?.sharing_enabled ? sharing.data.foods : 0;
  // Foods can come from anywhere; meals and recipes from the library
  const sources: SourceId[] =
    tab === "foods"
      ? [
          "local",
          ...outsideSources("foods", settings).filter(
            (id) => id !== "cooktracePantry",
          ),
          ...(sharedCount > 0 ? (["shared"] as const) : []),
        ]
      : ["local"];
  const source = sources.includes(chosen) ? chosen : "local";
  const shared = useShared(source === "shared");
  const isOutside = !["local", "shared", "all"].includes(source);
  const search = useExternalSearch(
    isOutside ? [source as OutsideSource] : [],
    query,
    false,
  );

  const view = {
    sort: settings[SORT_KEYS[tab]],
    query,
    pinning: "always",
  } as const;
  let entries: Entry[] = [];
  if (isOutside) {
    entries = search.results[source as OutsideSource]?.items ?? [];
  } else {
    const data = source === "shared" ? shared.data : own.data;
    if (data) {
      entries =
        tab === "foods"
          ? arrangeLibrary(data.foods, view).map((row) =>
              foodEntry(row, source === "shared"),
            )
          : arrangeLibrary(data[tab], view)
              .filter((row) => row.id !== excludeId)
              .map((row) => mealEntry(row, source === "shared"));
    }
  }

  /** The pick as a row of the user's own; null (told why) when it can't be */
  const persist = async (entry: Entry): Promise<IngredientSource | null> => {
    if (entry.kind === "food" || entry.kind === "meal") {
      if (!entry.isShared || entry.kind === "meal") {
        return ingredientSourceOf(entry.row);
      }
      const copy = await foodsApi.copy(entry.row.id);
      notify.success(t("foods.toast.savedToCatalog"));
      return ingredientSourceOf(copy);
    }
    if (entry.kind !== "external") return null;
    let food = entry.food;
    if (food.source === "off") {
      const result = await completeOffFood(
        proxyGet,
        food,
        offOptions(settings),
      );
      if (result.status !== "ok") {
        notify.error(t("mealEditor.picker.offNoValues", { name: food.name }));
        return null;
      }
      food = result.food;
    }
    return ingredientSourceOf(await foodsApi.create(toFoodWrite(food)));
  };

  const pick = async (picked: Entry[]) => {
    if (isBusy) return;
    setIsBusy(true);
    const result: IngredientSource[] = [];
    for (const entry of picked) {
      try {
        if (entry.kind === "mealie") {
          const recipe = await getMealieRecipe(
            integrationsApi.mealie,
            mealieConfig(settings),
            entry.recipe.slug,
          );
          if (recipe) {
            const source = await persist(
              externalEntry(mapMealieRecipe(recipe, settings.mealieBaseUrl)),
            );
            if (source) result.push(source);
          }
          continue;
        }
        const added = await persist(entry);
        if (added) result.push(added);
      } catch (caught) {
        notify.error(
          t("mealEditor.picker.catalogFailed", {
            message: caught instanceof Error ? caught.message : String(caught),
          }),
        );
      }
    }
    setIsBusy(false);
    if (result.length > 0) onPick(result);
  };

  const scanned = async (code: string) => {
    setIsScanning(false);
    const known = findByBarcode(own.data?.foods ?? [], code);
    if (known) {
      await pick([foodEntry(known)]);
      return;
    }
    if (!settings.offEnabled) {
      notify.error(t("foods.scanner.notFound", { code }));
      return;
    }
    try {
      const food = await lookupBarcode(proxyGet, code, offOptions(settings));
      if (!food) notify.info(t("foods.scanner.notFound", { code }));
      else await pick([externalEntry(food)]);
    } catch (caught) {
      notify.error(
        t("foods.scanner.lookupFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    }
  };

  const toggle = (entry: Entry) => {
    const next = new Map(selected);
    if (!next.delete(entry.key)) next.set(entry.key, entry);
    setSelected(next);
  };

  const isLoading = (!isOutside && own.data === null) || search.isSearching;

  return (
    <AppDialog
      title={t("mealEditor.picker.title")}
      size="lg"
      onClose={onClose}
      confirmText={t("mealEditor.picker.addSelected", {
        count: selected.size,
      })}
      isConfirmDisabled={selected.size === 0}
      isBusy={isBusy}
      onConfirm={
        selected.size > 0 ? () => pick([...selected.values()]) : undefined
      }
    >
      <Stack gap={3}>
        <SegmentedControl<Tab>
          aria-label={t("foods.tabs.label")}
          options={TABS.map((id) => ({
            value: id,
            label: t(`foods.tabs.${id}`),
          }))}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setQuery("");
            setSelected(new Map());
          }}
        />
        {sources.length > 1 && (
          <Row
            gap={1}
            shouldWrap
            role="group"
            aria-label={t("foods.sources.label")}
          >
            {sources.map((id) => (
              <Button
                key={id}
                size="sm"
                variant={source === id ? "secondary" : "ghost"}
                aria-pressed={source === id}
                text={t(`foods.sources.${id}`)}
                onClick={() => {
                  setSource(id);
                }}
              />
            ))}
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
              icon={<Search aria-hidden size={16} />}
              fieldSize="lg"
            />
          </div>
          {tab === "foods" &&
            (settings.offEnabled ||
              own.data?.foods.some((food) => food.barcode)) && (
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
            )}
        </Row>
        {search.results[source as OutsideSource]?.error && (
          <Banner
            text={t("foods.results.failed", {
              source: t(`foods.sources.${source}`),
              message: search.results[source as OutsideSource]?.error ?? "",
            })}
          />
        )}
        {isLoading && entries.length === 0 && (
          <Stack align="center" padding={4}>
            <Spinner label={t("common.loading")} />
          </Stack>
        )}
        {!isLoading && entries.length === 0 && (
          <Text tone="muted">
            {t(
              isOutside && !query.trim()
                ? "foods.empty.typeToSearch"
                : query.trim()
                  ? "foods.empty.noMatch"
                  : "foods.empty.library",
            )}
          </Text>
        )}
        <ul className="m-0 flex flex-col p-0">
          {entries.map((entry) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              selection={{
                isSelected: selected.has(entry.key),
                onToggle: () => {
                  toggle(entry);
                },
              }}
              onPress={() => void pick([entry])}
            />
          ))}
        </ul>
        {search.results[source as OutsideSource]?.hasMore && (
          <Button
            size="sm"
            variant="secondary"
            text={t("foods.results.loadMore")}
            onClick={search.loadMore}
          />
        )}
      </Stack>
      {isScanning && (
        <ScannerDialog
          onCode={(code) => void scanned(code)}
          onClose={() => {
            setIsScanning(false);
          }}
        />
      )}
    </AppDialog>
  );
}
