import {
  Box,
  Button,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import { DecimalField } from "../components/DecimalField";
import { MacroStats } from "../components/Macros";
import { UnitPicker } from "../components/UnitPicker";
import { parsePositive, toInputValue } from "../lib/decimal";
import { round1 } from "../lib/nutrition";
import {
  diarySource,
  storedAmount,
  type Amount,
  type Loggable,
} from "../lib/pickItems";
import { amountAndUnit, parseAltUnits, unitSystem } from "../lib/units";
import { useNtSettings } from "../settings";

interface Draft {
  portion: string;
  unit: string;
  quantity: string;
}

const draftOf = (amount: Amount): Draft => ({
  portion: toInputValue(amount.portion),
  unit: amount.unit,
  quantity: toInputValue(amount.quantity),
});

function amountOf(food: Loggable, draft: Draft): Amount {
  return {
    portion: parsePositive(draft.portion) ?? storedAmount(food).portion,
    unit: draft.unit,
    quantity: parsePositive(draft.quantity) ?? 1,
  };
}

/** How much of one or several foods goes into the diary */
export function QuantityDialog({
  foods,
  initial,
  confirmText,
  onConfirm,
  onClose,
}: {
  foods: Loggable[];
  /** Starting amounts; each food's stored one without */
  initial?: Amount[];
  confirmText?: string;
  onConfirm: (amounts: Amount[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const [drafts, setDrafts] = useState(() =>
    foods.map((food, index) => draftOf(initial?.[index] ?? storedAmount(food))),
  );
  const isSingle = foods.length === 1;
  const confirm = () => {
    onConfirm(foods.map((food, index) => amountOf(food, drafts[index])));
  };

  return (
    <AppDialog
      title={
        isSingle
          ? foods[0].name
          : t("foods.quantity.multiTitle", { count: foods.length })
      }
      description={isSingle ? (foods[0].brand ?? undefined) : undefined}
      onClose={onClose}
      confirmText={
        confirmText ??
        (isSingle
          ? t("foods.quantity.confirm")
          : t("foods.quantity.confirmCount", { count: foods.length }))
      }
      onConfirm={confirm}
    >
      <Stack gap={5}>
        {foods.map((food, index) => (
          <AmountFields
            key={`${food.id}-${index}`}
            food={food}
            draft={drafts[index]}
            onChange={(draft) => {
              setDrafts(drafts.map((d, i) => (i === index ? draft : d)));
            }}
            onEnter={confirm}
            isSingle={isSingle}
            isFirst={index === 0}
          />
        ))}
      </Stack>
    </AppDialog>
  );
}

function AmountFields({
  food,
  draft,
  onChange,
  onEnter,
  isSingle,
  isFirst,
}: {
  food: Loggable;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onEnter: () => void;
  isSingle: boolean;
  isFirst: boolean;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const amount = amountOf(food, draft);
  const source = diarySource(food, amount);
  const altUnits = parseAltUnits(food.alt_units) ?? [];
  const shouldShowMetadata =
    settings.showUnitMetadata || settings.warnUnitMismatch;
  const system = unitSystem(draft.unit);
  const isMismatch =
    settings.warnUnitMismatch &&
    Boolean(food.nutrition_basis) &&
    !food.density_g_ml &&
    system !== null &&
    system !== food.nutrition_basis;
  const shouldFocusPortion = settings.diaryDefaultField === "portion";
  const total = amount.quantity;

  return (
    <Stack gap={3}>
      {!isSingle && (
        <Stack gap={0}>
          <Text variant="heading" as="h3">
            {food.name}
          </Text>
          {food.brand && <Text variant="caption">{food.brand}</Text>}
        </Stack>
      )}
      {food.notes && (
        <Box surface="surface" radius="md" padding={2}>
          <Text variant="small" shouldKeepLineBreaks>
            {food.notes}
          </Text>
        </Box>
      )}
      {shouldShowMetadata && food.nutrition_basis && (
        <Text variant="caption">
          {t("foods.quantity.per", { unit: food.nutrition_basis })}
        </Text>
      )}
      {shouldShowMetadata && altUnits.length > 0 && (
        <Row gap={2} shouldWrap>
          {altUnits.map((unit) => (
            <Button
              key={unit.abbr}
              size="sm"
              variant="secondary"
              text={t("foods.quantity.altUnit", {
                abbr: unit.abbr,
                grams: unit.grams,
              })}
              onClick={() => {
                onChange({ ...draft, portion: "1", unit: unit.abbr });
              }}
            />
          ))}
        </Row>
      )}
      <Row gap={2} align="end">
        <div className="min-w-0 flex-1">
          <DecimalField
            label={t("diary.edit.portion")}
            value={draft.portion}
            onChange={(portion) => {
              onChange({ ...draft, portion });
            }}
            onEnter={onEnter}
            hasAutoFocus={isFirst && shouldFocusPortion}
          />
        </div>
        <UnitPicker
          value={draft.unit}
          onChange={(unit) => {
            onChange({ ...draft, unit });
          }}
          extraUnits={altUnits}
        />
      </Row>
      <DecimalField
        label={t("diary.edit.servings")}
        value={draft.quantity}
        onChange={(quantity) => {
          onChange({ ...draft, quantity });
        }}
        onEnter={onEnter}
        hasAutoFocus={isFirst && !shouldFocusPortion}
      />
      {isMismatch && (
        <Text variant="small" tone="warning" role="alert">
          {t("foods.quantity.mismatch")}
        </Text>
      )}
      {isSingle && (
        <>
          <Text variant="small" tone="muted">
            {t("diary.edit.total", {
              amount: amountAndUnit(
                round1(amount.portion * total),
                amount.unit,
              ),
            })}
          </Text>
          <MacroStats
            kcal={(source.nutrition.calories || 0) * total}
            grams={{
              protein: round1((source.nutrition.proteins || 0) * total),
              carbs: round1((source.nutrition.carbohydrates || 0) * total),
              fat: round1((source.nutrition.fat || 0) * total),
            }}
          />
        </>
      )}
    </Stack>
  );
}
