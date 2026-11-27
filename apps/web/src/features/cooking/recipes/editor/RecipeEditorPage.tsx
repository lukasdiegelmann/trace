import {
  Banner,
  Button,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { settingsStores } from "@/features/shared/settings";

import { ImagePicker } from "../../common/ImagePicker";
import { ErrorState, LoadingState } from "../../common/states";
import { useLoad } from "../../common/useLoad";
import { useNotify } from "../../common/useNotify";
import {
  autoTotal,
  draftKey,
  emptyState,
  isSameState,
  readDraft,
  stateOf,
  toRecipeInput,
  type Draft,
  type EditorState,
} from "../../lib/recipeEditor";
import { markupToRichText, richTextToMarkup } from "../../lib/richText";
import { changedFields } from "../../lib/saveHint";
import {
  createRecipe,
  getCategories,
  getPantry,
  getRecipe,
  getTags,
  getTools,
  updateRecipe,
  type PantryRow,
  type Recipe,
  type RecipeCategory,
} from "../../recipesApi";
import { readJson, writeJson } from "../../timers/store";
import { StarRating } from "../ui/StarRating";

import { FormattedField } from "./FormattedField";
import { IngredientsEditor } from "./IngredientsEditor";
import { NutritionEditor } from "./NutritionEditor";
import { StepsEditor } from "./StepsEditor";
import { CategoryField, NameField } from "./TaxonomyFields";
import { VideoField } from "./VideoField";

const DRAFT_DELAY_MS = 1500;

function removeDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing stored then
  }
}

/** Suggestions for the fields; each may be missing without harm */
async function loadSuggestions() {
  const [categories, tags, tools, pantry] = await Promise.all([
    getCategories().catch(() => [] as RecipeCategory[]),
    getTags().catch(() => []),
    getTools().catch(() => []),
    getPantry().catch(() => [] as PantryRow[]),
  ]);
  return { categories, tags, tools, pantry };
}

interface Loaded {
  /** Undefined for a new recipe */
  base: Recipe | undefined;
  initial: EditorState;
}

async function loadEditor(id: number | null): Promise<Loaded> {
  if (id === null) {
    await settingsStores.ct.ensureLoaded();
    return {
      base: undefined,
      initial: emptyState(settingsStores.ct.get("defaultServings")),
    };
  }
  const base = await getRecipe(id);
  return {
    base,
    initial: stateOf(base, richTextToMarkup(base.notes)),
  };
}

interface FormProps extends Loaded {
  id: number | null;
}

