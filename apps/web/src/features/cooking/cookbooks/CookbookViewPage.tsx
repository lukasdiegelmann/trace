import {
  Button,
  Chip,
  Input,
  Menu,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowDownUp,
  ArrowLeft,
  BookOpen,
  Camera,
  Filter,
  Lock,
  Plus,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useCookingDataChanged } from "../common/dataChanged";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import {
  deleteCookbook,
  getCookbook,
  orderCookbookRecipes,
  removeFromCookbook,
  type CookbookDetail,
  type CookbookRecipe,
} from "../cookbooksApi";
import { assetUrl } from "../lib/assetUrl";
import {
  COOKBOOK_SORTS,
  viewCookbookRecipes,
  type CookbookSort,
} from "../lib/cookbookView";
import { moveEntry } from "../lib/recipeEditor";
import { parseSmartFilter } from "../lib/smartCookbook";
import { RecipeCard } from "../recipes/RecipeCard";

import { AddRecipesDialog, CoverDialog, MoveDialog } from "./CookbookDialogs";

type Open =
  | { name: "cover" }
  | { name: "add" }
  | { name: "move"; recipe: CookbookRecipe }
  | null;

function CookbookView({ id }: { id: number }) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const notify = useNotify();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const loaded = useLoad(useCallback(() => getCookbook(id), [id]));
  useCookingDataChanged(() => void loaded.reload({ isQuiet: true }));
  const cookbook = loaded.data;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CookbookSort>("manual");
  const [open, setOpen] = useState<Open>(null);
  const back = () => void navigate("/cooking?view=cookbooks");

  const header = (title: string, actions?: React.ReactNode) => (
    <Row gap={2} align="center" justify="between">
      <Row gap={2} align="center" canShrink>
        <Button
          size="md"
          variant="ghost"
          aria-label={t("cookbook.back")}
          onClick={back}
        >
          <ArrowLeft aria-hidden size={20} />
        </Button>
        <Text variant="title" as="h1" isTruncated>
          {title}
        </Text>
      </Row>
      <Row gap={1} align="center">
        {actions}
      </Row>
    </Row>
  );

  if (!cookbook) {
    return (
      <Stack gap={4} padding={4}>
        {header(t("cookbook.title"))}
        {loaded.error ? (
          <ErrorState
            message={loaded.error}
            onRetry={() => void loaded.reload()}
          />
        ) : (
          <LoadingState />
        )}
      </Stack>
    );
  }

  const isShared = Boolean(cookbook.shared_with_me);
  const isEditable = !cookbook.is_smart && (!isShared || cookbook.can_edit);
  const effectiveSort = cookbook.is_smart ? "manual" : sort;
  const isReorderable =
    isEditable && !query.trim() && effectiveSort === "manual";
  const shown = viewCookbookRecipes(cookbook.recipes, query, effectiveSort);
  const filter = parseSmartFilter(cookbook.smart_filter);
  const reload = () => loaded.reload({ isQuiet: true });

  const remove = async () => {
    const isConfirmed = await confirm({
      title: t("cookbook.deleteTitle", { name: cookbook.name }),
      message: t("cookbook.deleteMessage", {
        count: cookbook.recipe_count,
      }),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    try {
      await deleteCookbook(id);
      notify.success(t("cookbook.deleted"));
      back();
    } catch (caught) {
      notify.failure(caught, t("recipeCommon.failed"));
    }
  };

  const removeRecipe = async (recipe: CookbookRecipe) => {
    const isConfirmed = await confirm({
      title: t("cookbook.removeTitle", { name: recipe.name }),
      message: t("cookbook.removeMessage"),
      confirmText: t("cookingCommon.remove"),
    });
    if (!isConfirmed) return;
    try {
      await removeFromCookbook(id, recipe.id);
      await reload();
    } catch (caught) {
      notify.failure(caught, t("cookbook.removeFailed"));
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const recipes = moveEntry(cookbook.recipes, index, direction);
    loaded.setData((previous: CookbookDetail) => ({
      ...previous,
      recipes,
    }));
    try {
      await orderCookbookRecipes(
        id,
        recipes.map((recipe) => recipe.id),
      );
    } catch (caught) {
      notify.failure(caught, t("cookbook.orderFailed"));
      await reload();
    }
  };

  const menuFor = (recipe: CookbookRecipe, index: number): MenuItem[] => [
    ...(isReorderable
      ? [
          {
            id: "up",
            text: t("recipeEditor.rows.moveUp"),
            isDisabled: index === 0,
            onSelect: () => void move(index, -1),
          },
          {
            id: "down",
            text: t("recipeEditor.rows.moveDown"),
            isDisabled: index === cookbook.recipes.length - 1,
            onSelect: () => void move(index, 1),
          },
        ]
      : []),
    {
      id: "move",
      text: t("cookbook.moveTitle"),
      onSelect: () => {
        setOpen({ name: "move", recipe });
      },
    },
    {
      id: "remove",
      text: t("cookbook.remove"),
      tone: "danger",
      onSelect: () => void removeRecipe(recipe),
    },
  ];

  const cover = assetUrl(cookbook.cover_image_url);
  const coverImage = (
    <span className="flex size-28 items-center justify-center overflow-hidden rounded-container bg-level-2 text-muted">
      {cover ? (
        <img src={cover} alt="" className="size-full object-cover" />
      ) : (
        <BookOpen aria-hidden size={40} />
      )}
    </span>
  );

  return (
    <Stack gap={4} padding={4}>
      {header(
        cookbook.name,
        isShared ? (
          <Chip
            icon={<Lock aria-hidden size={14} />}
            text={t("recipes.shared.badge")}
            title={
              cookbook.shared_by
                ? t("recipes.shared.by", { name: cookbook.shared_by })
                : t("recipes.shared.withYou")
            }
          />
        ) : (
          <>
            {cookbook.is_smart ? null : (
              <Button
                size="sm"
                variant="primary"
                aria-label={t("cookbook.addRecipes")}
                onClick={() => {
                  setOpen({ name: "add" });
                }}
              >
                <Plus aria-hidden size={18} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("cookbook.delete")}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden size={18} />
            </Button>
          </>
        ),
      )}

      <Row gap={4} align="start">
        {isEditable ? (
          <Stack gap={1} align="center">
            <Pressable
              label={t("cookbook.setCover")}
              onPress={() => {
                setOpen({ name: "cover" });
              }}
            >
              {coverImage}
            </Pressable>
            <Row gap={1} align="center">
              <Camera aria-hidden size={12} />
              <Text variant="caption" tone="muted">
                {t("cookbook.coverTitle")}
              </Text>
            </Row>
          </Stack>
        ) : (
          coverImage
        )}
        <Stack gap={2} canShrink>
          {cookbook.is_smart ? (
            <Chip
              className="self-start"
              tone="accent"
              icon={<Filter aria-hidden size={14} />}
              text={t("cookbook.smart")}
              title={t("cookbook.smartHint")}
            />
          ) : null}
          {cookbook.description ? (
            <Text shouldKeepLineBreaks>{cookbook.description}</Text>
          ) : null}
          <Row gap={1} shouldWrap align="center">
            <Text variant="small" tone="muted">
              {t("recipes.cookbooks.count", {
                count: cookbook.recipe_count,
              })}
            </Text>
            {cookbook.is_smart && filter?.favorites_only ? (
              <Chip text={t("recipes.filters.favorites")} />
            ) : null}
            {cookbook.is_smart
              ? filter?.tags?.map((tag) => <Chip key={tag} text={`#${tag}`} />)
              : null}
          </Row>
        </Stack>
      </Row>

      {cookbook.recipes.length === 0 ? (
        <Stack align="center" gap={3} padding={6}>
          <BookOpen aria-hidden size={40} />
          <Text variant="heading" as="h2">
            {cookbook.is_smart
              ? t("cookbook.emptySmartTitle")
              : t("cookbook.emptyTitle")}
          </Text>
          <Text tone="muted" align="center">
            {cookbook.is_smart
              ? t("cookbook.emptySmartText")
              : t("cookbook.emptyText")}
          </Text>
          {isEditable && !isShared ? (
            <Button
              size="md"
              variant="primary"
              text={t("cookbook.addRecipes")}
              onClick={() => {
                setOpen({ name: "add" });
              }}
            />
          ) : null}
        </Stack>
      ) : null}

      {cookbook.recipes.length > 1 ? (
        <Row gap={2} align="center">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              aria-label={t("cookbook.search")}
              placeholder={t("cookbook.search")}
              icon={<Search aria-hidden size={16} />}
              value={query}
              onValueChange={setQuery}
            />
          </div>
          {cookbook.is_smart ? null : (
            <Menu
              label={t("recipes.sort.label")}
              align="end"
              items={COOKBOOK_SORTS.map((mode) => ({
                id: mode,
                text: t(`cookbook.sort.${mode}`),
                isChecked: mode === sort,
                onSelect: () => {
                  setSort(mode);
                },
              }))}
            >
              <Button
                variant="secondary"
                size="sm"
                text={t(`cookbook.sort.${sort}`)}
              >
                <ArrowDownUp aria-hidden size={14} />
              </Button>
            </Menu>
          )}
        </Row>
      ) : null}

      {cookbook.recipes.length > 0 && shown.length === 0 ? (
        <Stack align="center" gap={2} padding={6}>
          <SearchX aria-hidden size={32} />
          <Text>{t("recipes.noMatch", { query })}</Text>
          <Button
            size="md"
            variant="secondary"
            text={t("recipes.clearFilters")}
            onClick={() => {
              setQuery("");
              setSort("manual");
            }}
          />
        </Stack>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {shown.map((recipe) => {
          const index = cookbook.recipes.indexOf(recipe);
          return recipe.locked ? (
            <div
              key={recipe.id}
              title={t("cookbook.lockedHint")}
              className="flex flex-col items-center gap-2 rounded-container border border-border bg-level-1 p-4 text-center opacity-60"
            >
              <Lock aria-hidden size={28} />
              <Text variant="heading" as="h3">
                {recipe.name}
              </Text>
              <Text variant="caption" tone="muted">
                {t("cookbook.locked")}
              </Text>
            </div>
          ) : (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              menu={isEditable ? menuFor(recipe, index) : undefined}
              onOpen={() => void navigate(`/cooking/recipes/${recipe.id}`)}
            />
          );
        })}
      </div>

      {open?.name === "cover" ? (
        <CoverDialog
          cookbook={cookbook}
          onClose={() => {
            setOpen(null);
          }}
          onSaved={() => {
            setOpen(null);
            void reload();
          }}
        />
      ) : null}
      {open?.name === "add" ? (
        <AddRecipesDialog
          cookbookId={id}
          existing={new Set(cookbook.recipes.map((r) => r.id))}
          onClose={() => {
            setOpen(null);
          }}
          onDone={() => {
            setOpen(null);
            void reload();
          }}
        />
      ) : null}
      {open?.name === "move" ? (
        <MoveDialog
          cookbookId={id}
          recipe={open.recipe}
          onClose={() => {
            setOpen(null);
          }}
          onDone={() => {
            setOpen(null);
            void reload();
          }}
        />
      ) : null}
      {confirmDialog}
    </Stack>
  );
}

/** `/cooking/cookbooks/:id` */
export function CookbookViewPage() {
  const { id } = useParams();
  return <CookbookView key={id} id={Number(id)} />;
}
