import {
  Button,
  Dialog,
  SegmentedControl,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState, LoadingState } from "../common/states";
import { useConfirm } from "../common/useConfirm";
import { useCookingDataChanged } from "../common/dataChanged";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import type { ExternalFood } from "../lib/externalFoods";
import {
  draftFromItem,
  draftFromPrefill,
  payloadFromDraft,
  variantContext,
  type PantryDraft,
} from "../lib/pantryForm";
import { itemSlug } from "../lib/pantryList";
import { nextStockToggle } from "../lib/pantryVariants";
import { pantryApi, type PantryItem, type PantryPatch } from "../pantryApi";
import { PantryItemForm } from "./PantryItemForm";
import { PantryItemView } from "./PantryItemView";
import { PantryVariants } from "./PantryVariants";

export interface EditorFrame {
  title: string;
  /** Edit and delete, or cancel and save */
  actions: ReactNode;
  body: ReactNode;
}

export interface PantryItemEditorProps {
  /** Null: a new item */
  itemId: number | null;
  shouldEdit?: boolean;
  /** For a new item: a search result or a scanned barcode */
  prefill?: Partial<ExternalFood>;
  /** After create or delete, and when a new item is cancelled */
  onClose: () => void;
  /** Something changed that a list behind shows */
  onChanged: () => void;
  children: (frame: EditorFrame) => ReactNode;
}

/**
 * One pantry item: view, edit or create. The sheet over the list and the
 * pages under /cooking/pantry both frame this.
 */
