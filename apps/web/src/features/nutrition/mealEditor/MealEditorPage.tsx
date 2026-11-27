import {
  Banner,
  Box,
  Button,
  DisabledScope,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ArrowLeft, Heart } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams, useSearchParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";

import { mealsApi } from "../api";
import { DecimalField } from "../components/DecimalField";
import { UnitPicker } from "../components/UnitPicker";
import { useNotify } from "../components/useNotify";
import type { MealEditorState } from "../editorLinks";
import { PhotoField } from "../editor/PhotoField";
import { useDraftForm } from "../editor/useDraftForm";
import { useLeaveEditor } from "../editor/useLeaveEditor";
import { QuantityDialog } from "../foods/QuantityDialog";
import { useLibrary } from "../foods/useLibrary";
import { draftKey } from "../lib/editorDraft";
import {
  addIngredients,
  autoUpdateRecipeAmount,
  emptyMealForm,
  ingredientFrom,
  mealFormFromPrefill,
  mealFormFromRow,
  mealFormToWrite,
  perServing,
  removeIngredient,
  setIngredientAmount,
  staleIngredientNames,
  validateMealForm,
  type IngredientSource,
  type MealFormState,
} from "../lib/mealForm";
import { storedAmount } from "../lib/pickItems";
import { amountAndUnit } from "../lib/units";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { SourceCard } from "./CooktraceCard";
import { IngredientList } from "./IngredientList";
import { IngredientPicker } from "./IngredientPicker";
import {
  amountOfIngredient,
  loggableIngredient,
  loggableSource,
} from "./ingredientSources";
import { MealTotalsCard } from "./MealTotalsCard";

function Loading() {
  const { t } = useTranslation("nutrition");
  return (
    <Stack align="center" padding={6}>
      <Spinner label={t("common.loading")} />
    </Stack>
  );
}

export function MealEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const { isLoaded } = useNtSettings();
  const state = (location.state ?? {}) as MealEditorState;
  if (!isLoaded) return <Loading />;
  return (
    <MealEditor
      key={`${id ?? "new"}-${location.key}`}
      id={id ? Number(id) : null}
      isAskedRecipe={params.get("recipe") === "1"}
      state={state}
    />
  );
}

type Dialog =
  | { kind: "picker" }
  | { kind: "amounts"; sources: IngredientSource[] }
  | { kind: "edit"; index: number };

