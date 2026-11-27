import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Row,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ImagePicker } from "../common/ImagePicker";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import {
  addToCookbook,
  getCookbooks,
  removeFromCookbook,
  setCookbookCover,
  type Cookbook,
} from "../cookbooksApi";
import { assetUrl } from "../lib/assetUrl";
import { foldText } from "../lib/searchText";
import { getRecipes } from "../recipesApi";

export function CoverDialog({
  cookbook,
  onClose,
  onSaved,
}: {
  cookbook: Cookbook;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [url, setUrl] = useState(cookbook.cover_image_url ?? "");
  const [isUploading, setIsUploading] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("cookbook.coverTitle")}
      cancelText={t("cookingCommon.cancel")}
      confirmText={t("cookingCommon.done")}
      isConfirmDisabled={isUploading}
      onConfirm={async () => {
        try {
          await setCookbookCover(cookbook, url || null);
          notify.success(t("cookbook.coverUpdated"));
          onSaved();
        } catch (caught) {
          notify.failure(caught, t("cookbook.coverFailed"));
        }
      }}
    >
      <ImagePicker
        label={t("cookbook.coverTitle")}
        value={url}
        onChange={setUrl}
        onBusyChange={setIsUploading}
      />
    </Dialog>
  );
}

export interface MoveDialogProps {
  cookbookId: number;
  recipe: { id: number; name: string };
  onClose: () => void;
  onDone: () => void;
}

/** Copies or moves a recipe to another cookbook one adds to by hand */
export function MoveDialog({
  cookbookId,
  recipe,
  onClose,
  onDone,
}: MoveDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { data } = useLoad(
    useCallback(async () => {
      const all = await getCookbooks().catch(() => []);
      return all.filter((c) => !c.is_smart && c.id !== cookbookId);
    }, [cookbookId]),
  );
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [target, setTarget] = useState<Cookbook | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const save = async () => {
    if (!target) return;
    setIsBusy(true);
    try {
      await addToCookbook(target.id, [recipe.id]);
      if (mode === "move") await removeFromCookbook(cookbookId, recipe.id);
      notify.success(
        t(mode === "move" ? "cookbook.moved" : "cookbook.copied", {
          name: target.name,
        }),
      );
      onDone();
    } catch (caught) {
      notify.failure(caught, t("recipeCommon.failed"));
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
      title={t("cookbook.moveTitle")}
      description={recipe.name}
      cancelText={t("cookingCommon.cancel")}
      confirmText={t(mode === "move" ? "cookbook.move" : "cookbook.copy")}
      isConfirmDisabled={!target}
      isBusy={isBusy}
      onConfirm={save}
    >
      <Stack gap={3}>
        <SegmentedControl
          aria-label={t("cookbook.moveTitle")}
          options={[
            { value: "copy", label: t("cookbook.copy") },
            { value: "move", label: t("cookbook.move") },
          ]}
          value={mode}
          onChange={setMode}
        />
        {!data ? <Spinner label={t("cookingCommon.loading")} /> : null}
        {data?.length === 0 ? (
          <Text tone="muted">{t("cookbook.noTargets")}</Text>
        ) : null}
        <Row gap={2} shouldWrap role="radiogroup">
          {data?.map((cookbook) => (
            <Button
              size="md"
              key={cookbook.id}
              variant={target?.id === cookbook.id ? "primary" : "secondary"}
              aria-pressed={target?.id === cookbook.id}
              text={cookbook.name}
              onClick={() => {
                setTarget(cookbook);
              }}
            />
          ))}
        </Row>
      </Stack>
    </Dialog>
  );
}

export interface AddRecipesDialogProps {
  cookbookId: number;
  /** Already in the cookbook */
  existing: ReadonlySet<number>;
  onClose: () => void;
  onDone: () => void;
}

export function AddRecipesDialog({
  cookbookId,
  existing,
  onClose,
  onDone,
}: AddRecipesDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const { data, error } = useLoad(getRecipes);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const available = (data ?? []).filter((r) => !existing.has(r.id));
  const needle = foldText(query).trim();
  const shown = available.filter((recipe) =>
    [recipe.name, recipe.description].some((value) =>
      foldText(value).includes(needle),
    ),
  );

  const save = async () => {
    setIsBusy(true);
    try {
      const { added } = await addToCookbook(cookbookId, picked);
      notify.success(t("cookbook.added", { count: added }));
      onDone();
    } catch (caught) {
      notify.failure(caught, t("recipeCommon.failed"));
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
      title={t("cookbook.addRecipes")}
      cancelText={t("cookingCommon.cancel")}
      confirmText={t("recipeEditor.pantry.add", { count: picked.length })}
      isConfirmDisabled={picked.length === 0}
      isBusy={isBusy}
      onConfirm={save}
    >
      <Stack gap={3}>
        <Input
          type="search"
          autoFocus
          aria-label={t("cookbook.searchLibrary")}
          placeholder={t("cookbook.searchLibrary")}
          value={query}
          onValueChange={setQuery}
        />
        {!data && !error ? (
          <Spinner label={t("cookingCommon.loading")} />
        ) : null}
        {error ? <Text tone="danger">{error}</Text> : null}
        {data && available.length === 0 ? (
          <Text tone="muted">
            {data.length === 0
              ? t("cookbook.libraryEmpty")
              : t("cookbook.nothingToAdd")}
          </Text>
        ) : null}
        <Stack gap={2} as="ul">
          {shown.map((recipe) => (
            <li key={recipe.id} className="flex items-center gap-2">
              <Checkbox
                checked={picked.includes(recipe.id)}
                label={recipe.name}
                onChange={(isChecked) => {
                  setPicked((previous) =>
                    isChecked
                      ? [...previous, recipe.id]
                      : previous.filter((id) => id !== recipe.id),
                  );
                }}
              />
              {assetUrl(recipe.img_url) ? (
                <img
                  src={assetUrl(recipe.img_url)}
                  alt=""
                  loading="lazy"
                  className="ml-auto size-10 rounded-control object-cover"
                />
              ) : null}
            </li>
          ))}
        </Stack>
      </Stack>
    </Dialog>
  );
}
