import {
  Checkbox,
  Dialog,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  addToCookbook,
  getCookbooksForRecipe,
  removeFromCookbook,
  type Cookbook,
} from "../cookbooksApi";
import { membershipChanges } from "../lib/recipeList";

import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";

export interface CookbookPickerDialogProps {
  /** All own cookbooks; smart ones fill themselves and aren't offered */
  cookbooks: Cookbook[];
  /** One recipe: its memberships are pre-checked and can be removed */
  recipeIds: number[];
  recipeName?: string;
  onClose: () => void;
  onDone: () => void;
}

export function CookbookPickerDialog({
  cookbooks,
  recipeIds,
  recipeName,
  onClose,
  onDone,
}: CookbookPickerDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const single = recipeIds.length === 1 ? recipeIds[0] : undefined;
  const choices = cookbooks.filter((cookbook) => !cookbook.is_smart);
  const { data: before } = useLoad(
    useCallback(async () => {
      if (single === undefined) return new Set<number>();
      const rows = await getCookbooksForRecipe(single).catch(() => []);
      return new Set(rows.map((row) => row.id));
    }, [single]),
  );
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const selected = picked ?? before ?? new Set<number>();
  const changes = membershipChanges(selected, before ?? new Set());

  const toggle = (id: number, isChecked: boolean) => {
    const next = new Set(selected);
    if (isChecked) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const save = async () => {
    setIsBusy(true);
    try {
      for (const id of changes.added) await addToCookbook(id, recipeIds);
      if (single !== undefined) {
        for (const id of changes.removed) {
          await removeFromCookbook(id, single);
        }
      }
      const count =
        changes.added.length +
        (single === undefined ? 0 : changes.removed.length);
      if (count > 0) {
        notify.info(t("recipes.cookbookPicker.updated", { count }));
      }
      onDone();
    } catch (caught) {
      notify.failure(caught, t("recipes.cookbookPicker.failed"));
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
      title={t("recipes.cookbookPicker.title")}
      description={
        recipeName ?? t("recipes.select.count", { count: recipeIds.length })
      }
      cancelText={t("cookingCommon.cancel")}
      confirmText={t("cookingCommon.save")}
      onConfirm={save}
      isBusy={isBusy}
      isConfirmDisabled={
        !before || changes.added.length + changes.removed.length === 0
      }
    >
      {before ? (
        <Stack gap={2}>
          {choices.length === 0 ? (
            <Text tone="muted">
              {cookbooks.length === 0
                ? t("recipes.cookbookPicker.none")
                : t("recipes.cookbookPicker.onlySmart")}{" "}
              <Link className="underline" to="/cooking/manage/cookbooks">
                {t("recipes.cookbooks.manage")}
              </Link>
            </Text>
          ) : null}
          {choices.map((cookbook) => (
            <Checkbox
              key={cookbook.id}
              checked={selected.has(cookbook.id)}
              disabled={isBusy}
              label={`${cookbook.name} · ${t("recipes.cookbooks.count", { count: cookbook.recipe_count })}`}
              onChange={(isChecked) => {
                toggle(cookbook.id, isChecked);
              }}
            />
          ))}
        </Stack>
      ) : (
        <Spinner label={t("cookingCommon.loading")} />
      )}
    </Dialog>
  );
}
