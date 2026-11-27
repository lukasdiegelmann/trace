import {
  Avatar,
  Banner,
  Button,
  Chip,
  ExternalLink,
  Menu,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ChefHat,
  Clock,
  CookingPot,
  EyeOff,
  Flame,
  Heart,
  History,
  Hourglass,
  Lock,
  Pencil,
  Scale,
  Share2,
  Timer,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { NutritionFactsBox } from "../../common/NutritionFactsBox";
import { ErrorState, LoadingState } from "../../common/states";
import { useConfirm } from "../../common/useConfirm";
import { useCookingDataChanged } from "../../common/dataChanged";
import { useLoad } from "../../common/useLoad";
import { useNotify } from "../../common/useNotify";
import { assetUrl } from "../../lib/assetUrl";
import { domainFromUrl, formatDate, formatUpdated } from "../../lib/dates";
import { formatDuration, totalMinutes } from "../../lib/duration";
import { computeRecipeMass } from "../../lib/recipeNutrition";
import { relativeTime } from "../../lib/relativeTime";
import {
  createShareToken,
  deleteCook,
  deleteRecipe,
  getCooks,
  getPantry,
  getRecipe,
  getVersions,
  logCook,
  markVersionsSeen,
  publicRecipeUrl,
  restoreVersion,
  stepsOf,
  updateCook,
  updateRecipe,
  type Cook,
  type CookInput,
  type Recipe,
  type RecipeVersion,
} from "../../recipesApi";
import {
  cookStore,
  describeCook,
  endCook,
  readChecks,
  startCook,
  writeChecks,
  type Checks,
} from "../../timers/cooks";
import { startTimer } from "../../timers/timers";
import { useWakeLock } from "../../timers/useWakeLock";
import { shareRecipeCard } from "../ui/shareCard";
import { StarRating } from "../ui/StarRating";
import { useCtUser } from "../ui/useCtUser";

import { Comments } from "./Comments";
import { CookHistory } from "./CookHistory";
import { CookLogDialog } from "./CookLogDialog";
import { IngredientsSection } from "./IngredientsSection";
import { RecomputeNutrition } from "./RecomputeNutrition";
import { RichText } from "./RichText";
import { StepsSection } from "./StepsSection";
import { ToolList } from "./ToolList";
import { VersionsSheet } from "./VersionsSheet";
import { VideoBlock } from "./VideoBlock";

const NO_CHECKS: Checks = { ingredients: [], steps: [], tools: [] };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Row gap={2} align="center">
      <span className="text-muted">{icon}</span>
      <Stack gap={0}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Text>{value}</Text>
      </Stack>
    </Row>
  );
}

/** Everything around the recipe that may be missing without breaking it */
function useExtras(recipe: Recipe | undefined, canEdit: boolean) {
  const id = recipe?.id;
  const cooks = useLoad(
    useCallback(
      () => (id ? getCooks(id).catch(() => []) : Promise.resolve([])),
      [id],
    ),
  );
  const versions = useLoad(
    useCallback(
      () =>
        id && canEdit
          ? getVersions(id).catch(() => [])
          : Promise.resolve([] as RecipeVersion[]),
      [id, canEdit],
    ),
  );
  const pantry = useLoad(useCallback(() => getPantry().catch(() => []), []));
  useCookingDataChanged(() => {
    void cooks.reload({ isQuiet: true });
    void pantry.reload({ isQuiet: true });
  });
  const pantryById = useMemo(
    () => new Map((pantry.data ?? []).map((row) => [row.id, row])),
    [pantry.data],
  );
  return { cooks, versions, pantryById };
}

