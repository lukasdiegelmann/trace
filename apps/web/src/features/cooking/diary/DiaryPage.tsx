import {
  Box,
  Button,
  Chip,
  Input,
  Pressable,
  Row,
  SegmentedControl,
  Stack,
  Stat,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Filter,
  FilterX,
  Images,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { EmptyNotice } from "../common/EmptyNotice";
import { PageHeader } from "../common/PageHeader";
import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useCookingDataChanged } from "../common/dataChanged";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import { diaryApi, type CookEntry } from "../diaryApi";
import {
  diaryRange,
  filterEntries,
  groupByDate,
  monthCells,
  photoTiles,
  startOfMonth,
  type DiaryView,
  type MealType,
} from "../lib/cookDiary";
import { isoDate, shortDate, toDate } from "../lib/relativeTime";
import type { RecipeSummary } from "../manageApi";
import { MealChips, PlanDialog, RecipeFilterDialog } from "./DiaryDialogs";
import { DiaryListView } from "./DiaryListView";
import { Heatmap } from "./Heatmap";
import { MonthView } from "./MonthView";
import { Lightbox, PhotoGrid } from "./PhotoViews";

const HEATMAP_DAYS = 364;
const STATS_RETRY_MS = 2000;

/** One retry: a passing failure used to hide the dashboard all session */
async function loadStats() {
  try {
    return await diaryApi.stats();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, STATS_RETRY_MS));
    return diaryApi.stats();
  }
}

function loadHeatmap() {
  return diaryApi.heatmap(HEATMAP_DAYS).catch(() => []);
}

type DialogState =
  | { kind: "plan" }
  | { kind: "filter" }
  | { kind: "photo"; entry: CookEntry; index: number }
  | null;