export function PantryItemEditor({
  itemId,
  shouldEdit = false,
  prefill,
  onClose,
  onChanged,
  children,
}: PantryItemEditorProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const load = useCallback(async () => {
    const [item, all, categories] = await Promise.all([
      itemId === null ? null : pantryApi.get(itemId),
      itemId === null ? pantryApi.list().catch(() => []) : pantryApi.list(),
      pantryApi.categories().catch(() => []),
    ]);
    return { item, all, categories };
  }, [itemId]);
  const { data, error, reload, setData } = useLoad(load);

  const [isEditing, setIsEditing] = useState(itemId === null || shouldEdit);
  /** Null until the first change: then the form shows the item's values */
  const [draft, setDraft] = useState<PantryDraft | null>(() =>
    itemId === null ? draftFromPrefill(prefill) : null,
  );
  // Not under a started edit: its save sends the item as it was opened.
  useCookingDataChanged(() => {
    if (draft === null) void reload({ isQuiet: true });
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"keep" | "cascade" | null>(null);

  const item = data?.item ?? null;
  const categories = data?.categories ?? [];
  const context = item ? variantContext(item, data?.all ?? []) : null;
  const variants =
    item && item.generic_parent_id == null ? (context?.children ?? []) : [];
  const isGeneric = variants.length > 0;
  const form = draft ?? (item ? draftFromItem(item) : null);

  const refresh = async () => {
    await reload({ isQuiet: true });
    onChanged();
  };

  const cancel = () => {
    if (itemId === null) {
      onClose();
      return;
    }
    setDraft(null);
    setIsEditing(false);
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      notify.error(t("pantryItem.toast.nameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      const payload = payloadFromDraft(form);
      if (itemId === null) {
        const row = await pantryApi.create(payload);
        // The server answers an existing item of the same name instead.
        if (data?.all.some((entry) => entry.id === row.id)) {
          notify.error(t("pantryItem.toast.alreadyThere", { name: row.name }));
          return;
        }
        notify.success(t("pantryItem.toast.added"));
        onChanged();
        onClose();
        return;
      }
      // With the row as opened, so only what the form changed goes in.
      await pantryApi.update(itemId, { ...payload, _base: item ?? undefined });
      notify.success(t("pantryItem.toast.saved"));
      await refresh();
      setDraft(null);
      setIsEditing(false);
    } catch (caught) {
      notify.failure(caught, t("pantryItem.toast.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  /** An inline change in the read view, shown at once */
  const patchNow = async (current: PantryItem, patch: PantryPatch) => {
    const apply = (changes: Partial<PantryItem>) => {
      setData((previous) => ({
        ...previous,
        item: previous.item ? { ...previous.item, ...changes } : null,
      }));
    };
    setIsBusy(true);
    apply(patch);
    try {
      await pantryApi.update(current.id, patch);
      onChanged();
    } catch (caught) {
      apply({ quantity: current.quantity, in_stock: current.in_stock });
      notify.failure(caught, t("pantry.toast.updateFailed"));
    } finally {
      setIsBusy(false);
    }
  };

  const performDelete = async (shouldCascade: boolean) => {
    if (itemId === null) return;
    try {
      await pantryApi.remove(itemId, shouldCascade);
      notify.success(
        t(
          shouldCascade
            ? "pantryItem.toast.removedWithVariants"
            : "pantry.toast.removed",
        ),
      );
      onChanged();
      onClose();
    } catch (caught) {
      notify.failure(caught, t("pantry.toast.deleteFailed"));
    }
  };

  const remove = async () => {
    if (!item) return;
    // A generic: say what happens to its variants; keeping is the default.
    if (isGeneric) {
      setDeleteMode("keep");
      return;
    }
    const isConfirmed = await confirm({
      title: t("pantry.confirmRemove.title"),
      message: t("pantry.confirmRemove.message", { name: item.name }),
      confirmText: t("cookingCommon.remove"),
      isDangerous: true,
    });
    if (isConfirmed) await performDelete(false);
  };

  const title =
    itemId === null
      ? t("pantryItem.titleAdd")
      : isEditing
        ? t("pantryItem.titleEdit")
        : (item?.name ?? t("pantryItem.title"));

  const actions =
    !data || !form ? null : isEditing ? (
      <>
        <Button
          size="sm"
          variant="secondary"
          text={t("cookingCommon.cancel")}
          isDisabled={isSaving}
          onClick={cancel}
        >
          <Undo2 aria-hidden size={14} />
        </Button>
        <Button
          size="sm"
          variant="primary"
          text={t("cookingCommon.save")}
          isLoading={isSaving}
          isDisabled={isUploading}
          onClick={() => void save()}
        >
          <Check aria-hidden size={14} />
        </Button>
      </>
    ) : item ? (
      <>
        <Button
          size="sm"
          variant="secondary"
          text={t("cookingCommon.edit")}
          onClick={() => {
            setDraft(null);
            setIsEditing(true);
          }}
        >
          <Pencil aria-hidden size={14} />
        </Button>
        <Button
          size="sm"
          variant="danger"
          text={t("cookingCommon.delete")}
          onClick={() => void remove()}
        >
          <Trash2 aria-hidden size={14} />
        </Button>
      </>
    ) : null;

  const body = error ? (
    <ErrorState message={error} onRetry={() => void reload()} />
  ) : !data || !form ? (
    <LoadingState />
  ) : (
    <Stack gap={6}>
      {isEditing ? (
        <PantryItemForm
          draft={form}
          onChange={(update) => {
            setDraft((current) => update(current ?? form));
          }}
          categories={categories}
          onCategoryCreated={(category) => {
            setData((previous) => ({
              ...previous,
              categories: [...previous.categories, category],
            }));
          }}
          isGeneric={isGeneric}
          onUploadingChange={setIsUploading}
        />
      ) : item ? (
        <PantryItemView
          item={item}
          category={
            categories.find(
              (category) => category.slug === itemSlug(item, categories),
            ) ?? null
          }
          variants={variants}
          isBusy={isBusy}
          onToggleStock={() => void patchNow(item, nextStockToggle(item))}
          onBumpQuantity={(delta) => {
            const next = Math.round(((item.quantity ?? 0) + delta) * 100) / 100;
            if (next < 0) return;
            void patchNow(item, {
              quantity: next,
              in_stock: next === 0 ? 0 : 1,
            });
          }}
        />
      ) : null}
      {item && context ? (
        <PantryVariants item={item} context={context} onChanged={refresh} />
      ) : null}
      {deleteMode && item ? (
        <Dialog
          open
          variant="danger"
          onOpenChange={(isOpen) => {
            if (!isOpen) setDeleteMode(null);
          }}
          title={t("pantryItem.deleteVariants.title", { name: item.name })}
          description={t("pantryItem.deleteVariants.message", {
            count: variants.length,
          })}
          confirmText={t("cookingCommon.remove")}
          cancelText={t("cookingCommon.cancel")}
          onConfirm={async () => {
            setDeleteMode(null);
            await performDelete(deleteMode === "cascade");
          }}
        >
          <Stack gap={2}>
            <SegmentedControl<"keep" | "cascade">
              aria-label={t("pantryItem.deleteVariants.label")}
              value={deleteMode}
              options={[
                { value: "keep", label: t("pantryItem.deleteVariants.keep") },
                {
                  value: "cascade",
                  label: t("pantryItem.deleteVariants.cascade"),
                },
              ]}
              onChange={setDeleteMode}
            />
            <Text variant="small" tone="muted">
              {deleteMode === "keep"
                ? t("pantryItem.deleteVariants.keepHint")
                : t("pantryItem.deleteVariants.cascadeHint")}
            </Text>
          </Stack>
        </Dialog>
      ) : null}
      {dialog}
    </Stack>
  );

  return children({ title, actions, body });
}
