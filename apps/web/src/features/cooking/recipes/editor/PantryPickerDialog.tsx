import {
  Checkbox,
  Chip,
  Dialog,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { foldText } from "../../lib/searchText";
import type { PantryRow } from "../../recipesApi";

export interface PantryPickerDialogProps {
  rows: PantryRow[];
  /** Linking one row picks one; adding picks any number */
  isSingle: boolean;
  onClose: () => void;
  onPick: (rows: PantryRow[]) => void;
}

export function PantryPickerDialog({
  rows,
  isSingle,
  onClose,
  onPick,
}: PantryPickerDialogProps) {
  const { t } = useTranslation("cooking");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const needle = foldText(query).trim();
  const shown = rows.filter((row) =>
    [row.name, row.brand].some((value) => foldText(value).includes(needle)),
  );

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={
        isSingle
          ? t("recipeEditor.pantry.linkTitle")
          : t("recipeEditor.pantry.addTitle")
      }
      cancelText={t("cookingCommon.cancel")}
      confirmText={
        isSingle
          ? t("recipeEditor.pantry.link")
          : t("recipeEditor.pantry.add", { count: picked.length })
      }
      isConfirmDisabled={picked.length === 0}
      onConfirm={() => {
        onPick(picked.flatMap((id) => rows.find((r) => r.id === id) ?? []));
      }}
    >
      <Stack gap={3}>
        <Input
          type="search"
          autoFocus
          aria-label={t("recipeEditor.pantry.search")}
          placeholder={t("recipeEditor.pantry.search")}
          value={query}
          onValueChange={setQuery}
        />
        {shown.length === 0 ? (
          <Text tone="muted">
            {rows.length === 0
              ? t("recipeEditor.pantry.empty")
              : t("cookingCommon.nothingFound")}
          </Text>
        ) : null}
        <Stack gap={2} as="ul">
          {shown.map((row) => (
            <li key={row.id}>
              <Row gap={2} align="center">
                <Checkbox
                  checked={picked.includes(row.id)}
                  label={row.brand ? `${row.name} · ${row.brand}` : row.name}
                  onChange={(isChecked) => {
                    setPicked((previous) => {
                      if (!isChecked) {
                        return previous.filter((id) => id !== row.id);
                      }
                      return isSingle ? [row.id] : [...previous, row.id];
                    });
                  }}
                />
                {row.in_stock ? null : (
                  <Chip tone="muted" text={t("recipeEditor.pantry.out")} />
                )}
              </Row>
            </li>
          ))}
        </Stack>
      </Stack>
    </Dialog>
  );
}