export function DiaryPage() {
  const { t, i18n } = useTranslation("cooking");
  const navigate = useNavigate();
  const notify = useNotify();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [view, setView] = useState<DiaryView>("list");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null);
  const [meal, setMeal] = useState<MealType | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isBusy, setIsBusy] = useState(false);

  const today = isoDate(new Date());
  const range = diaryRange(view, month, toDate(today));
  // One string: the list and photo views share a range, and no reload.
  const rangeKey = `${range.from} ${range.to}`;
  const load = useCallback(() => {
    const [from, to] = rangeKey.split(" ");
    return diaryApi.list(from, to);
  }, [rangeKey]);
  const { data, error, isLoading, reload } = useLoad(load);
  const stats = useLoad(loadStats);
  const heatmap = useLoad(loadHeatmap);

  const reloadAll = async () => {
    await Promise.all([
      reload({ isQuiet: true }),
      stats.reload({ isQuiet: true }),
      heatmap.reload({ isQuiet: true }),
    ]);
  };
  useCookingDataChanged(() => void reloadAll());

  const entries = data ?? [];
  const visible = filterEntries(entries, {
    recipeId: recipe?.id ?? null,
    meal,
    query,
  });
  const isFiltered = Boolean(recipe) || meal !== null || query.trim() !== "";
  const tiles = photoTiles(visible);

  const close = () => {
    setDialog(null);
  };
  const openRecipe = (entry: CookEntry) => {
    if (entry.recipe_id !== null) {
      void navigate(`/cooking/recipes/${entry.recipe_id}`);
    }
  };

  const markCooked = async (entry: CookEntry) => {
    try {
      await diaryApi.markCooked(entry.id);
      notify.success(t("diary.toast.markedCooked"));
      await reloadAll();
    } catch (caught) {
      notify.failure(caught, t("diary.toast.updateFailed"));
    }
  };

  const remove = async (entry: CookEntry) => {
    const isConfirmed = await confirm({
      title: t(
        entry.kind === "planned"
          ? "diary.confirm.cancelPlanned"
          : "diary.confirm.delete",
      ),
      message: t("diary.confirm.message", {
        name: entry.recipe_name || t("diary.recipeFallback"),
        date: shortDate(entry.date, i18n.language),
      }),
      confirmText: t("cookingCommon.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    try {
      await diaryApi.remove(entry.id);
      notify.success(t("diary.toast.removed"));
      await reloadAll();
    } catch (caught) {
      notify.failure(caught, t("diary.toast.deleteFailed"));
    }
  };

  const actionsFor = (entry: CookEntry): MenuItem[] => [
    ...(entry.recipe_id === null
      ? []
      : [
          {
            id: "open",
            text: t("diary.openRecipe"),
            onSelect: () => {
              openRecipe(entry);
            },
          },
        ]),
    ...(entry.kind === "planned"
      ? [
          {
            id: "cooked",
            text: t("diary.markCooked"),
            onSelect: () => void markCooked(entry),
          },
        ]
      : []),
    {
      id: "delete",
      text: t("cookingCommon.delete"),
      tone: "danger" as const,
      onSelect: () => void remove(entry),
    },
  ];

  const numbers = stats.data;
  const hasStats = Boolean(numbers && numbers.total_cooks > 0);
  const hasHeatmap = (heatmap.data?.length ?? 0) > 0;
  const tile = (label: string, value: string | number) => (
    <Box border="all" radius="lg" padding={3}>
      <Stat label={label} value={value} />
    </Box>
  );

  return (
    <Stack gap={4} padding={4}>
      <PageHeader title={t("diary.title")}>
        <Button
          variant="primary"
          size="md"
          text={t("diary.plan.open")}
          onClick={() => {
            setDialog({ kind: "plan" });
          }}
        >
          <CalendarPlus aria-hidden size={18} />
        </Button>
      </PageHeader>

      {hasStats || hasHeatmap ? (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          {hasHeatmap ? (
            <div className="min-w-0 xl:flex-1">
              <Heatmap
                data={heatmap.data ?? []}
                onSelect={(date) => {
                  setMonth(startOfMonth(toDate(date)));
                  setView("month");
                }}
              />
            </div>
          ) : null}
          {numbers && hasStats ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {tile(t("diary.stats.thisWeek"), numbers.cooks_this_week)}
              {tile(t("diary.stats.currentStreak"), numbers.current_streak)}
              {tile(t("diary.stats.longestStreak"), numbers.longest_streak)}
              {numbers.top_recipe ? (
                <Pressable
                  onPress={() =>
                    void navigate(
                      `/cooking/recipes/${numbers.top_recipe?.id ?? 0}`,
                    )
                  }
                  className="rounded-container border! border-border! p-3 text-start hover:bg-level-3!"
                >
                  <Stat
                    label={t("diary.stats.topRecipe", {
                      count: numbers.top_recipe.count,
                    })}
                    value={numbers.top_recipe.name}
                  />
                </Pressable>
              ) : (
                tile(t("diary.stats.thisMonth"), numbers.cooks_this_month)
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <Stack gap={3}>
        <Row gap={3} align="center" justify="between" shouldWrap>
          <SegmentedControl<DiaryView>
            aria-label={t("diary.views.label")}
            variant="pill"
            value={view}
            options={(["list", "month", "photos"] as const).map((value) => ({
              value,
              label: t(`diary.views.${value}`),
            }))}
            onChange={setView}
          />
          {view === "month" ? (
            <Row gap={2} align="center">
              <Button
                size="sm"
                aria-label={t("diary.month.previous")}
                onClick={() => {
                  setMonth(startOfMonth(month, -1));
                }}
              >
                <ChevronLeft aria-hidden size={18} />
              </Button>
              <Text role="status">
                {month.toLocaleDateString(i18n.language, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Button
                size="sm"
                aria-label={t("diary.month.next")}
                onClick={() => {
                  setMonth(startOfMonth(month, 1));
                }}
              >
                <ChevronRight aria-hidden size={18} />
              </Button>
            </Row>
          ) : null}
        </Row>
        <Row gap={2} align="end">
          <Input
            type="search"
            label={t("diary.search")}
            value={query}
            wrapperClassName="min-w-0 flex-1"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {query ? (
            <Button
              size="md"
              aria-label={t("diary.clearSearch")}
              onClick={() => {
                setQuery("");
              }}
            >
              <X aria-hidden size={18} />
            </Button>
          ) : null}
        </Row>
        <Row gap={2} align="center" shouldWrap>
          {recipe ? (
            <Chip
              tone="accent"
              icon={<Filter aria-hidden size={12} />}
              text={recipe.name}
              actions={[
                {
                  label: t("diary.clearRecipeFilter"),
                  icon: <X aria-hidden size={12} />,
                  onClick: () => {
                    setRecipe(null);
                  },
                },
              ]}
            />
          ) : (
            <Button
              size="sm"
              variant="secondary"
              text={t("diary.filterByRecipe")}
              onClick={() => {
                setDialog({ kind: "filter" });
              }}
            >
              <Filter aria-hidden size={14} />
            </Button>
          )}
          <MealChips
            value={meal}
            onChange={setMeal}
            label={t("diary.mealFilter")}
          />
        </Row>
      </Stack>

      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data || isLoading ? (
        <LoadingState />
      ) : entries.length === 0 && view !== "month" ? (
        <EmptyNotice
          icon={<CalendarDays aria-hidden size={32} />}
          title={t("diary.empty.title")}
          text={t("diary.empty.text")}
          actionText={t("diary.plan.open")}
          onAction={() => {
            setDialog({ kind: "plan" });
          }}
        />
      ) : isFiltered && visible.length === 0 ? (
        <EmptyNotice
          icon={<FilterX aria-hidden size={32} />}
          title={t("diary.noMatches.title")}
          text={t("diary.noMatches.text")}
          actionText={t("diary.noMatches.clear")}
          onAction={() => {
            setRecipe(null);
            setMeal(null);
            setQuery("");
          }}
        />
      ) : view === "list" ? (
        <DiaryListView
          days={groupByDate(visible, today)}
          onOpen={openRecipe}
          actionsFor={actionsFor}
        />
      ) : view === "month" ? (
        <MonthView
          cells={monthCells(
            month,
            visible,
            today,
            i18n.language.startsWith("de") ? 1 : 0,
          )}
          onOpen={openRecipe}
        />
      ) : tiles.length === 0 ? (
        <EmptyNotice
          icon={<Images aria-hidden size={32} />}
          title={t("diary.noPhotos.title")}
          text={t("diary.noPhotos.text")}
        />
      ) : (
        <PhotoGrid
          tiles={tiles}
          onOpen={(photo) => {
            setDialog({
              kind: "photo",
              entry: photo.entry,
              index: photo.index,
            });
          }}
        />
      )}

      {dialog?.kind === "plan" ? (
        <PlanDialog
          isBusy={isBusy}
          onClose={close}
          onPlan={(plan) => {
            void (async () => {
              setIsBusy(true);
              try {
                await diaryApi.plan(plan);
                notify.success(t("diary.toast.planned"));
                close();
                await reloadAll();
              } catch (caught) {
                notify.failure(caught, t("diary.toast.planFailed"));
              } finally {
                setIsBusy(false);
              }
            })();
          }}
        />
      ) : null}
      {dialog?.kind === "filter" ? (
        <RecipeFilterDialog
          selectedId={recipe?.id ?? null}
          onClose={close}
          onPick={(picked) => {
            setRecipe(picked);
            close();
          }}
        />
      ) : null}
      {dialog?.kind === "photo" ? (
        <Lightbox
          entry={dialog.entry}
          initialIndex={dialog.index}
          onClose={close}
          onOpenRecipe={() => {
            openRecipe(dialog.entry);
          }}
        />
      ) : null}
      {confirmDialog}
    </Stack>
  );
}
