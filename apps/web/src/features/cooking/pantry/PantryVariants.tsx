import {
  ActionList,
  Button,
  Chip,
  Dialog,
  Input,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CornerDownRight, Link, Link2Off, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirm } from "../common/useConfirm";
import { useNotify } from "../common/useNotify";
import { expiryStatus } from "../lib/expiry";
import {
  newVariant,
  pickerResults,
  variantSuggestions,
  type VariantContext,
} from "../lib/pantryForm";
import { displayVariantName } from "../lib/pantryVariants";
import { shortDate } from "../lib/relativeTime";
import { pantryApi, type PantryItem, type PantryPatch } from "../pantryApi";

export interface PantryVariantsProps {
  item: PantryItem;
  context: VariantContext;
  /** Reloads the item and its siblings; the list behind too */
  onChanged: () => Promise<void>;
}

/** A pantry row as a variant, a generic or a flat item (Issue #4 there) */
export function PantryVariants({
  item,
  context,
  onChanged,
}: PantryVariantsProps) {
  const { t, i18n } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const [isAdding, setIsAdding] = useState(false);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [hasNameOverride, setHasNameOverride] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const isVariant = item.generic_parent_id != null;
  const isGeneric = !isVariant && context.children.length > 0;
  const parentName =
    context.parent?.name ?? t("pantryItem.variants.genericItem");

  const resetAdd = () => {
    setIsAdding(false);
    setBrand("");
    setName("");
    setHasNameOverride(false);
  };

  /** Runs a variant change, then reloads */
  const change = async (
    work: () => Promise<unknown>,
    done: string,
    failed: string,
  ): Promise<boolean> => {
    setIsBusy(true);
    try {
      await work();
      notify.success(done);
      await onChanged();
      return true;
    } catch (error) {
      notify.failure(error, failed);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const update = (id: number, patch: PantryPatch, done: string) =>
    change(
      () => pantryApi.update(id, patch),
      done,
      t("pantryItem.toast.variantFailed"),
    );

  const setParent = async (parentId: number | null) => {
    setIsPicking(false);
    await update(
      item.id,
      { generic_parent_id: parentId },
      t(
        parentId === null
          ? "pantryItem.toast.detached"
          : "pantryItem.toast.addedAsVariant",
      ),
    );
  };

  const detach = async () => {
    const isConfirmed = await confirm({
      title: t("pantryItem.variants.detachTitle", { name: parentName }),
      message: t("pantryItem.variants.detachMessage", { name: parentName }),
      confirmText: t("pantryItem.variants.detach"),
    });
    if (isConfirmed) await setParent(null);
  };

  const attach = async (childId: number) => {
    const isDone = await update(
      childId,
      { generic_parent_id: item.id },
      t("pantryItem.toast.linked"),
    );
    if (isDone) resetAdd();
  };

  const canCreate = Boolean(brand.trim() || (hasNameOverride && name.trim()));
  const addNew = async () => {
    if (!canCreate) {
      notify.error(t("pantryItem.toast.brandOrName"));
      return;
    }
    const seed = newVariant(
      item,
      brand,
      hasNameOverride ? name : "",
      !isGeneric,
    );
    const isDone = await change(
      () => pantryApi.createVariant(seed),
      t("pantryItem.toast.addedVariant", {
        name: displayVariantName({ name: seed.name, brand: seed.brand }, item),
      }),
      t("pantryItem.toast.variantFailed"),
    );
    if (isDone) resetAdd();
  };

  const suggestions = isAdding
    ? variantSuggestions(context.candidates, brand)
    : [];
  const createLabel = brand.trim() || (hasNameOverride ? name.trim() : "");

  const addForm = (
    <Stack gap={2} role="group" aria-label={t("pantryItem.variants.addTitle")}>
      <Text variant="label">{t("pantryItem.variants.addTitle")}</Text>
      <Text variant="small" tone="muted">
        {t("pantryItem.variants.addHint")}
      </Text>
      <Input
        label={t("pantryItem.variants.brand")}
        placeholder={t("pantryItem.variants.brandPlaceholder")}
        value={brand}
        autoFocus
        onChange={(event) => {
          setBrand(event.target.value);
        }}
        onEnter={() => void addNew()}
      />
      {suggestions.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => void attach(row.id)}
          className="flex w-full flex-row items-center gap-2 rounded-control bg-level-2! p-2 text-start hover:bg-level-3!"
        >
          <Link aria-hidden size={14} />
          <span className="min-w-0 flex-1">
            <Text as="span">
              {row.brand ? `${row.name} (${row.brand})` : row.name}
            </Text>
          </span>
          <Text as="span" variant="caption" tone="muted">
            {t("pantryItem.variants.attach")}
          </Text>
        </Pressable>
      ))}
      {brand.trim() && suggestions.length === 0 ? (
        <Text variant="small" tone="muted">
          {t("pantryItem.variants.noSuggestion")}
        </Text>
      ) : null}
      {hasNameOverride ? (
        <Input
          label={t("pantryItem.variants.nameOverride")}
          placeholder={t("pantryItem.variants.nameOverridePlaceholder")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onEnter={() => void addNew()}
        />
      ) : null}
      <Row gap={2} justify="end" shouldWrap>
        {hasNameOverride ? null : (
          <Button
            size="sm"
            text={t("pantryItem.variants.useOtherName")}
            onClick={() => {
              setHasNameOverride(true);
            }}
          />
        )}
        <Button
          size="sm"
          variant="secondary"
          text={t("cookingCommon.cancel")}
          onClick={resetAdd}
        />
        <Button
          size="sm"
          variant="primary"
          text={
            createLabel
              ? t("pantryItem.variants.createNamed", { name: createLabel })
              : t("pantryItem.variants.create")
          }
          isDisabled={!canCreate || isBusy}
          onClick={() => void addNew()}
        />
      </Row>
    </Stack>
  );

  const addButton = (
    <Button
      size="sm"
      variant="secondary"
      text={t("pantryItem.variants.add")}
      onClick={() => {
        setIsAdding(true);
      }}
    >
      <Plus aria-hidden size={14} />
    </Button>
  );

  const sourceItems = [
    {
      id: "manual",
      text: t("pantryItem.variants.sourceManual"),
      isChecked: item.nutrition_source_variant_id == null,
      onSelect: () => {
        void update(
          item.id,
          { nutrition_source_variant_id: null },
          t("pantryItem.toast.sourceManual"),
        );
      },
    },
    ...context.children.map((variant) => ({
      id: String(variant.id),
      text: t("pantryItem.variants.sourcePull", {
        name: displayVariantName(variant, item),
      }),
      isChecked: item.nutrition_source_variant_id === variant.id,
      onSelect: () => {
        void update(
          item.id,
          { nutrition_source_variant_id: variant.id },
          t("pantryItem.toast.sourceVariant"),
        );
      },
    })),
  ];

  return (
    <Stack gap={3} as="section">
      <Text variant="heading" as="h3">
        {t("pantryItem.variants.title")}
      </Text>
      {isVariant ? (
        <>
          <Text variant="small">
            {t("pantryItem.variants.isVariant", { name: parentName })}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            text={t("pantryItem.variants.detachFrom", { name: parentName })}
            isDisabled={isBusy}
            onClick={() => void detach()}
          >
            <Link2Off aria-hidden size={14} />
          </Button>
        </>
      ) : isGeneric ? (
        <>
          <Text variant="small">
            {t("pantryItem.variants.isGeneric", {
              count: context.children.length,
            })}
          </Text>
          <Stack gap={1} as="ul">
            {context.children.map((variant) => (
              <li
                key={variant.id}
                className="flex flex-wrap items-center gap-2"
              >
                <Tag aria-hidden size={14} />
                <Text as="span">
                  {displayVariantName(variant, item, { isNested: true })}
                </Text>
                {variant.in_stock ? null : (
                  <Chip tone="muted" text={t("pantryItem.variants.out")} />
                )}
                {variant.expires_on ? (
                  <Chip
                    tone={
                      expiryStatus(variant.expires_on) === "past"
                        ? "danger"
                        : expiryStatus(variant.expires_on) === "warn"
                          ? "accent"
                          : "muted"
                    }
                    text={shortDate(variant.expires_on, i18n.language)}
                  />
                ) : null}
              </li>
            ))}
          </Stack>
          {isAdding ? (
            addForm
          ) : (
            <>
              <Stack gap={1}>
                <Text variant="label">
                  {t("pantryItem.variants.sourceTitle")}
                </Text>
                <Text variant="small" tone="muted">
                  {t("pantryItem.variants.sourceHint")}
                </Text>
                <ActionList
                  label={t("pantryItem.variants.sourceTitle")}
                  items={sourceItems}
                />
              </Stack>
              {addButton}
            </>
          )}
        </>
      ) : (
        <>
          <Text variant="small">{t("pantryItem.variants.isFlat")}</Text>
          {isAdding ? (
            <>
              {addForm}
              {item.expires_on ? (
                <Text variant="small" tone="muted">
                  {t("pantryItem.variants.promoteHint", {
                    date: shortDate(item.expires_on, i18n.language),
                  })}
                </Text>
              ) : null}
            </>
          ) : (
            <Row gap={2} shouldWrap>
              {addButton}
              <Button
                size="sm"
                variant="secondary"
                text={t("pantryItem.variants.makeVariantOf")}
                onClick={() => {
                  setPickerQuery("");
                  setIsPicking(true);
                }}
              >
                <CornerDownRight aria-hidden size={14} />
              </Button>
            </Row>
          )}
        </>
      )}

      {isPicking ? (
        <Dialog
          open
          onOpenChange={setIsPicking}
          title={t("pantryItem.variants.makeVariantOf")}
          description={t("pantryItem.variants.pickerHint")}
          cancelText={t("cookingCommon.cancel")}
        >
          <Stack gap={2}>
            <Input
              type="search"
              autoFocus
              label={t("pantryItem.variants.pickerSearch")}
              value={pickerQuery}
              onChange={(event) => {
                setPickerQuery(event.target.value);
              }}
            />
            <Stack gap={1} className="max-h-72 overflow-y-auto">
              {pickerResults(context.candidates, pickerQuery).map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => void setParent(row.id)}
                  className="flex w-full flex-row items-center gap-2 rounded-control p-2 text-start hover:bg-level-3"
                >
                  <Text as="span">{row.name}</Text>
                  {row.brand ? (
                    <Text as="span" variant="caption" tone="muted">
                      {row.brand}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              {pickerResults(context.candidates, pickerQuery).length === 0 ? (
                <Text tone="muted">{t("pantryItem.variants.pickerNone")}</Text>
              ) : null}
            </Stack>
          </Stack>
        </Dialog>
      ) : null}
      {dialog}
    </Stack>
  );
}