function RecipeView({ id }: { id: number }) {
  const { t, i18n } = useTranslation("cooking");
  const navigate = useNavigate();
  const notify = useNotify();
  const user = useCtUser();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [dateFormat] = useSetting("ct", "dateFormat");

  const loaded = useLoad(useCallback(() => getRecipe(id), [id]));
  useCookingDataChanged(() => void loaded.reload({ isQuiet: true }));
  const recipe = loaded.data;
  const canEdit =
    recipe !== undefined &&
    (recipe.can_edit === true ||
      recipe.user_id === null ||
      recipe.user_id === user.id ||
      user.isAdmin);
  const isOwner =
    recipe !== undefined &&
    (recipe.user_id === null || recipe.user_id === user.id);
  // What the server accepts: it ignores a Sous Chef's rating and
  // favourite, and logs cooks only for the owner or a group recipe.
  const canRate = isOwner || (recipe !== undefined && user.isAdmin);
  const canLogCook = isOwner || recipe?.visibility === "group";
  const { cooks, versions, pantryById } = useExtras(recipe, canEdit);

  const cooksRunning = useSyncExternalStore(cookStore.subscribe, cookStore.get);
  const isCooking = Boolean(cooksRunning[id]);
  const [storedChecks, setChecks] = useState(() => readChecks(id));
  const checks = isCooking ? storedChecks : NO_CHECKS;
  useWakeLock(isCooking);

  const [scale, setScale] = useState(1);
  const [cookLog, setCookLog] = useState<{ editing: Cook | null } | null>(null);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const name = recipe?.name;
  const image = recipe?.img_url ?? "";
  useEffect(() => {
    if (name) describeCook(id, name, image);
  }, [id, name, image]);

  if (!recipe) {
    return loaded.error ? (
      <ErrorState message={loaded.error} onRetry={() => void loaded.reload()} />
    ) : (
      <LoadingState />
    );
  }

  const steps = stepsOf(recipe);
  const mass = computeRecipeMass(recipe, pantryById);
  const history = versions.data ?? [];
  const unseen = history.filter(
    (version) => version.reason === "conflict" && !version.seen,
  ).length;

  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (caught) {
      notify.failure(caught, t("recipeCommon.failed"));
    }
  };
  const apply = (next: Recipe) => {
    // The update's answer has no viewer rights; keep the loaded ones.
    loaded.setData((previous) => ({ ...previous, ...next }));
  };
  const patch = (values: Partial<Recipe>) =>
    attempt(async () => {
      apply(await updateRecipe(recipe, values));
    });

  const changeChecks = (next: Checks) => {
    setChecks(next);
    writeChecks(id, next);
  };
  const start = () => {
    setChecks(NO_CHECKS);
    startCook(id, recipe.name, recipe.img_url ?? "");
  };
  const stop = () => {
    endCook(id);
    setChecks(NO_CHECKS);
  };

  const remove = async () => {
    const isConfirmed = await confirm({
      title: t("recipes.delete.title"),
      message: t("recipes.delete.message", { name: recipe.name }),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await attempt(async () => {
      await deleteRecipe(id);
      endCook(id);
      notify.info(t("recipes.delete.done"));
      await navigate("/cooking");
    });
  };

  const refreshCooks = async () => {
    await cooks.reload({ isQuiet: true });
    await loaded.reload({ isQuiet: true });
  };

  const saveCook = async (input: CookInput) => {
    const editing = cookLog?.editing;
    if (editing) {
      await updateCook(id, editing.id, input);
      notify.info(t("recipeView.cookLog.updated"));
    } else {
      await logCook(id, input);
      notify.info(t("recipeView.cookLog.logged"));
      if (isCooking) stop();
    }
    setCookLog(null);
    await refreshCooks();
  };

  const removeCook = async (cook: Cook) => {
    const isConfirmed = await confirm({
      title: t("recipeView.cookLog.deleteTitle"),
      message: t("recipeView.cookLog.deleteMessage"),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await attempt(async () => {
      await deleteCook(id, cook.id);
      await refreshCooks();
    });
  };

  const markSeen = () => {
    if (unseen === 0) return;
    versions.setData((previous) =>
      previous.map((version) => ({ ...version, seen: true })),
    );
    // Failing only means the notice shows again next time.
    void markVersionsSeen(id).catch(() => {});
  };
  const openVersions = () => {
    setIsVersionsOpen(true);
    markSeen();
  };

  const restore = async (version: RecipeVersion) => {
    const isConfirmed = await confirm({
      title: t("recipeView.versions.confirmTitle"),
      message: t("recipeView.versions.confirmMessage"),
      confirmText: t("recipeView.versions.restore"),
    });
    if (!isConfirmed) return;
    setIsRestoring(true);
    await attempt(async () => {
      await restoreVersion(id, version.id);
      await loaded.reload({ isQuiet: true });
      await versions.reload({ isQuiet: true });
      setIsVersionsOpen(false);
      notify.info(t("recipeView.versions.restored"));
    });
    setIsRestoring(false);
  };

  const shareLink = () =>
    attempt(async () => {
      let token = recipe.share_token;
      if (!token) {
        token = (await createShareToken(id)).share_token;
        apply({ ...recipe, share_token: token });
      }
      const url = publicRecipeUrl(token);
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: recipe.name, url });
          return;
        } catch (caught) {
          if (caught instanceof Error && caught.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      notify.info(t("recipes.share.copied"));
    });

  const shareItems: MenuItem[] = [
    {
      id: "card",
      text: t("recipes.menu.card"),
      onSelect: () =>
        void attempt(async () => {
          notify.info(t("recipeCommon.preparingShare"));
          const result = await shareRecipeCard(recipe, t);
          if (result.isDownloaded) {
            notify.info(
              t("recipeCommon.savedCard", { count: result.count ?? 1 }),
            );
          }
        }),
    },
    // Only the owner may create the link; others can pass an existing one on.
    ...(isOwner || recipe.share_token
      ? [
          {
            id: "link",
            text: recipe.share_token
              ? t("recipeView.copyLink")
              : t("recipes.menu.createLink"),
            onSelect: () => void shareLink(),
          },
        ]
      : []),
  ];

  const total = totalMinutes(recipe);
  const author =
    recipe.created_by_full_name || recipe.created_by_username || "";
  const domain = domainFromUrl(recipe.source_url);
  const isSharedView =
    recipe.user_id !== null && user.id !== null && recipe.user_id !== user.id;

  return (
    <Stack gap={5} padding={4} className="mx-auto w-full max-w-6xl">
      <Row justify="between" align="center" gap={2} shouldWrap>
        <Row gap={2} align="center">
          {isCooking ? (
            <Chip
              tone="accent"
              icon={<ChefHat aria-hidden size={14} />}
              text={t("recipeView.cookMode")}
            />
          ) : null}
          {isSharedView && !isCooking ? (
            <Chip
              icon={<Lock aria-hidden size={14} />}
              text={t("recipes.shared.badge")}
            />
          ) : null}
        </Row>
        <Row gap={1} className="print:hidden">
          {isCooking ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("recipeView.endCooking")}
              onClick={stop}
            >
              <X aria-hidden size={20} />
            </Button>
          ) : (
            <>
              <Menu
                label={t("recipes.share.title")}
                items={shareItems}
                align="end"
              >
                <Button
                  size="md"
                  variant="ghost"
                  aria-label={t("recipes.share.title")}
                >
                  <Share2 aria-hidden size={18} />
                </Button>
              </Menu>
              {canEdit ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("cookingCommon.edit")}
                    onClick={() => void navigate(`/cooking/recipes/${id}/edit`)}
                  >
                    <Pencil aria-hidden size={18} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("cookingCommon.delete")}
                    onClick={() => void remove()}
                  >
                    <Trash2 aria-hidden size={18} />
                  </Button>
                </>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("cookingCommon.close")}
                onClick={() => void navigate("/cooking")}
              >
                <X aria-hidden size={20} />
              </Button>
            </>
          )}
        </Row>
      </Row>

      {unseen > 0 && !isCooking ? (
        <Banner
          text={t("recipeView.versions.notice", { count: unseen })}
          actionText={t("recipeView.versions.view")}
          onAction={openVersions}
          dismissText={t("cookingCommon.close")}
          onDismiss={markSeen}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {assetUrl(recipe.img_url) ? (
          <img
            src={assetUrl(recipe.img_url)}
            alt=""
            className="aspect-[4/3] max-h-[30rem] w-full rounded-container object-cover lg:aspect-video"
          />
        ) : null}
        <Stack gap={3}>
          {recipe.category ? (
            <Link
              to={`/cooking?category=${encodeURIComponent(recipe.category.slug)}`}
              className="self-start"
              title={t("recipeView.filterByCategory", {
                name: recipe.category.name,
              })}
            >
              <Chip
                text={recipe.category.name}
                icon={
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full bg-accent"
                    style={
                      recipe.category.color
                        ? { backgroundColor: recipe.category.color }
                        : undefined
                    }
                  />
                }
              />
            </Link>
          ) : null}
          <Text variant="title" as="h1">
            {recipe.name}
          </Text>
          {recipe.description ? (
            <Text shouldKeepLineBreaks>{recipe.description}</Text>
          ) : null}
          <Row gap={2} align="center" shouldWrap>
            {author ? (
              <Row gap={1} align="center">
                <Avatar
                  src={assetUrl(recipe.creator_avatar_url) || null}
                  name={author}
                  size={24}
                />
                <Text variant="caption" tone="muted">
                  {t("recipeView.addedBy", { name: author })}
                </Text>
              </Row>
            ) : null}
            {recipe.created_at ? (
              <Text variant="caption" tone="muted" title={recipe.created_at}>
                {formatDate(recipe.created_at, dateFormat, i18n.language)}
              </Text>
            ) : null}
            {domain && recipe.source_url ? (
              <ExternalLink
                variant="caption"
                href={recipe.source_url}
                text={t("recipeView.from", { domain })}
              />
            ) : null}
            {recipe.last_edited_by_name ? (
              <Text
                variant="caption"
                tone="muted"
                title={recipe.updated_at ?? undefined}
              >
                {t("recipeView.lastEditedBy", {
                  name: recipe.last_edited_by_name,
                })}
              </Text>
            ) : null}
            {recipe.last_cooked_at ? (
              <Text
                variant="caption"
                tone="muted"
                title={relativeTime(recipe.last_cooked_at, i18n.language)}
              >
                {t("recipeView.lastCooked", {
                  date: formatDate(
                    recipe.last_cooked_at,
                    dateFormat,
                    i18n.language,
                  ),
                })}
              </Text>
            ) : null}
            {recipe.cook_count ? (
              <Text variant="caption" tone="muted">
                {t("recipeView.cookCount", { count: recipe.cook_count })}
              </Text>
            ) : null}
            {history.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                text={t("recipeView.versions.title")}
                onClick={openVersions}
              >
                <History aria-hidden size={14} />
              </Button>
            ) : null}
          </Row>
          <Row gap={2} align="center" shouldWrap>
            <StarRating
              value={recipe.rating}
              onChange={
                canRate ? (rating) => void patch({ rating }) : undefined
              }
              size={22}
            />
            {canRate ? (
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={recipe.favorite}
                aria-label={
                  recipe.favorite
                    ? t("recipes.menu.unfavorite")
                    : t("recipes.menu.favorite")
                }
                onClick={() => void patch({ favorite: !recipe.favorite })}
              >
                <Heart
                  aria-hidden
                  size={22}
                  className={
                    recipe.favorite ? "fill-current text-destructive" : ""
                  }
                />
              </Button>
            ) : null}
          </Row>
          <Row gap={2} shouldWrap className="print:hidden">
            <Button
              size="md"
              variant={isCooking ? "secondary" : "primary"}
              text={
                isCooking
                  ? t("recipeView.endCooking")
                  : t("recipeView.startCooking")
              }
              onClick={isCooking ? stop : start}
            >
              {isCooking ? (
                <EyeOff aria-hidden size={16} />
              ) : (
                <CookingPot aria-hidden size={16} />
              )}
            </Button>
            {canLogCook ? (
              <Button
                size="md"
                variant="secondary"
                text={t("recipeView.cooked")}
                onClick={() => {
                  setCookLog({ editing: null });
                }}
              >
                <Utensils aria-hidden size={16} />
              </Button>
            ) : null}
          </Row>
          <Row gap={5} shouldWrap>
            {recipe.prep_minutes ? (
              <Stat
                icon={<Clock aria-hidden size={18} />}
                label={t("recipeView.prep")}
                value={formatDuration(recipe.prep_minutes)}
              />
            ) : null}
            {recipe.cook_minutes ? (
              <Stat
                icon={<Flame aria-hidden size={18} />}
                label={t("recipeView.cook")}
                value={formatDuration(recipe.cook_minutes)}
              />
            ) : null}
            {recipe.rest_minutes ? (
              <Stat
                icon={<Hourglass aria-hidden size={18} />}
                label={t("recipeView.rest")}
                value={formatDuration(recipe.rest_minutes)}
              />
            ) : null}
            {total > 0 ? (
              <Stat
                icon={<Timer aria-hidden size={18} />}
                label={t("recipeView.total")}
                value={formatDuration(total)}
              />
            ) : null}
            {recipe.servings ? (
              <Stat
                icon={<Utensils aria-hidden size={18} />}
                label={t("recipeView.serves")}
                value={String(recipe.servings)}
              />
            ) : null}
            {recipe.yield_text ? (
              <Stat
                icon={<Scale aria-hidden size={18} />}
                label={t("recipeView.yield")}
                value={recipe.yield_text}
              />
            ) : null}
          </Row>
          {recipe.tags.length > 0 ? (
            <Row gap={1} shouldWrap align="center">
              <Text variant="label" tone="muted">
                {t("recipeView.tags")}
              </Text>
              {recipe.tags.map((tag) => (
                <Chip key={tag} text={tag} />
              ))}
            </Row>
          ) : null}
        </Stack>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.85fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)_minmax(17rem,0.85fr)] print:block">
        <Stack gap={5} className="xl:sticky xl:top-4">
          <IngredientsSection
            groups={recipe.ingredients}
            servings={recipe.servings}
            scale={scale}
            onScale={setScale}
            pantry={pantryById}
            checked={isCooking ? checks.ingredients : undefined}
            onToggle={
              isCooking
                ? (key) => {
                    changeChecks({
                      ...checks,
                      ingredients: toggle(checks.ingredients, key),
                    });
                  }
                : undefined
            }
          />
          <ToolList
            tools={recipe.tools}
            checked={checks.tools}
            onToggle={
              isCooking
                ? (index) => {
                    changeChecks({
                      ...checks,
                      tools: toggle(checks.tools, index),
                    });
                  }
                : undefined
            }
          />
        </Stack>
        <Stack gap={5} className="lg:row-span-2 xl:row-span-1">
          <StepsSection
            steps={steps}
            groups={recipe.ingredients}
            onTimer={(index, durationSec) => {
              startTimer({
                label:
                  steps[index].title ||
                  t("recipeView.step", { number: index + 1 }),
                durationSec,
                recipeId: id,
                recipeName: recipe.name,
                stepIndex: index,
              });
            }}
            cooking={
              isCooking
                ? {
                    steps: checks.steps,
                    ingredients: checks.ingredients,
                    onStep: (index, linked) => {
                      const isDone = checks.steps.includes(index);
                      changeChecks({
                        ...checks,
                        steps: toggle(checks.steps, index),
                        // Finishing a step ticks its ingredients too;
                        // undoing it leaves them.
                        ingredients: isDone
                          ? checks.ingredients
                          : [...new Set([...checks.ingredients, ...linked])],
                      });
                    },
                    onIngredient: (key) => {
                      changeChecks({
                        ...checks,
                        ingredients: toggle(checks.ingredients, key),
                      });
                    },
                  }
                : undefined
            }
          />
          <VideoBlock url={recipe.video_url} />
          {recipe.notes ? (
            <Stack gap={2} as="section">
              <Text variant="heading" as="h2">
                {t("recipeView.notes")}
              </Text>
              <RichText html={recipe.notes} />
            </Stack>
          ) : null}
        </Stack>
        <Stack gap={3} className="xl:sticky xl:top-4 print:hidden">
          <NutritionFactsBox
            nutrition={recipe.nutrition}
            servings={recipe.servings}
            recipeMassG={mass.isComplete ? mass.perServingG : null}
          />
          <RecomputeNutrition
            recipe={recipe}
            onSave={
              canEdit
                ? async (nutrition) => {
                    apply(await updateRecipe(recipe, { nutrition }));
                  }
                : undefined
            }
          />
        </Stack>
      </div>

      <CookHistory
        cooks={cooks.data ?? []}
        onEdit={
          isOwner
            ? (cook) => {
                setCookLog({ editing: cook });
              }
            : undefined
        }
        onDelete={isOwner ? (cook) => void removeCook(cook) : undefined}
      />

      <Comments
        recipeId={id}
        userId={user.id}
        isAdmin={user.isAdmin}
        canPost={user.id !== null}
      />

      {recipe.updated_at && recipe.updated_at !== recipe.created_at ? (
        <Text
          variant="caption"
          tone="muted"
          title={recipe.updated_at}
          className="print:hidden"
        >
          {t("recipeView.lastUpdated", {
            date: formatUpdated(recipe.updated_at, dateFormat, i18n.language),
          })}
        </Text>
      ) : null}

      {cookLog ? (
        <CookLogDialog
          recipeName={recipe.name}
          editing={cookLog.editing}
          onClose={() => {
            setCookLog(null);
          }}
          onSave={saveCook}
        />
      ) : null}
      {isVersionsOpen ? (
        <VersionsSheet
          recipe={recipe}
          versions={history}
          userId={user.id}
          isRestoring={isRestoring}
          onRestore={(version) => void restore(version)}
          onClose={() => {
            setIsVersionsOpen(false);
          }}
        />
      ) : null}
      {confirmDialog}
    </Stack>
  );
}

/** `/cooking/recipes/:id`; a new id starts the screen afresh */
export function RecipeViewPage() {
  const { id } = useParams();
  return <RecipeView key={id} id={Number(id)} />;
}
