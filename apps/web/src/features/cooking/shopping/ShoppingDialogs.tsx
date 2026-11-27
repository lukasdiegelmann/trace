import {
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Ban } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RecipePicker } from "../common/RecipePicker";
import { UnitPicker } from "../common/UnitPicker";
import { isoDate, shortDate } from "../lib/relativeTime";
import type { RestockRow, ShoppingEdit, ShoppingRow } from "../lib/shopping";
import { addDays } from "../lib/cookDiary";
import type { RecipeSummary } from "../manageApi";

export function EditItemDialog({
  row,
  onClose,
  onSave,
}: {
  row: ShoppingRow;
  onClose: () => void;
  onSave: (edit: ShoppingEdit) => void;
}) {
  const { t } = useTranslation("cooking");
  const [edit, setEdit] = useState<ShoppingEdit>({
    name: row.name,
    quantity: row.quantity === null ? "" : String(row.quantity),
    unit: row.unit ?? "",
  });
  const save = () => {
    onSave(edit);
  };
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("shopping.edit.title")}
      confirmText={t("cookingCommon.save")}
      cancelText={t("cookingCommon.cancel")}
      onConfirm={save}
    >
      <Stack gap={3}>
        <Input
          label={t("shopping.edit.name")}
          value={edit.name}
          autoFocus
          onChange={(event) => {
            setEdit({ ...edit, name: event.target.value });
          }}
          onEnter={save}
        />
        <Row gap={2} align="end">
          <Input
            label={t("shopping.edit.quantity")}
            inputMode="decimal"
            value={edit.quantity}
            wrapperClassName="w-28"
            onChange={(event) => {
              setEdit({ ...edit, quantity: event.target.value });
            }}
            onEnter={save}
          />
          <div className="min-w-0 flex-1">
            <UnitPicker
              label={t("shopping.edit.unit")}
              value={edit.unit}
              onChange={(unit) => {
                setEdit((current) => ({ ...current, unit }));
              }}
            />
          </div>
        </Row>
      </Stack>
    </Dialog>
  );
}

const AISLE_MAX = 40;

/** Pick a known aisle, type a new one, or none */
export function AisleDialog({
  current,
  aisles,
  onClose,
  onPick,
}: {
  current: string | null;
  aisles: readonly string[];
  onClose: () => void;
  onPick: (aisle: string) => void;
}) {
  const { t } = useTranslation("cooking");
  const [typed, setTyped] = useState(current ?? "");
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("shopping.aisle.title")}
      description={t("shopping.aisle.help")}
      confirmText={t("shopping.aisle.set")}
      cancelText={t("cookingCommon.cancel")}
      onConfirm={() => {
        onPick(typed);
      }}
    >
      <Stack gap={3}>
        <Input
          label={t("shopping.aisle.input")}
          maxLength={AISLE_MAX}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
          onEnter={() => {
            onPick(typed);
          }}
        />
        <Row
          gap={1}
          shouldWrap
          role="group"
          aria-label={t("shopping.aisle.known")}
        >
          <Button
            size="sm"
            variant="secondary"
            text={t("shopping.aisle.none")}
            onClick={() => {
              onPick("");
            }}
          >
            <Ban aria-hidden size={14} />
          </Button>
          {aisles.map((aisle) => {
            const isCurrent =
              (current ?? "").toLowerCase() === aisle.toLowerCase();
            return (
              <Button
                key={aisle}
                size="sm"
                variant={isCurrent ? "primary" : "secondary"}
                aria-pressed={isCurrent}
                text={aisle}
                onClick={() => {
                  onPick(aisle);
                }}
              />
            );
          })}
        </Row>
      </Stack>
    </Dialog>
  );
}

export interface RestockChoice extends RestockRow {
  isEnabled: boolean;
}

