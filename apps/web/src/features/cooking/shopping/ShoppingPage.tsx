import {
  Button,
  Menu,
  ProgressBar,
  Row,
  SegmentedControl,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Eye, EyeOff, ListX, Plus, Share2, ShoppingCart } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useSetting } from "@/features/shared/settings";

import { EmptyNotice } from "../common/EmptyNotice";
import { PageHeader } from "../common/PageHeader";
import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useCookingDataChanged } from "../common/dataChanged";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import {
  asGroupMode,
  displayRows,
  groupShopping,
  knownAisles,
  memberIds,
  membersOf,
  mergeRows,
  moveShoppingRow,
  planEdit,
  restockPatch,
  restockRows,
  type GroupMode,
  type RestockRow,
  type ShoppingEdit,
  type ShoppingGroup,
  type ShoppingRow,
} from "../lib/shopping";
import {
  buildShoppingCardSvg,
  buildShoppingText,
  shareBlob,
  shareText,
  svgToPngBlob,
  type ShoppingShareTexts,
} from "../lib/shoppingCard";
import { isoDate, shortDate } from "../lib/relativeTime";
import { pantryApi, type PantryItem } from "../pantryApi";
import { shoppingApi, type ShoppingItem } from "../shoppingApi";
import { QuickAdd } from "./QuickAdd";
import {
  AisleDialog,
  ClearCheckedDialog,
  EditItemDialog,
  FromPlanDialog,
  FromRecipeDialog,
  type RestockChoice,
} from "./ShoppingDialogs";
import {
  ShoppingGroupCard,
  type ShoppingRowActions,
} from "./ShoppingGroupCard";

/** The old UI's key: collapsed groups stay collapsed there and here */
const COLLAPSE_KEY = "ct:shoppingCollapsed";

function readCollapsed(): Set<string> {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(COLLAPSE_KEY) ?? "[]",
    );
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
}

type DialogState =
  | { kind: "edit"; row: ShoppingRow }
  | { kind: "aisle"; row: ShoppingRow }
  | {
      kind: "clear";
      count: number;
      rows: RestockRow[];
      pantry: PantryItem[];
    }
  | { kind: "recipe" }
  | { kind: "plan" }
  | null;

