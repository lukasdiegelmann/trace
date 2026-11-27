import {
  Button,
  EmptyState,
  Input,
  Menu,
  Row,
  SegmentedControl,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowDownUp,
  BookOpen,
  Plus,
  Search,
  SearchX,
  Trash2,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { PageHeader } from "../common/PageHeader";
import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useCookingDataChanged } from "../common/dataChanged";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import {
  getCookbooks,
  getSharedCookbooks,
  type Cookbook,
} from "../cookbooksApi";
import {
  categoriesOf,
  filterRecipes,
  filterShared,
  mixShared,
  SORT_MODES,
  toSortMode,
} from "../lib/recipeList";
import {
  addMissingToShoppingList,
  createRecipe,
  deleteRecipe,
  duplicateInput,
  getCategories,
  getRecipe,
  getRecipes,
  getSharedRecipes,
  updateRecipe,
  type Recipe,
  type RecipeCategory,
} from "../recipesApi";

import { CookbookCard } from "./CookbookCard";
import { CookbookPickerDialog } from "./CookbookPickerDialog";
import { ImportDialogs, type ImportKind } from "./importers/ImportDialogs";
import { RecipeCard } from "./RecipeCard";
import { ShareCookbookDialog, ShareRecipeDialog } from "./ShareDialogs";
import { shareRecipeCard } from "./ui/shareCard";

type View = "recipes" | "shared" | "cookbooks";

interface ListData {
  recipes: Recipe[];
  shared: Recipe[];
  categories: RecipeCategory[];
  cookbooks: Cookbook[];
  sharedCookbooks: Cookbook[];
}

/** Only the own recipes are required; the rest may fail on its own */
async function loadList(): Promise<ListData> {
  const [recipes, shared, categories, cookbooks, sharedCookbooks] =
    await Promise.all([
      getRecipes(),
      getSharedRecipes().catch(() => []),
      getCategories().catch(() => []),
      getCookbooks().catch(() => []),
      getSharedCookbooks().catch(() => []),
    ]);
  return { recipes, shared, categories, cookbooks, sharedCookbooks };
}

const EMPTY: ListData = {
  recipes: [],
  shared: [],
  categories: [],
  cookbooks: [],
  sharedCookbooks: [],
};

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3";