/** "Clear Checked", offering to mark bought pantry items in stock */
export function ClearCheckedDialog({
  count,
  rows,
  isBusy,
  onClose,
  onConfirm,
}: {
  count: number;
  rows: readonly RestockRow[];
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (choices: RestockChoice[]) => void;
}) {
  const { t } = useTranslation("cooking");
  const [choices, setChoices] = useState<RestockChoice[]>(() =>
    rows.map((row) => ({ ...row, isEnabled: true })),
  );
  const patch = (key: string, changes: Partial<RestockChoice>) => {
    setChoices((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  };
  return (
    <Dialog
      open
      variant="danger"
      isBusy={isBusy}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
      title={t("shopping.clear.title", { count })}
      description={t("shopping.clear.description")}
      confirmText={t("shopping.clear.confirm")}
      cancelText={t("cookingCommon.cancel")}
      onConfirm={() => {
        onConfirm(choices);
      }}
    >
      {choices.length > 0 ? (
        <Stack gap={2}>
          <Text variant="label">{t("shopping.clear.restockLabel")}</Text>
          <Text variant="small" tone="muted">
            {t("shopping.clear.restockHint")}
          </Text>
          {choices.map((row) => (
            <Stack key={row.key} gap={1}>
              <Checkbox
                checked={row.isEnabled}
                label={row.label}
                onChange={(isEnabled) => {
                  patch(row.key, { isEnabled });
                }}
              />
              {row.options ? (
                <Row
                  gap={1}
                  shouldWrap
                  className="pl-6"
                  role="group"
                  aria-label={t("shopping.clear.variant", { name: row.label })}
                >
                  {row.options.map((option) => (
                    <Button
                      key={option.id}
                      size="sm"
                      variant={
                        row.selectedId === option.id ? "primary" : "secondary"
                      }
                      aria-pressed={row.selectedId === option.id}
                      isDisabled={!row.isEnabled}
                      text={option.name}
                      onClick={() => {
                        patch(row.key, { selectedId: option.id });
                      }}
                    />
                  ))}
                </Row>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Dialog>
  );
}

export function FromRecipeDialog({
  isBusy,
  onClose,
  onPick,
}: {
  isBusy: boolean;
  onClose: () => void;
  onPick: (recipe: RecipeSummary, shouldOnlyAddMissing: boolean) => void;
}) {
  const { t } = useTranslation("cooking");
  const [isOnlyMissing, setIsOnlyMissing] = useState(true);
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("shopping.fromRecipe.title")}
      cancelText={t("cookingCommon.close")}
    >
      <Stack gap={3}>
        <Checkbox
          checked={isOnlyMissing}
          label={t("shopping.onlyMissing")}
          onChange={setIsOnlyMissing}
        />
        <RecipePicker
          hasPantryMatch
          isDisabled={isBusy}
          onPick={(recipe) => {
            onPick(recipe, isOnlyMissing);
          }}
        />
      </Stack>
    </Dialog>
  );
}

export function FromPlanDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (from: string, to: string, shouldOnlyAddMissing: boolean) => void;
}) {
  const { t, i18n } = useTranslation("cooking");
  const [from, setFrom] = useState(() => isoDate(new Date()));
  const [to, setTo] = useState(() => isoDate(addDays(new Date(), 7)));
  const [isOnlyMissing, setIsOnlyMissing] = useState(true);
  const format = (date: string) => shortDate(date, i18n.language);
  return (
    <Dialog
      open
      isBusy={isBusy}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("shopping.fromPlan.title")}
      description={t("shopping.fromPlan.help")}
      confirmText={t("shopping.fromPlan.confirm")}
      cancelText={t("cookingCommon.cancel")}
      isConfirmDisabled={!from || !to}
      onConfirm={() => {
        onConfirm(from, to, isOnlyMissing);
      }}
    >
      <Stack gap={3}>
        <Row gap={2} shouldWrap>
          <DatePicker
            label={t("shopping.fromPlan.from")}
            value={from || null}
            maxDate={to || undefined}
            format={format}
            onChange={(date) => {
              setFrom(date ?? "");
            }}
          />
          <DatePicker
            label={t("shopping.fromPlan.to")}
            value={to || null}
            minDate={from || undefined}
            format={format}
            onChange={(date) => {
              setTo(date ?? "");
            }}
          />
        </Row>
        <Checkbox
          checked={isOnlyMissing}
          label={t("shopping.onlyMissing")}
          onChange={setIsOnlyMissing}
        />
      </Stack>
    </Dialog>
  );
}