export function ShoppingPage() {
  const { t, i18n } = useTranslation("cooking");
  const navigate = useNavigate();
  const notify = useNotify();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const load = useCallback(() => shoppingApi.list(), []);
  const { data, error, reload, setData } = useLoad(load);
  /** Pantry names and categories only feed suggestions and aisles */
  const loadExtras = useCallback(async () => {
    const [pantry, categories] = await Promise.all([
      pantryApi.list().catch(() => []),
      pantryApi.categories().catch(() => []),
    ]);
    return { pantry, categories };
  }, []);
  const extras = useLoad(loadExtras);
  useCookingDataChanged(() => {
    void reload({ isQuiet: true });
    void extras.reload({ isQuiet: true });
  });

  const [groupSetting, setGroupSetting] = useSetting("ct", "shoppingGroupBy");
  const [checkedBehavior] = useSetting("ct", "shoppingCheckedBehavior");
  const mode = asGroupMode(groupSetting);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  /** Done groups start collapsed; these were reopened this visit */
  const [reopened, setReopened] = useState<ReadonlySet<string>>(new Set());
  const [shouldShowChecked, setShouldShowChecked] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isBusy, setIsBusy] = useState(false);

  const items = data ?? [];
  const shown = displayRows(items, mode);
  const checkedCount = shown.filter((row) => row.checked).length;
  const isHiding = checkedBehavior === "hide" && !shouldShowChecked;
  const groups = groupShopping(
    isHiding ? items.filter((item) => !item.checked) : items,
    mode,
  );
  const aisles = knownAisles(extras.data?.categories ?? [], items);
  const pantryNames = [
    ...new Set((extras.data?.pantry ?? []).map((item) => item.name)),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const close = () => {
    setDialog(null);
  };

  const patchRows = (
    ids: ReadonlySet<number>,
    patch: Partial<ShoppingItem>,
  ) => {
    setData((current) =>
      current.map((item) => (ids.has(item.id) ? { ...item, ...patch } : item)),
    );
  };
  const dropRows = (ids: ReadonlySet<number>) => {
    setData((current) => current.filter((item) => !ids.has(item.id)));
  };

  /** An optimistic change: on failure the list is read again */
  const attempt = async (work: () => Promise<unknown>, failed: string) => {
    try {
      await work();
      return true;
    } catch (caught) {
      notify.failure(caught, failed);
      await reload({ isQuiet: true });
      return false;
    }
  };

  const setChecked = async (rows: ShoppingItem[], isChecked: boolean) => {
    const targets = rows.filter((row) => row.checked !== isChecked);
    if (targets.length === 0) return;
    patchRows(new Set(targets.map((row) => row.id)), { checked: isChecked });
    await attempt(
      () =>
        Promise.all(
          targets.map((row) => shoppingApi.setChecked(row.id, isChecked)),
        ),
      t("shopping.toast.updateFailed"),
    );
  };

  const removeRows = async (ids: number[]) => {
    dropRows(new Set(ids));
    return attempt(async () => {
      for (const id of ids) await shoppingApi.remove(id);
    }, t("shopping.toast.deleteFailed"));
  };

  const add = async (name: string, quantity: number | null) => {
    try {
      const created = await shoppingApi.add({ name, quantity });
      setData((current) => [...current, created]);
      // The list row has joined names the new one lacks.
      void reload({ isQuiet: true });
      return true;
    } catch (caught) {
      notify.failure(caught, t("shopping.toast.addFailed"));
      return false;
    }
  };

  const saveEdit = async (row: ShoppingRow, edit: ShoppingEdit) => {
    close();
    const plan = planEdit(row, edit);
    dropRows(new Set(plan.removes));
    for (const { id, patch } of plan.updates) {
      const { name, quantity, unit } = patch;
      patchRows(new Set([id]), {
        ...(name === undefined ? {} : { name }),
        ...(quantity === undefined ? {} : { quantity }),
        ...(unit === undefined ? {} : { unit }),
      });
    }
    await attempt(async () => {
      for (const { id, patch } of plan.updates) {
        await shoppingApi.update(id, patch);
      }
      for (const id of plan.removes) await shoppingApi.remove(id);
    }, t("shopping.toast.saveFailed"));
  };

  const setAisle = async (row: ShoppingRow, next: string) => {
    close();
    const aisle = next.trim() || null;
    const ids = memberIds(row);
    patchRows(new Set(ids), { aisle });
    await attempt(async () => {
      for (const id of ids) await shoppingApi.update(id, { aisle });
    }, t("shopping.toast.updateFailed"));
  };

  const move = async (group: ShoppingGroup, index: number, delta: -1 | 1) => {
    const order = moveShoppingRow(group, index, delta, mode);
    if (!order) return;
    const byId = new Map(order.map((entry) => [entry.id, entry]));
    setData((current) =>
      current.map((item) => ({ ...item, ...byId.get(item.id) })),
    );
    await attempt(
      () => shoppingApi.reorder(order),
      t("shopping.toast.orderFailed"),
    );
  };

  const actions: ShoppingRowActions = {
    onToggle: (row) => void setChecked(membersOf(row), !row.checked),
    onEdit: (row) => {
      setDialog({ kind: "edit", row });
    },
    onAisle: (row) => {
      setDialog({ kind: "aisle", row });
    },
    onRemove: (row) => void removeRows(memberIds(row)),
    onMove: (group, index, delta) => void move(group, index, delta),
  };

  const titleOf = (group: ShoppingGroup): string | null => {
    if (mode === "flat") return null;
    if (group.title) return group.title;
    if (mode === "recipe") {
      return group.recipeId === null
        ? t("shopping.other")
        : t("shopping.recipe");
    }
    return t("shopping.uncategorized");
  };

  const removeGroup = async (group: ShoppingGroup) => {
    const count = group.rows.length;
    const isConfirmed = await confirm({
      title: t("shopping.confirmGroup.title", {
        count,
        group: titleOf(group) ?? t("shopping.title"),
      }),
      message: t("shopping.confirmGroup.message"),
      confirmText: t("cookingCommon.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    const ids = group.rows.flatMap(memberIds);
    const recipeId = group.recipeId;
    let isDone: boolean;
    if (recipeId !== null) {
      dropRows(new Set(ids));
      isDone = await attempt(
        () => shoppingApi.clearByRecipe(recipeId),
        t("shopping.toast.deleteFailed"),
      );
    } else {
      isDone = await removeRows(ids);
    }
    if (isDone) notify.success(t("shopping.toast.removed", { count }));
  };

  const toggleCollapsed = (key: string, isDone: boolean) => {
    const toggle = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    };
    if (isDone) {
      setReopened(toggle);
      return;
    }
    const next = toggle(collapsed);
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
    } catch {
      // Private mode: collapsed for this visit only.
    }
  };

  const startClear = async () => {
    if (checkedCount === 0) return;
    const pantry = await pantryApi.list().catch(() => []);
    setDialog({
      kind: "clear",
      count: checkedCount,
      rows: restockRows(items, pantry),
      pantry,
    });
  };

  const confirmClear = async (
    pantry: PantryItem[],
    choices: RestockChoice[],
  ) => {
    setIsBusy(true);
    try {
      await shoppingApi.clearChecked();
    } catch (caught) {
      notify.failure(caught, t("shopping.toast.clearFailed"));
      return;
    } finally {
      setIsBusy(false);
    }
    setData((current) => current.filter((item) => !item.checked));
    close();
    const picks = choices.filter((choice) => choice.isEnabled);
    if (picks.length === 0) {
      notify.success(t("shopping.toast.cleared"));
      return;
    }
    const done: {
      id: number;
      undo: ReturnType<typeof restockPatch>["undo"];
    }[] = [];
    for (const pick of picks) {
      const target = pantry.find((item) => item.id === pick.selectedId);
      if (!target) continue;
      const { patch, undo } = restockPatch(target);
      try {
        await pantryApi.update(target.id, patch);
        done.push({ id: target.id, undo });
      } catch {
        // Counted below.
      }
    }
    void extras.reload({ isQuiet: true });
    if (done.length < picks.length) {
      notify.error(
        t("shopping.toast.restockFailed", {
          count: picks.length - done.length,
        }),
      );
    }
    if (done.length === 0) return;
    notify.show({
      text: t("shopping.toast.clearedRestocked", { count: done.length }),
      durationMs: 10_000,
      action: {
        text: t("shopping.undo"),
        onAction: () => {
          void (async () => {
            try {
              for (const entry of done) {
                await pantryApi.update(entry.id, entry.undo);
              }
              notify.success(t("shopping.toast.restockUndone"));
            } catch (caught) {
              notify.failure(caught, t("shopping.toast.undoFailed"));
            }
            void extras.reload({ isQuiet: true });
          })();
        },
      },
    });
  };

  const addFrom = async (work: () => Promise<string>) => {
    setIsBusy(true);
    try {
      notify.success(await work());
      close();
      await reload({ isQuiet: true });
    } catch (caught) {
      notify.failure(caught, t("shopping.toast.addFailed"));
    } finally {
      setIsBusy(false);
    }
  };

  const shareTexts = (): ShoppingShareTexts => ({
    title: t("shopping.share.listTitle"),
    itemCount: (count) => t("shopping.share.itemCount", { count }),
    itemCountShort: (count) =>
      t("shopping.share.itemCount", { count }).toUpperCase(),
    more: (count) => t("shopping.share.more", { count }),
    signature: "— Trace",
    date: shortDate(new Date(), i18n.language),
  });

  const share = async (kind: "image" | "text") => {
    if (items.length === 0) {
      notify.error(t("shopping.toast.nothingToShare"));
      return;
    }
    const title = t("shopping.share.listTitle");
    try {
      const rows = mergeRows(items, true);
      if (kind === "image") {
        const card = buildShoppingCardSvg(rows, shareTexts());
        const blob = await svgToPngBlob(card.svg, card.width, card.height);
        const result = await shareBlob(
          blob,
          `shopping-list-${isoDate(new Date())}.png`,
          title,
        );
        if (result.isDownloaded) notify.success(t("shopping.toast.savedImage"));
        return;
      }
      const result = await shareText(
        buildShoppingText(rows, shareTexts()),
        title,
      );
      if (result.isCopied) notify.success(t("shopping.toast.copied"));
      else if (!result.isShared && !result.isCanceled) {
        notify.error(t("shopping.toast.shareFailed"));
      }
    } catch (caught) {
      notify.failure(caught, t("shopping.toast.shareFailed"));
    }
  };

  return (
    <Stack gap={4} padding={4}>
      <PageHeader title={t("shopping.title")}>
        <Menu
          label={t("shopping.share.title")}
          align="end"
          items={[
            {
              id: "image",
              text: t("shopping.share.image"),
              onSelect: () => void share("image"),
            },
            {
              id: "text",
              text: t("shopping.share.text"),
              onSelect: () => void share("text"),
            },
          ]}
        >
          <Button size="md" aria-label={t("shopping.share.title")}>
            <Share2 aria-hidden size={18} />
          </Button>
        </Menu>
        <Menu
          label={t("shopping.addSource.title")}
          align="end"
          items={[
            {
              id: "recipe",
              text: t("shopping.addSource.recipe"),
              onSelect: () => {
                setDialog({ kind: "recipe" });
              },
            },
            {
              id: "plan",
              text: t("shopping.addSource.plan"),
              onSelect: () => {
                setDialog({ kind: "plan" });
              },
            },
          ]}
        >
          <Button
            size="md"
            variant="secondary"
            aria-label={t("shopping.addSource.title")}
          >
            <Plus aria-hidden size={18} />
          </Button>
        </Menu>
      </PageHeader>

      <SegmentedControl<GroupMode>
        aria-label={t("shopping.groupBy.label")}
        variant="pill"
        className="self-start"
        value={mode}
        options={(["aisle", "recipe", "flat"] as const).map((value) => ({
          value,
          label: t(`shopping.groupBy.${value}`),
        }))}
        onChange={setGroupSetting}
      />

      <QuickAdd names={pantryNames} onAdd={add} />

      {items.length > 0 ? (
        <Stack gap={2}>
          <Row justify="between" align="center" gap={2} shouldWrap>
            <Text role="status">
              {t("shopping.remaining", {
                count: shown.length - checkedCount,
              })}
              {checkedCount > 0
                ? ` · ${t("shopping.checked", { count: checkedCount })}`
                : ""}
            </Text>
            <Row gap={2}>
              {checkedBehavior === "hide" && checkedCount > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  text={
                    shouldShowChecked
                      ? t("shopping.hideChecked")
                      : t("shopping.showChecked", { count: checkedCount })
                  }
                  onClick={() => {
                    setShouldShowChecked(!shouldShowChecked);
                  }}
                >
                  {shouldShowChecked ? (
                    <EyeOff aria-hidden size={14} />
                  ) : (
                    <Eye aria-hidden size={14} />
                  )}
                </Button>
              ) : null}
              {checkedCount > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  text={t("shopping.clearChecked")}
                  onClick={() => void startClear()}
                >
                  <ListX aria-hidden size={14} />
                </Button>
              ) : null}
            </Row>
          </Row>
          <ProgressBar
            label={t("shopping.progress")}
            value={shown.length > 0 ? checkedCount / shown.length : 0}
          />
        </Stack>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyNotice
          icon={<ShoppingCart aria-hidden size={32} />}
          title={t("shopping.empty.title")}
          text={t("shopping.empty.text")}
          actionText={t("shopping.addSource.recipe")}
          onAction={() => {
            setDialog({ kind: "recipe" });
          }}
        />
      ) : (
        <div className={mode === "flat" ? "" : "gap-3 xl:columns-2"}>
          {groups.map((group) => {
            const isDone =
              group.rows.length > 0 && group.rows.every((row) => row.checked);
            const key = `${mode}:${group.key}`;
            const isCollapsed =
              mode !== "flat" &&
              (isDone ? !reopened.has(key) : collapsed.has(group.key));
            return (
              <ShoppingGroupCard
                key={key}
                group={group}
                title={titleOf(group)}
                mode={mode}
                isCollapsed={isCollapsed}
                onToggleCollapsed={() => {
                  toggleCollapsed(isDone ? key : group.key, isDone);
                }}
                onCheckAll={(isChecked) =>
                  void setChecked(group.rows.flatMap(membersOf), isChecked)
                }
                onRemoveGroup={() => void removeGroup(group)}
                onOpenRecipe={
                  group.recipeId === null
                    ? undefined
                    : () =>
                        void navigate(`/cooking/recipes/${group.recipeId ?? 0}`)
                }
                actions={actions}
              />
            );
          })}
        </div>
      )}

      {dialog?.kind === "edit" ? (
        <EditItemDialog
          row={dialog.row}
          onClose={close}
          onSave={(edit) => void saveEdit(dialog.row, edit)}
        />
      ) : null}
      {dialog?.kind === "aisle" ? (
        <AisleDialog
          current={dialog.row.aisle}
          aisles={aisles}
          onClose={close}
          onPick={(aisle) => void setAisle(dialog.row, aisle)}
        />
      ) : null}
      {dialog?.kind === "clear" ? (
        <ClearCheckedDialog
          count={dialog.count}
          rows={dialog.rows}
          isBusy={isBusy}
          onClose={close}
          onConfirm={(choices) => void confirmClear(dialog.pantry, choices)}
        />
      ) : null}
      {dialog?.kind === "recipe" ? (
        <FromRecipeDialog
          isBusy={isBusy}
          onClose={close}
          onPick={(recipe, shouldOnlyAddMissing) =>
            void addFrom(async () => {
              const result = await shoppingApi.fromRecipe(
                recipe.id,
                shouldOnlyAddMissing,
              );
              return t("shopping.toast.addedFromRecipe", {
                count: result.added,
                name: recipe.name,
              });
            })
          }
        />
      ) : null}
      {dialog?.kind === "plan" ? (
        <FromPlanDialog
          isBusy={isBusy}
          onClose={close}
          onConfirm={(from, to, shouldOnlyAddMissing) =>
            void addFrom(async () => {
              const result = await shoppingApi.fromPlan(
                from,
                to,
                shouldOnlyAddMissing,
              );
              if (result.added > 0) {
                return t("shopping.toast.addedFromPlan", {
                  count: result.added,
                  cooks: result.planned_cooks,
                });
              }
              return t(
                result.planned_cooks === 0
                  ? "shopping.toast.nothingPlanned"
                  : "shopping.toast.alreadyInPantry",
              );
            })
          }
        />
      ) : null}
      {confirmDialog}
    </Stack>
  );
}
