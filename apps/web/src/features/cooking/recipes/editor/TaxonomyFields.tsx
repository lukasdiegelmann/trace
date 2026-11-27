import {
  Dialog,
  Input,
  MultiSelect,
  Stack,
  Text,
  Button,
  Row,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import { foldText } from "../../lib/searchText";
import {
  createCategory,
  type NameCount,
  type RecipeCategory,
} from "../../recipesApi";

/** The colours a new category can have (RecipeEditor.svelte); data */
const CATEGORY_COLOURS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#d97706",
];

const filter = (option: { label: string }, query: string) =>
  foldText(option.label).includes(foldText(query).trim());

/** Tags or kitchen gear: pick from what other recipes use, or add */
export function NameField({
  label,
  placeholder,
  createText,
  value,
  suggestions,
  onChange,
}: {
  label: string;
  placeholder: string;
  createText: string;
  value: string[];
  suggestions: NameCount[];
  onChange: (value: string[]) => void;
}) {
  const known = new Set(suggestions.map((entry) => entry.name));
  return (
    <MultiSelect
      label={label}
      placeholder={placeholder}
      value={value}
      options={[
        ...value
          .filter((name) => !known.has(name))
          .map((name) => ({ value: name, label: name })),
        ...suggestions.map((entry) => ({
          value: entry.name,
          label: entry.name,
        })),
      ]}
      filterFn={filter}
      onChange={onChange}
      addOptionButtonLabel={createText}
      onAddOption={(query) => {
        const name = query.trim();
        const isNew = !value.some(
          (entry) => entry.toLowerCase() === name.toLowerCase(),
        );
        if (name && isNew) onChange([...value, name]);
      }}
    />
  );
}

export interface CategoryFieldProps {
  categories: RecipeCategory[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreated: (category: RecipeCategory) => void;
}

/** One category per recipe, created on the spot if needed */
export function CategoryField({
  categories,
  value,
  onChange,
  onCreated,
}: CategoryFieldProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [draft, setDraft] = useState<{
    name: string;
    colour: string | null;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const create = async () => {
    if (!draft?.name.trim()) return;
    setIsBusy(true);
    try {
      const category = await createCategory(draft.name.trim(), draft.colour);
      onCreated(category);
      onChange(category.id);
      setDraft(null);
    } catch (caught) {
      notify.failure(caught, t("recipeEditor.category.failed"));
    }
    setIsBusy(false);
  };

  return (
    <>
      <MultiSelect
        label={t("recipeEditor.category.label")}
        placeholder={t("recipeEditor.category.placeholder")}
        value={value === null ? [] : [String(value)]}
        options={categories.map((category) => ({
          value: String(category.id),
          label: category.name,
          highlightColor: category.color ?? undefined,
        }))}
        filterFn={filter}
        onChange={(next) => {
          // Picking another replaces the one; unpicking clears it.
          const picked = next.find((id) => id !== String(value));
          if (picked) onChange(Number(picked));
          else if (next.length === 0) onChange(null);
        }}
        addOptionButtonLabel={t("recipeEditor.category.create")}
        onAddOption={(query) => {
          setDraft({
            name: query,
            colour:
              CATEGORY_COLOURS[
                Math.floor(Math.random() * CATEGORY_COLOURS.length)
              ],
          });
        }}
      />
      {draft ? (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setDraft(null);
          }}
          title={t("recipeEditor.category.newTitle")}
          cancelText={t("cookingCommon.cancel")}
          confirmText={t("cookingCommon.add")}
          isConfirmDisabled={!draft.name.trim()}
          isBusy={isBusy}
          onConfirm={create}
        >
          <Stack gap={3}>
            <Input
              autoFocus
              label={t("recipeEditor.category.name")}
              value={draft.name}
              onValueChange={(name) => {
                setDraft({ ...draft, name });
              }}
            />
            <Text variant="label">{t("recipeEditor.category.colour")}</Text>
            <Row
              gap={1}
              shouldWrap
              role="radiogroup"
              aria-label={t("recipeEditor.category.colour")}
            >
              {[...CATEGORY_COLOURS, null].map((colour, index) => (
                <Button
                  key={colour ?? "none"}
                  size="sm"
                  variant={draft.colour === colour ? "secondary" : "ghost"}
                  aria-pressed={draft.colour === colour}
                  aria-label={
                    colour
                      ? t("recipeEditor.category.colourNumber", {
                          number: index + 1,
                        })
                      : t("recipeEditor.category.noColour")
                  }
                  text={
                    colour ? undefined : t("recipeEditor.category.noColour")
                  }
                  onClick={() => {
                    setDraft({ ...draft, colour });
                  }}
                >
                  {colour ? (
                    <span
                      aria-hidden
                      className="size-5 rounded-full"
                      style={{ backgroundColor: colour }}
                    />
                  ) : undefined}
                </Button>
              ))}
            </Row>
          </Stack>
        </Dialog>
      ) : null}
    </>
  );
}
