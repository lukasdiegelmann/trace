import {
  Button,
  Dialog,
  InplaceMultiSelect,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { IconField } from "../common/IconField";
import { useNotify } from "../common/useNotify";
import { pantryApi, type PantryCategory } from "../pantryApi";

export interface CategoryFieldProps {
  categories: readonly PantryCategory[];
  categoryId: number | null;
  slug: string;
  onChange: (category: { id: number | null; slug: string }) => void;
  onCreated: (category: PantryCategory) => void;
}

/** Pick, clear or create a pantry category */
export function CategoryField({
  categories,
  categoryId,
  slug,
  onChange,
  onCreated,
}: CategoryFieldProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("kitchen");
  const [isBusy, setIsBusy] = useState(false);

  const current =
    categories.find((category) => category.id === categoryId) ??
    categories.find((category) => category.slug === slug);

  const create = async () => {
    setIsBusy(true);
    try {
      const category = await pantryApi.createCategory({
        name: name.trim(),
        icon: icon.trim() || "kitchen",
      });
      onCreated(category);
      onChange({ id: category.id, slug: category.slug });
      setIsCreating(false);
    } catch (error) {
      notify.failure(error, t("pantryItem.toast.categoryFailed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Stack gap={1}>
      <Row gap={2} align="end" shouldWrap>
        <InplaceMultiSelect
          label={t("pantryItem.fields.category")}
          placeholder={t("pantryItem.categoryPlaceholder")}
          value={current ? String(current.id) : ""}
          options={categories.map((category) => ({
            value: String(category.id),
            label: category.name,
          }))}
          onChange={(value) => {
            const category = categories.find(
              (entry) => String(entry.id) === value,
            );
            if (category) onChange({ id: category.id, slug: category.slug });
          }}
        />
        {current || slug ? (
          <Button
            size="sm"
            aria-label={t("pantryItem.clearCategory")}
            onClick={() => {
              onChange({ id: null, slug: "" });
            }}
          >
            <X aria-hidden size={14} />
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          text={t("pantryItem.newCategory.open")}
          onClick={() => {
            setName("");
            setIcon("kitchen");
            setIsCreating(true);
          }}
        >
          <Plus aria-hidden size={14} />
        </Button>
      </Row>
      {!current && slug ? (
        <Text variant="caption" tone="muted">
          {slug}
        </Text>
      ) : null}
      {isCreating ? (
        <Dialog
          open
          onOpenChange={setIsCreating}
          title={t("pantryItem.newCategory.title")}
          confirmText={t("pantryItem.newCategory.create")}
          cancelText={t("cookingCommon.cancel")}
          isConfirmDisabled={!name.trim()}
          isBusy={isBusy}
          onConfirm={create}
        >
          <Stack gap={3}>
            <Input
              label={t("pantryItem.newCategory.name")}
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <IconField value={icon} onChange={setIcon} />
          </Stack>
        </Dialog>
      ) : null}
    </Stack>
  );
}