function EditorForm({ id, base, initial }: FormProps) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const notify = useNotify();
  const suggestions = useLoad(loadSuggestions);
  const [state, setState] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [created, setCreated] = useState<RecipeCategory[]>([]);
  const key = draftKey(id);
  const [restorable, setRestorable] = useState<Draft | null>(() => {
    const draft = readDraft(readJson(key));
    if (!draft) removeDraft(key);
    return draft;
  });
  const isDirty = !isSameState(state, initial);
  const isDone = useRef(false);

  // Only changes are kept; an untouched form leaves no draft behind.
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      if (!isDone.current) {
        writeJson(key, { v: 1, ts: Date.now(), state } satisfies Draft);
      }
    }, DRAFT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [state, isDirty, key]);

  const patch = (values: Partial<EditorState>) => {
    setState((previous) => ({ ...previous, ...values }));
  };
  const trackUpload = useCallback((isBusy: boolean) => {
    setUploads((count) => Math.max(0, count + (isBusy ? 1 : -1)));
  }, []);

  const leave = (to: string) => {
    isDone.current = true;
    removeDraft(key);
    void navigate(to);
  };

  const save = async () => {
    if (!state.name.trim()) {
      notify.error(t("recipeEditor.nameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      // Untouched notes keep their stored form.
      const notes =
        base && state.notes === initial.notes
          ? (base.notes ?? "")
          : markupToRichText(state.notes);
      const input = toRecipeInput(state, notes);
      const saved = base
        ? await updateRecipe(base, input, changedFields(input, base))
        : await createRecipe(input);
      leave(`/cooking/recipes/${saved.id}`);
    } catch (caught) {
      notify.failure(caught, t("recipeEditor.saveFailed"));
      setIsSaving(false);
    }
  };

  const data = suggestions.data;
  const categories = [...(data?.categories ?? []), ...created];
  const isUploading = uploads > 0 || isVideoUploading;
  const total = autoTotal(state);

  const numberField = (
    field:
      | "prepMinutes"
      | "cookMinutes"
      | "restMinutes"
      | "totalMinutes"
      | "servings",
    label: string,
    extra: { placeholder?: string; title?: string; min?: number } = {},
  ) => (
    <Input
      type="number"
      min={extra.min ?? 0}
      label={label}
      title={extra.title}
      placeholder={extra.placeholder}
      value={state[field]}
      onValueChange={(value) => {
        patch({ [field]: value });
      }}
    />
  );

  return (
    <Stack gap={4} padding={4} className="mx-auto w-full max-w-5xl">
      <Row justify="between" align="center" gap={2} shouldWrap>
        <Text variant="title" as="h1">
          {base ? t("recipeEditor.editTitle") : t("recipeEditor.newTitle")}
        </Text>
        <Row gap={2}>
          <Button
            size="md"
            variant="secondary"
            text={t("cookingCommon.cancel")}
            onClick={() => {
              leave(base ? `/cooking/recipes/${base.id}` : "/cooking");
            }}
          />
          <Button
            size="md"
            variant="primary"
            text={
              isUploading
                ? t("recipeEditor.uploading")
                : t("cookingCommon.save")
            }
            isLoading={isSaving}
            isDisabled={isSaving || isUploading}
            onClick={() => void save()}
          />
        </Row>
      </Row>

      {restorable && !isDirty ? (
        <Banner
          text={t("recipeEditor.draft.found")}
          actionText={t("recipeEditor.draft.restore")}
          onAction={() => {
            setState({ ...initial, ...restorable.state });
            setRestorable(null);
            notify.info(t("recipeEditor.draft.restored"));
          }}
          dismissText={t("recipeEditor.draft.discard")}
          onDismiss={() => {
            removeDraft(key);
            setRestorable(null);
          }}
        />
      ) : null}

      <ImagePicker
        label={t("recipeEditor.hero")}
        value={state.imgUrl}
        onChange={(imgUrl) => {
          patch({ imgUrl });
        }}
        onBusyChange={trackUpload}
      />
      <Input
        label={t("recipeEditor.name")}
        placeholder={t("recipeEditor.namePlaceholder")}
        value={state.name}
        onValueChange={(name) => {
          patch({ name });
        }}
      />
      <Input
        multiline
        rows={3}
        label={t("recipeEditor.description")}
        placeholder={t("recipeEditor.descriptionPlaceholder")}
        value={state.description}
        onValueChange={(description) => {
          patch({ description });
        }}
      />
      <Stack gap={1}>
        <Text variant="label">{t("recipeCommon.rating")}</Text>
        <StarRating
          size={26}
          value={state.rating}
          onChange={(rating) => {
            patch({ rating });
          }}
        />
      </Stack>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {numberField("prepMinutes", t("recipeEditor.prep"))}
        {numberField("cookMinutes", t("recipeEditor.cook"))}
        {numberField("restMinutes", t("recipeEditor.rest"), {
          title: t("recipeEditor.restHint"),
        })}
        {numberField("totalMinutes", t("recipeEditor.total"), {
          title: t("recipeEditor.totalHint"),
          placeholder:
            total > 0
              ? t("recipeEditor.autoValue", { value: total })
              : t("recipeEditor.auto"),
        })}
        {numberField("servings", t("recipeView.servings"), { min: 1 })}
      </div>
      <Input
        label={t("recipeEditor.yield")}
        placeholder={t("recipeEditor.yieldPlaceholder")}
        value={state.yieldText}
        onValueChange={(yieldText) => {
          patch({ yieldText });
        }}
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <IngredientsEditor
          groups={state.ingredientGroups}
          pantry={data?.pantry ?? []}
          onChange={(ingredientGroups) => {
            patch({ ingredientGroups });
          }}
        />
        <StepsEditor
          steps={state.steps}
          groups={state.ingredientGroups}
          onBusyChange={trackUpload}
          onChange={(steps) => {
            patch({ steps });
          }}
        />
      </div>

      <CategoryField
        categories={categories}
        value={state.categoryId}
        onChange={(categoryId) => {
          patch({ categoryId });
        }}
        onCreated={(category) => {
          setCreated((previous) => [...previous, category]);
        }}
      />
      <Link
        className="self-start text-caption text-muted underline"
        to="/cooking/manage/recipe-categories"
      >
        {t("recipeEditor.category.manage")}
      </Link>
      <NameField
        label={t("recipeView.tags")}
        placeholder={t("recipeEditor.tagsPlaceholder")}
        createText={t("recipeEditor.createTag")}
        value={state.tags}
        suggestions={data?.tags ?? []}
        onChange={(tags) => {
          patch({ tags });
        }}
      />
      <NameField
        label={t("recipeView.gear")}
        placeholder={t("recipeEditor.gearPlaceholder")}
        createText={t("recipeEditor.createGear")}
        value={state.tools}
        suggestions={data?.tools ?? []}
        onChange={(tools) => {
          patch({ tools });
        }}
      />
      <NutritionEditor
        values={state.nutrition}
        groups={state.ingredientGroups}
        servings={state.servings}
        onChange={(nutrition) => {
          patch({ nutrition });
        }}
      />
      <Input
        type="url"
        label={t("recipeEditor.source")}
        placeholder="https://"
        value={state.sourceUrl}
        onValueChange={(sourceUrl) => {
          patch({ sourceUrl });
        }}
      />
      <VideoField
        value={state.videoUrl}
        isUploading={isVideoUploading}
        onUploading={setIsVideoUploading}
        onChange={(videoUrl) => {
          patch({ videoUrl });
        }}
      />
      <Stack gap={1}>
        <Text variant="label">{t("recipeView.notes")}</Text>
        <FormattedField
          isRich
          label={t("recipeView.notes")}
          placeholder={t("recipeEditor.notesPlaceholder")}
          hint={t("recipeCommon.markupHint")}
          value={state.notes}
          onChange={(notes) => {
            patch({ notes });
          }}
        />
      </Stack>
    </Stack>
  );
}

function Editor({ id }: { id: number | null }) {
  const { data, error, reload } = useLoad(
    useCallback(() => loadEditor(id), [id]),
  );
  if (!data) {
    return error ? (
      <ErrorState message={error} onRetry={() => void reload()} />
    ) : (
      <LoadingState />
    );
  }
  return <EditorForm id={id} {...data} />;
}

/** `/cooking/recipes/new` and `/cooking/recipes/:id/edit` */
export function RecipeEditorPage() {
  const { id } = useParams();
  return <Editor key={id ?? "new"} id={id ? Number(id) : null} />;
}