export function RecipesPage() {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const notify = useNotify();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [params, setParams] = useSearchParams();
  const [sortSetting, setSort] = useSetting("ct", "recipesSort");
  const [shouldMix] = useSetting("ct", "mixSharedIntoRecipes");
  const sort = toSortMode(sortSetting);

  const { data, error, isLoading, reload, setData } = useLoad(loadList);
  useCookingDataChanged(() => void reload({ isQuiet: true }));
  const lists = data ?? EMPTY;
  const view: View =
    params.get("view") === "cookbooks"
      ? "cookbooks"
      : params.get("view") === "shared"
        ? "shared"
        : "recipes";
  const categorySlug = params.get("category") ?? "";

  const [query, setQuery] = useState("");
  const [isFavoritesOnly, setIsFavoritesOnly] = useState(false);
  const [sharedCategory, setSharedCategory] = useState("");
  const [selection, setSelection] = useState<Set<number> | null>(null);
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [sharing, setSharing] = useState<Recipe | null>(null);
  const [sharingCookbook, setSharingCookbook] = useState<Cookbook | null>(null);
  const [pickingFor, setPickingFor] = useState<Recipe[] | null>(null);

  const setParam = (values: Record<string, string>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const mixed = useMemo(
    () => mixShared(lists.recipes, lists.shared, shouldMix),
    [lists.recipes, lists.shared, shouldMix],
  );
  const filtered = filterRecipes(mixed, {
    query,
    categorySlug,
    isFavoritesOnly,
    sort,
  });
  const filteredShared = filterShared(lists.shared, {
    query,
    categorySlug: sharedCategory,
    sort,
  });

  const open = (id: number) => void navigate(`/cooking/recipes/${id}`);
  const replaceRecipe = (next: Recipe) => {
    setData((previous) => ({
      ...previous,
      recipes: previous.recipes.map((r) => (r.id === next.id ? next : r)),
    }));
  };
  const removeRecipes = (ids: ReadonlySet<number>) => {
    setData((previous) => ({
      ...previous,
      recipes: previous.recipes.filter((r) => !ids.has(r.id)),
    }));
  };

  /** Runs an action and reports its failure */
  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (caught) {
      notify.failure(caught, t("recipeCommon.failed"));
    }
  };

  const toggleSelected = (id: number) => {
    setSelection((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size > 0 ? next : null;
    });
  };

  const remove = async (recipe: Recipe) => {
    const isConfirmed = await confirm({
      title: t("recipes.delete.title"),
      message: t("recipes.delete.message", { name: recipe.name }),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await attempt(async () => {
      await deleteRecipe(recipe.id);
      removeRecipes(new Set([recipe.id]));
      notify.info(t("recipes.delete.done"));
    });
  };

  const removeSelected = async (ids: number[]) => {
    const isConfirmed = await confirm({
      title: t("recipes.delete.manyTitle", { count: ids.length }),
      message: t("recipes.delete.manyMessage"),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    const deleted = new Set<number>();
    for (const id of ids) {
      try {
        await deleteRecipe(id);
        deleted.add(id);
      } catch {
        // counted below; the recipe stays in the list
      }
    }
    removeRecipes(deleted);
    setSelection(null);
    const failed = ids.length - deleted.size;
    if (failed > 0) {
      notify.error(t("recipes.delete.partly", { count: deleted.size, failed }));
    } else {
      notify.info(t("recipes.delete.manyDone", { count: deleted.size }));
    }
  };

  const menuFor = (recipe: Recipe): MenuItem[] => [
    {
      id: "open",
      text: t("recipes.menu.open"),
      onSelect: () => {
        open(recipe.id);
      },
    },
    {
      id: "favorite",
      text: recipe.favorite
        ? t("recipes.menu.unfavorite")
        : t("recipes.menu.favorite"),
      onSelect: () =>
        void attempt(async () => {
          replaceRecipe(
            await updateRecipe(recipe, { favorite: !recipe.favorite }),
          );
        }),
    },
    {
      id: "cookbook",
      text: t("recipes.menu.cookbook"),
      onSelect: () => {
        setPickingFor([recipe]);
      },
    },
    {
      id: "share-link",
      text: recipe.share_token
        ? t("recipes.menu.manageLink")
        : t("recipes.menu.createLink"),
      onSelect: () => {
        setSharing(recipe);
      },
    },
    {
      id: "plan",
      text: t("recipes.menu.plan"),
      onSelect: () => void navigate(`/cooking/diary?plan=${recipe.id}`),
    },
    {
      id: "shop",
      text: t("recipes.menu.shop"),
      onSelect: () =>
        void attempt(async () => {
          const { added } = await addMissingToShoppingList(recipe.id);
          notify.info(t("recipes.menu.shopped", { count: added }));
        }),
    },
    {
      id: "duplicate",
      text: t("recipes.menu.duplicate"),
      onSelect: () =>
        void attempt(async () => {
          const copy = await createRecipe(
            duplicateInput(
              await getRecipe(recipe.id),
              t("recipes.menu.copySuffix"),
            ),
          );
          setData((previous) => ({
            ...previous,
            recipes: [copy, ...previous.recipes],
          }));
          notify.info(t("recipes.menu.duplicated"));
        }),
    },
    {
      id: "card",
      text: t("recipes.menu.card"),
      onSelect: () =>
        void attempt(async () => {
          notify.info(t("recipeCommon.preparingShare"));
          const result = await shareRecipeCard(await getRecipe(recipe.id), t);
          if (result.isDownloaded) {
            notify.info(
              t("recipeCommon.savedCard", { count: result.count ?? 1 }),
            );
          }
        }),
    },
    {
      id: "select",
      text: t("recipes.menu.select"),
      onSelect: () => {
        setSelection(new Set([recipe.id]));
      },
    },
    {
      id: "delete",
      text: t("cookingCommon.delete"),
      tone: "danger",
      hasSeparatorBefore: true,
      onSelect: () => void remove(recipe),
    },
  ];

  const addItems: MenuItem[] = (
    ["manual", "url", "file", "cookbook", "paste"] as const
  ).map((kind) => ({
    id: kind,
    text: t(`recipes.add.${kind}`),
    onSelect: () => {
      if (kind === "manual") void navigate("/cooking/recipes/new");
      else setImportKind(kind);
    },
  }));

  const sortMenu = (
    <Menu
      label={t("recipes.sort.label")}
      items={SORT_MODES.map((mode) => ({
        id: mode,
        text: t(`recipes.sort.${mode}`),
        isChecked: mode === sort,
        onSelect: () => {
          setSort(mode);
        },
      }))}
    >
      <Button variant="secondary" size="sm" text={t(`recipes.sort.${sort}`)}>
        <ArrowDownUp aria-hidden size={14} />
      </Button>
    </Menu>
  );

  const searchField = (label: string) => (
    <Input
      type="search"
      aria-label={label}
      placeholder={label}
      icon={<Search aria-hidden size={16} />}
      value={query}
      onValueChange={setQuery}
    />
  );

  const filterChip = (
    key: string,
    text: string,
    isActive: boolean,
    onClick: () => void,
    color?: string | null,
  ) => (
    <Button
      key={key}
      size="sm"
      variant={isActive ? "secondary" : "ghost"}
      aria-pressed={isActive}
      text={text}
      onClick={onClick}
    >
      {color ? (
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : undefined}
    </Button>
  );

  const noMatch = (
    <EmptyState
      icon={<SearchX aria-hidden size={20} />}
      text={
        query.trim()
          ? t("recipes.noMatch", { query: query.trim() })
          : t("recipes.noFilterMatch")
      }
      action={{
        text: t("recipes.clearFilters"),
        onClick: () => {
          setQuery("");
          setIsFavoritesOnly(false);
          setSharedCategory("");
          setParam({ category: "" });
        },
      }}
    />
  );

  const renderRecipes = () => {
    if (mixed.length === 0) {
      return (
        <Stack align="center" gap={3} padding={6}>
          <Utensils aria-hidden size={40} />
          <Text variant="heading" as="h2">
            {t("recipes.empty.title")}
          </Text>
          <Text tone="muted" align="center">
            {t("recipes.empty.text")}
          </Text>
          <Menu label={t("recipes.add.title")} items={addItems}>
            <Button
              size="md"
              variant="primary"
              text={t("recipes.empty.action")}
            />
          </Menu>
        </Stack>
      );
    }
    return (
      <>
        {searchField(t("recipes.search"))}
        <Row gap={2} shouldWrap align="center">
          {filterChip(
            "favorites",
            t("recipes.filters.favorites"),
            isFavoritesOnly,
            () => {
              setIsFavoritesOnly(!isFavoritesOnly);
            },
          )}
          {lists.categories.length > 0 ? (
            <>
              {filterChip(
                "all",
                t("recipes.filters.all"),
                !categorySlug,
                () => {
                  setParam({ category: "" });
                },
              )}
              {lists.categories.map((category) =>
                filterChip(
                  category.slug,
                  category.name,
                  categorySlug === category.slug,
                  () => {
                    setParam({
                      category:
                        categorySlug === category.slug ? "" : category.slug,
                    });
                  },
                  category.color,
                ),
              )}
            </>
          ) : null}
          {sortMenu}
        </Row>
        {filtered.length === 0 ? (
          noMatch
        ) : (
          <div className={GRID}>
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                menu={recipe.shared_with_me ? undefined : menuFor(recipe)}
                isSelected={
                  selection && !recipe.shared_with_me
                    ? selection.has(recipe.id)
                    : undefined
                }
                onOpen={() => {
                  if (selection && !recipe.shared_with_me) {
                    toggleSelected(recipe.id);
                  } else open(recipe.id);
                }}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  const renderShared = () => {
    if (lists.shared.length === 0) {
      return (
        <Stack align="center" gap={3} padding={6}>
          <Users aria-hidden size={40} />
          <Text variant="heading" as="h2">
            {t("recipes.shared.emptyTitle")}
          </Text>
          <Text tone="muted">{t("recipes.shared.emptyText")}</Text>
        </Stack>
      );
    }
    return (
      <>
        {searchField(t("recipes.shared.search"))}
        <Row gap={2} shouldWrap align="center">
          {filterChip("all", t("recipes.filters.all"), !sharedCategory, () => {
            setSharedCategory("");
          })}
          {categoriesOf(lists.shared).map((category) =>
            filterChip(
              category.slug,
              category.name,
              sharedCategory === category.slug,
              () => {
                setSharedCategory(
                  sharedCategory === category.slug ? "" : category.slug,
                );
              },
              category.color,
            ),
          )}
          {sortMenu}
        </Row>
        {filteredShared.length === 0 ? (
          noMatch
        ) : (
          <div className={GRID}>
            {filteredShared.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={{ ...recipe, shared_with_me: true }}
                isCompactMeta
                onOpen={() => {
                  open(recipe.id);
                }}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  const renderCookbooks = () => {
    if (lists.cookbooks.length + lists.sharedCookbooks.length === 0) {
      return (
        <Stack align="center" gap={3} padding={6}>
          <BookOpen aria-hidden size={40} />
          <Text variant="heading" as="h2">
            {t("recipes.cookbooks.emptyTitle")}
          </Text>
          <Text tone="muted" align="center">
            {t("recipes.cookbooks.emptyText")}
          </Text>
          <Button
            size="md"
            variant="primary"
            text={t("recipes.cookbooks.create")}
            onClick={() => void navigate("/cooking/manage/cookbooks")}
          />
        </Stack>
      );
    }
    return (
      <>
        <Row justify="end">
          <Button
            variant="ghost"
            size="sm"
            text={t("recipes.cookbooks.manage")}
            onClick={() => void navigate("/cooking/manage/cookbooks")}
          />
        </Row>
        <div className={GRID}>
          {[...lists.cookbooks, ...lists.sharedCookbooks].map((cookbook) => (
            <CookbookCard
              key={cookbook.id}
              cookbook={cookbook}
              onOpen={() => void navigate(`/cooking/cookbooks/${cookbook.id}`)}
              onShare={
                cookbook.shared_with_me
                  ? undefined
                  : () => {
                      setSharingCookbook(cookbook);
                    }
              }
            />
          ))}
        </div>
      </>
    );
  };

  const tabs: { value: View; label: string }[] = [
    {
      value: "recipes",
      label: `${t("recipes.tabs.recipes")} ${lists.recipes.length}`,
    },
    ...(lists.shared.length > 0 || view === "shared"
      ? [
          {
            value: "shared" as const,
            label: `${t("recipes.tabs.shared")} ${lists.shared.length}`,
          },
        ]
      : []),
    {
      value: "cookbooks",
      label: `${t("recipes.tabs.cookbooks")} ${lists.cookbooks.length}`,
    },
  ];

  const selected = selection ? [...selection] : [];

  return (
    <Stack gap={4} padding={4}>
      <PageHeader
        title={
          selection
            ? t("recipes.select.count", { count: selected.length })
            : t("recipes.title")
        }
      >
        {selection ? (
          <>
            <Button
              size="md"
              variant="secondary"
              text={t("recipes.menu.cookbook")}
              onClick={() => {
                setPickingFor(lists.recipes.filter((r) => selection.has(r.id)));
              }}
            >
              <BookOpen aria-hidden size={16} />
            </Button>
            <Button
              size="md"
              variant="danger"
              text={t("cookingCommon.delete")}
              onClick={() => void removeSelected(selected)}
            >
              <Trash2 aria-hidden size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("recipes.select.exit")}
              onClick={() => {
                setSelection(null);
              }}
            >
              <X aria-hidden size={18} />
            </Button>
          </>
        ) : (
          <Menu label={t("recipes.add.title")} items={addItems} align="end">
            <Button
              size="md"
              variant="primary"
              aria-label={t("recipes.add.title")}
            >
              <Plus aria-hidden size={18} />
            </Button>
          </Menu>
        )}
      </PageHeader>

      {mixed.length + lists.cookbooks.length + lists.shared.length > 0 ? (
        <SegmentedControl
          aria-label={t("recipes.tabs.label")}
          options={tabs}
          value={view}
          onChange={(next) => {
            setSelection(null);
            setParam(
              next === "cookbooks"
                ? { view: next, category: "" }
                : { view: next === "recipes" ? "" : next },
            );
          }}
        />
      ) : null}

      {isLoading && !data ? (
        <LoadingState />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : view === "recipes" ? (
        renderRecipes()
      ) : view === "shared" ? (
        renderShared()
      ) : (
        renderCookbooks()
      )}

      {pickingFor ? (
        <CookbookPickerDialog
          cookbooks={lists.cookbooks}
          recipeIds={pickingFor.map((r) => r.id)}
          recipeName={pickingFor.length === 1 ? pickingFor[0]?.name : undefined}
          onClose={() => {
            setPickingFor(null);
          }}
          onDone={() => {
            setPickingFor(null);
            setSelection(null);
            void reload({ isQuiet: true });
          }}
        />
      ) : null}
      {sharing ? (
        <ShareRecipeDialog
          recipe={sharing}
          onClose={() => {
            setSharing(null);
          }}
          onTokenChange={(token) => {
            replaceRecipe({ ...sharing, share_token: token });
          }}
        />
      ) : null}
      {sharingCookbook ? (
        <ShareCookbookDialog
          cookbook={sharingCookbook}
          onClose={() => {
            setSharingCookbook(null);
          }}
        />
      ) : null}
      <ImportDialogs
        kind={importKind}
        onClose={() => {
          setImportKind(null);
        }}
        onImported={() => void reload({ isQuiet: true })}
      />
      {confirmDialog}
    </Stack>
  );
}
