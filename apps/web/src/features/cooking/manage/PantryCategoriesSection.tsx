import {
  Button,
  Chip,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Plus, Tag } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CategoryIcon } from "../common/CategoryIcon";
import { IconField } from "../common/IconField";
import { ErrorState, LoadingState } from "../common/states";
import { useNotify } from "../common/useNotify";
import { filterByName } from "../lib/manage";
import { pantryApi, type PantryCategory } from "../pantryApi";
import {
  EditDeleteButtons,
  ManageRow,
  MoveButtons,
  SaveCancelButtons,
  SectionHead,
} from "./parts";
import { useCrudList } from "./useCrudList";

const AISLE_MAX = 40;

interface Fields {
  name: string;
  icon: string;
  aisle: string;
}

const BLANK: Fields = { name: "", icon: "kitchen", aisle: "" };

function CategoryFields({
  value,
  onChange,
  nameLabel,
  onSubmit,
}: {
  value: Fields;
  onChange: (fields: Fields) => void;
  nameLabel: string;
  onSubmit: () => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Stack gap={2}>
      <Row gap={2} align="end" shouldWrap>
        <Input
          label={nameLabel}
          value={value.name}
          wrapperClassName="min-w-40 flex-1"
          onChange={(event) => {
            onChange({ ...value, name: event.target.value });
          }}
          onEnter={onSubmit}
        />
        <Input
          label={t("manage.pantryCategories.aisle")}
          maxLength={AISLE_MAX}
          value={value.aisle}
          wrapperClassName="min-w-40 flex-1"
          onChange={(event) => {
            onChange({ ...value, aisle: event.target.value });
          }}
          onEnter={onSubmit}
        />
      </Row>
      <IconField
        value={value.icon}
        onChange={(icon) => {
          onChange({ ...value, icon });
        }}
      />
    </Stack>
  );
}

const toPatch = (fields: Fields) => ({
  name: fields.name.trim(),
  icon: fields.icon || null,
  default_aisle: fields.aisle.trim() || null,
});

export function PantryCategoriesSection() {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const list = useCrudList<PantryCategory>(pantryApi.categories);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<{
    item: PantryCategory;
    fields: Fields;
  } | null>(null);
  const [draft, setDraft] = useState<Fields>(BLANK);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const items = list.items ?? [];
  const shown = filterByName(items, filter);

  const save = async () => {
    if (!edit?.fields.name.trim()) return;
    await list.run(async () => {
      const updated = await pantryApi.updateCategory(edit.item.id, {
        ...toPatch(edit.fields),
        _base: edit.item,
      });
      list.setData((all) =>
        all.map((entry) =>
          entry.id === edit.item.id ? { ...entry, ...updated } : entry,
        ),
      );
      setEdit(null);
      notify.success(t("manage.toast.saved"));
    }, t("manage.toast.saveFailed"));
  };

  const create = async () => {
    if (!draft.name.trim() || isCreating) return;
    setIsCreating(true);
    await list.run(async () => {
      const created = await pantryApi.createCategory(toPatch(draft));
      list.setData((all) => [...all, created]);
      setDraft(BLANK);
      setIsAdding(false);
      notify.success(t("manage.toast.categoryAdded"));
    }, t("manage.toast.addFailed"));
    setIsCreating(false);
  };

  return (
    <Stack gap={3}>
      <SectionHead
        title={t("manage.sections.pantry-categories.label")}
        text={t("manage.pantryCategories.description")}
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
                    <CategoryFields
                      value={edit.fields}
                      nameLabel={t("manage.name")}
                      onChange={(fields) => {
                        setEdit({ ...edit, fields });
                      }}
                      onSubmit={() => void save()}
                    />
                    <SaveCancelButtons
                      canSave={Boolean(edit.fields.name.trim())}
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
                          pantryApi.reorderCategories,
                        )
                      }
                    />
                    <CategoryIcon name={item.icon} size={18} />
                    <Text as="span" className="min-w-0 flex-1">
                      {item.name}
                    </Text>
                    {item.default_aisle ? (
                      <Chip
                        icon={<Tag aria-hidden size={12} />}
                        text={item.default_aisle}
                        title={t("manage.pantryCategories.aisle")}
                      />
                    ) : null}
                    {item.pantry_count === undefined ? null : (
                      <Chip
                        tone="muted"
                        text={t("manage.itemCount", {
                          count: item.pantry_count,
                        })}
                      />
                    )}
                    <Text as="span" variant="caption" tone="muted">
                      /{item.slug}
                    </Text>
                    <EditDeleteButtons
                      name={item.name}
                      onEdit={() => {
                        setEdit({
                          item,
                          fields: {
                            name: item.name,
                            icon: item.icon ?? "",
                            aisle: item.default_aisle ?? "",
                          },
                        });
                      }}
                      onDelete={() =>
                        void list.remove(
                          item,
                          {
                            title: t("manage.confirmDelete", {
                              name: item.name,
                            }),
                            message: t("manage.pantryCategories.deleteMessage"),
                          },
                          () => pantryApi.removeCategory(item.id),
                        )
                      }
                    />
                  </>
                )}
              </ManageRow>
            ))}
          </Stack>
          {isAdding ? (
            <Stack gap={2}>
              <CategoryFields
                value={draft}
                nameLabel={t("manage.newCategory")}
                onChange={setDraft}
                onSubmit={() => void create()}
              />
              <Row gap={2} justify="end">
                <Button
                  size="sm"
                  variant="secondary"
                  text={t("cookingCommon.cancel")}
                  onClick={() => {
                    setIsAdding(false);
                  }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  text={t("cookingCommon.add")}
                  isDisabled={!draft.name.trim() || isCreating}
                  onClick={() => void create()}
                />
              </Row>
            </Stack>
          ) : (
            <Button
              size="md"
              variant="secondary"
              text={t("manage.addCategory")}
              onClick={() => {
                setDraft(BLANK);
                setIsAdding(true);
              }}
            >
              <Plus aria-hidden size={16} />
            </Button>
          )}
        </>
      )}
      {list.dialog}
    </Stack>
  );
}