function MealEditor({
  id,
  isAskedRecipe,
  state,
}: {
  id: number | null;
  isAskedRecipe: boolean;
  state: MealEditorState;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const notify = useNotify();
  const leave = useLeaveEditor("/nutrition/foods?tab=meals");
  const { sessions } = useAuth();
  const userId =
    sessions?.nt.state === "signed-in" ? sessions.nt.user.id : null;
  const [owner, setOwner] = useState<number | null>(null);
  const [key] = useState(() =>
    draftKey("meal", id, state.prefill ?? null, userId),
  );
  const draft = useDraftForm<MealFormState>(key, async () => {
    if (state.prefill) return mealFormFromPrefill(state.prefill);
    if (id === null) return emptyMealForm(isAskedRecipe);
    const row = await mealsApi.get(id);
    setOwner(row.user_id);
    return mealFormFromRow(row);
  });
  const { form, change } = draft;
  const { own } = useLibrary();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (draft.error) {
    return (
      <Stack gap={3} padding={4}>
        <Banner
          text={t("editor.loadFailed", { message: draft.error.message })}
        />
        <Button variant="secondary" text={t("editor.back")} onClick={leave} />
      </Stack>
    );
  }
  if (!form) return <Loading />;

  const isReadOnly =
    form.sharedBy !== null ||
    (owner !== null && userId !== null && owner !== userId);
  const set = (changes: Partial<MealFormState>) => {
    change((current) => ({ ...current, ...changes }));
  };
  const close = () => {
    setDialog(null);
  };

  const stale = own.data
    ? staleIngredientNames(form.items, [
        own.data.foods,
        own.data.meals,
        own.data.recipes,
      ])
    : [];
  const serving = form.isRecipe ? perServing(form) : null;

  const save = async () => {
    if (isBusy) return;
    const problem = validateMealForm(form).at(0);
    if (problem) {
      notify.error(
        t(
          problem === "nameRequired"
            ? "editor.nameRequired"
            : "mealEditor.ingredients.required",
        ),
      );
      return;
    }
    setIsBusy(true);
    try {
      const write = mealFormToWrite(form);
      if (form.id === null) await mealsApi.create(write);
      else await mealsApi.update(form.id, write);
      draft.forget();
      notify.success(t("editor.saved"));
      leave();
    } catch (caught) {
      notify.error(
        t("editor.saveFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
      setIsBusy(false);
    }
  };

  const copyShared = async () => {
    if (form.id === null) return;
    setIsBusy(true);
    try {
      await mealsApi.copy(form.id);
      draft.forget();
      notify.success(t("foods.toast.savedToCatalog"));
      leave();
    } catch (caught) {
      notify.failure(caught);
      setIsBusy(false);
    }
  };

  const title = isReadOnly
    ? form.sharedBy
      ? t("editor.shared.title", { name: form.sharedBy })
      : t("editor.shared.unnamed")
    : t(
        form.id === null
          ? form.isRecipe
            ? "mealEditor.newRecipe"
            : "mealEditor.newMeal"
          : form.isRecipe
            ? "mealEditor.editRecipe"
            : "mealEditor.editMeal",
      );
  const edited =
    dialog?.kind === "edit" ? form.items.at(dialog.index) : undefined;

  return (
    <Stack gap={3} padding={4} maxWidth="2xl" isCentered fill="width">
      <Row gap={2} align="center" justify="between">
        <Button size="sm" aria-label={t("editor.back")} onClick={leave}>
          <ArrowLeft aria-hidden size={18} />
        </Button>
        <Box shouldGrow>
          <Text variant="title" as="h1" isTruncated>
            {title}
          </Text>
        </Box>
        {form.id !== null && !isReadOnly && (
          <Button
            size="sm"
            aria-label={t(
              form.isFavorite
                ? "editor.favorite.remove"
                : "editor.favorite.add",
            )}
            aria-pressed={form.isFavorite}
            onClick={() => {
              set({ isFavorite: !form.isFavorite });
            }}
          >
            <Heart
              aria-hidden
              size={18}
              fill={form.isFavorite ? "currentColor" : "none"}
            />
          </Button>
        )}
        {!isReadOnly && (
          <Button
            size="md"
            variant="primary"
            text={t("editor.save")}
            isLoading={isBusy}
            onClick={() => void save()}
          />
        )}
      </Row>

      {isReadOnly && (
        <>
          <Banner text={t("editor.shared.readOnly")} />
          <Button
            variant="primary"
            size="lg"
            text={t("editor.shared.copy")}
            isLoading={isBusy}
            onClick={() => void copyShared()}
          />
        </>
      )}
      {draft.isRestored && (
        <Banner
          text={t("editor.draft.restored")}
          actionText={t("editor.draft.discard")}
          onAction={draft.discard}
        />
      )}
      {stale.length > 0 && (
        <Banner text={t("mealEditor.stale", { names: stale.join(", ") })} />
      )}
      <SourceCard
        form={form}
        onChange={change}
        onRemoved={() => {
          draft.forget();
          leave();
        }}
      />

      <DisabledScope isDisabled={isReadOnly}>
        <Stack gap={3}>
          <Box surface="surface" border="all" radius="lg" padding={4}>
            <Stack gap={3}>
              <PhotoField
                value={form.imgUrl}
                onChange={(imgUrl) => {
                  set({ imgUrl });
                }}
              />
              <Input
                label={`${t("mealEditor.name")} *`}
                value={form.name}
                onValueChange={(name) => {
                  set({ name });
                }}
                fieldSize="lg"
              />
              {form.isRecipe && (
                <Stack gap={2}>
                  <Row gap={2} align="end">
                    <div className="min-w-0 flex-1">
                      <DecimalField
                        label={t("mealEditor.servings.total")}
                        value={form.recipeAmount}
                        onChange={(recipeAmount) => {
                          set({ recipeAmount });
                        }}
                      />
                    </div>
                    <UnitPicker
                      value={form.recipeUnit}
                      onChange={(recipeUnit) => {
                        change((current) =>
                          autoUpdateRecipeAmount({ ...current, recipeUnit }),
                        );
                      }}
                    />
                  </Row>
                  <Text variant="caption">
                    {t("mealEditor.servings.totalHint")}
                  </Text>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    label={t("mealEditor.servings.yields")}
                    value={form.recipeYields}
                    onValueChange={(recipeYields) => {
                      set({ recipeYields });
                    }}
                    fieldSize="lg"
                  />
                  <Text variant="caption">
                    {t("mealEditor.servings.yieldsHint")}
                  </Text>
                  {serving && (
                    <Text>
                      {t("mealEditor.servings.perServing", {
                        amount: amountAndUnit(serving.amount, serving.unit),
                        energy: format.energy(serving.kcal),
                      })}
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>

          <IngredientList
            items={form.items}
            isRecipe={form.isRecipe}
            onAdd={() => {
              setDialog({ kind: "picker" });
            }}
            onEdit={(index) => {
              setDialog({ kind: "edit", index });
            }}
            onRemove={(index) => {
              change((current) => removeIngredient(current, index));
            }}
            onReorder={(items) => {
              set({ items });
            }}
          />
          <MealTotalsCard items={form.items} />

          {settings.foodsShowNotes && (
            <Box surface="surface" border="all" radius="lg" padding={4}>
              <Input
                multiline
                rows={2}
                label={t("editor.notes")}
                value={form.notes}
                onValueChange={(notes) => {
                  set({ notes });
                }}
              />
            </Box>
          )}
        </Stack>
      </DisabledScope>

      {dialog?.kind === "picker" && (
        <IngredientPicker
          excludeId={form.id}
          onClose={close}
          onPick={(sources) => {
            setDialog({ kind: "amounts", sources });
          }}
        />
      )}
      {dialog?.kind === "amounts" && (
        <QuantityDialog
          foods={dialog.sources.map(loggableSource)}
          initial={dialog.sources.map((source) => ({
            ...storedAmount(loggableSource(source)),
            quantity: source.quantity || 1,
          }))}
          confirmText={
            dialog.sources.length > 1
              ? t("mealEditor.picker.addSelected", {
                  count: dialog.sources.length,
                })
              : t("mealEditor.ingredients.add")
          }
          onClose={close}
          onConfirm={(amounts) => {
            const items = dialog.sources.map((source, index) =>
              ingredientFrom(source, amounts[index]),
            );
            change((current) => addIngredients(current, items));
            close();
          }}
        />
      )}
      {dialog?.kind === "edit" && edited && (
        <QuantityDialog
          foods={[loggableIngredient(edited)]}
          initial={[amountOfIngredient(edited)]}
          confirmText={t("common.save")}
          onClose={close}
          onConfirm={([amount]) => {
            change((current) =>
              setIngredientAmount(current, dialog.index, amount),
            );
            close();
          }}
        />
      )}
    </Stack>
  );
}
