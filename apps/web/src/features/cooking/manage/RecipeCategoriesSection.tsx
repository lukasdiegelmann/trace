import {
  Button,
  Chip,
  Dot,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Ban, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ErrorState, LoadingState } from "../common/states";
import { useNotify } from "../common/useNotify";
import { CATEGORY_SWATCHES, filterByName } from "../lib/manage";
import { manageApi, type RecipeCategory } from "../manageApi";
import {
  EditDeleteButtons,
  ManageRow,
  MoveButtons,
  SaveCancelButtons,
  SectionHead,
} from "./parts";
import { useCrudList } from "./useCrudList";

function Swatches({
  value,
  onChange,
  canClear,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  canClear: boolean;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Row
      gap={0}
      shouldWrap
      role="group"
      aria-label={t("manage.recipeCategories.color")}
    >
      {CATEGORY_SWATCHES.map((color, index) => (
        <Button
          key={color}
          size="sm"
          variant={value === color ? "secondary" : "ghost"}
          aria-pressed={value === color}
          aria-label={t("manage.recipeCategories.colorN", {
            number: index + 1,
          })}
          onClick={() => {
            onChange(color);
          }}
        >
          <Dot color={color} size={14} />
        </Button>
      ))}
      {canClear ? (
        <Button
          size="sm"
          variant={value === null ? "secondary" : "ghost"}
          aria-pressed={value === null}
          aria-label={t("manage.recipeCategories.noColor")}
          onClick={() => {
            onChange(null);
          }}
        >
          <Ban aria-hidden size={14} />
        </Button>
      ) : null}
    </Row>
  );
}

export function RecipeCategoriesSection() {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const navigate = useNavigate();
  const list = useCrudList<RecipeCategory>(manageApi.recipeCategories);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<{
    item: RecipeCategory;
    name: string;
    color: string | null;
  } | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(CATEGORY_SWATCHES[0]);
  const [isCreating, setIsCreating] = useState(false);

  const items = list.items ?? [];
  const shown = filterByName(items, filter);

  const save = () =>
    edit && edit.name.trim()
      ? list.run(async () => {
          const updated = await manageApi.updateRecipeCategory(edit.item.id, {
            name: edit.name.trim(),
            color: edit.color,
            _base: edit.item,
          });
          // The answer has no recipe count.
          list.setData((all) =>
            all.map((entry) =>
              entry.id === updated.id ? { ...entry, ...updated } : entry,
            ),
          );
          setEdit(null);
          notify.success(t("manage.toast.saved"));
        }, t("manage.toast.saveFailed"))
      : undefined;

  const create = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    await list.run(async () => {
      const created = await manageApi.createRecipeCategory({
        name: name.trim(),
        color,
      });
      list.setData((all) => [...all, { ...created, recipe_count: 0 }]);
      setName("");
      setColor(CATEGORY_SWATCHES[0]);
      notify.success(t("manage.toast.categoryAdded"));
    }, t("manage.toast.addFailed"));
    setIsCreating(false);
  };

  return (
    <Stack gap={3}>
      <SectionHead
        title={t("manage.sections.recipe-categories.label")}
        text={t("manage.recipeCategories.description")}
      />
      {list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : !list.items ? (
        <LoadingState />
      ) : (
        <>
          {items.length === 0 ? (
            <Text tone="muted">{t("manage.noCategories")}</Text>
          ) : (
            <Input
              type="search"
              label={t("cookingCommon.filter")}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
            />
          )}
          {items.length > 0 && shown.length === 0 ? (
            <Text tone="muted">{t("manage.noMatch", { query: filter })}</Text>
          ) : null}
          <Stack gap={2} as="ul">
            {shown.map((item) => (
              <ManageRow key={item.id}>
                {edit?.item.id === item.id ? (
                  <Stack gap={2} fill="width">
                    <Input
                      label={t("manage.name")}
                      value={edit.name}
                      autoFocus
                      onChange={(event) => {
                        setEdit({ ...edit, name: event.target.value });
                      }}
                      onEnter={() => void save()}
                    />
                    <Swatches
                      value={edit.color}
                      canClear
                      onChange={(next) => {
                        setEdit({ ...edit, color: next });
                      }}
                    />
                    <SaveCancelButtons
                      canSave={Boolean(edit.name.trim())}
                      onSave={() => void save()}
                      onCancel={() => {
                        setEdit(null);
                      }}
                    />
                  </Stack>
                ) : (
                  <>
                    <MoveButtons
                      name={item.name}
                      index={items.findIndex((entry) => entry.id === item.id)}
                      count={items.length}
                      onMove={(delta) =>
                        void list.move(
                          item.id,
                          delta,
                          manageApi.reorderRecipeCategories,
                        )
                      }
                    />
                    <Dot
                      color={item.color ?? undefined}
                      tone="muted"
                      size={14}
                    />
                    <Text as="span" className="min-w-0 flex-1">
                      {item.name}
                    </Text>
                    {item.recipe_count ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        text={t("manage.recipeCount", {
                          count: item.recipe_count,
                        })}
                        onClick={() =>
                          void navigate(
                            `/cooking?category=${encodeURIComponent(item.slug)}`,
                          )
                        }
                      />
                    ) : item.recipe_count === 0 ? (
                      <Chip
                        tone="muted"
                        text={t("manage.recipeCount", { count: 0 })}
                      />
                    ) : null}
                    <Text as="span" variant="caption" tone="muted">
                      /{item.slug}
                    </Text>
                    <EditDeleteButtons
                      name={item.name}
                      onEdit={() => {
                        setEdit({ item, name: item.name, color: item.color });
                      }}
                      onDelete={() =>
                        void list.remove(
                          item,
                          {
                            title: t("manage.confirmDelete", {
                              name: item.name,
                            }),
                            message: t("manage.recipeCategories.deleteMessage"),
                          },
                          () => manageApi.removeRecipeCategory(item.id),
                        )
                      }
                    />
                  </>
                )}
              </ManageRow>
            ))}
          </Stack>
          <Stack gap={2}>
            <Row gap={2} align="end">
              <Input
                label={t("manage.newCategory")}
                value={name}
                wrapperClassName="min-w-0 flex-1"
                onChange={(event) => {
                  setName(event.target.value);
                }}
                onEnter={() => void create()}
              />
              <Button
                variant="primary"
                size="md"
                text={t("cookingCommon.add")}
                isDisabled={!name.trim() || isCreating}
                onClick={() => void create()}
              >
                <Plus aria-hidden size={16} />
              </Button>
            </Row>
            <Swatches value={color} onChange={setColor} canClear={false} />
          </Stack>
        </>
      )}
      {list.dialog}
    </Stack>
  );
}
