import {
  Button,
  Input,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { foldText } from "../lib/searchText";

const SUGGESTIONS = 8;

/**
 * Name (with the pantry's names as suggestions), an optional quantity and
 * Add; the unit is set in the row's edit dialog.
 * TODO(monolithium): a creatable combobox
 */
export function QuickAdd({
  names,
  onAdd,
}: {
  names: readonly string[];
  /** Resolves to true when the row was added */
  onAdd: (name: string, quantity: number | null) => Promise<boolean>;
}) {
  const { t } = useTranslation("cooking");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const trimmed = name.trim();
  const needle = foldText(trimmed);
  const suggestions =
    isTyping && needle
      ? names
          .filter(
            (entry) =>
              foldText(entry).includes(needle) && foldText(entry) !== needle,
          )
          .slice(0, SUGGESTIONS)
      : [];

  const add = async () => {
    if (!trimmed || isBusy) return;
    setIsBusy(true);
    const typed = Number(quantity.replace(",", "."));
    const isAdded = await onAdd(
      trimmed,
      quantity.trim() === "" || !Number.isFinite(typed) ? null : typed,
    );
    setIsBusy(false);
    if (!isAdded) return;
    setName("");
    setQuantity("");
    setIsTyping(false);
  };

  return (
    <Stack gap={1}>
      <Row gap={2} align="end">
        <Input
          label={t("shopping.quickAdd.name")}
          value={name}
          wrapperClassName="min-w-0 flex-1"
          onChange={(event) => {
            setName(event.target.value);
            setIsTyping(true);
          }}
          onEnter={() => void add()}
        />
        <Input
          label={t("shopping.quickAdd.quantity")}
          inputMode="decimal"
          value={quantity}
          wrapperClassName="w-20"
          onChange={(event) => {
            setQuantity(event.target.value);
          }}
          onEnter={() => void add()}
        />
        <Button
          variant="primary"
          size="md"
          text={t("cookingCommon.add")}
          isDisabled={!trimmed || isBusy}
          onClick={() => void add()}
        >
          <Plus aria-hidden size={16} />
        </Button>
      </Row>
      {suggestions.length > 0 ? (
        <Row
          gap={1}
          shouldWrap
          role="group"
          aria-label={t("shopping.quickAdd.suggestions")}
        >
          {suggestions.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => {
                setName(entry);
                setIsTyping(false);
              }}
              className="rounded-control bg-level-2! px-2 py-1 hover:bg-level-3!"
            >
              <Text as="span" variant="small">
                {entry}
              </Text>
            </Pressable>
          ))}
        </Row>
      ) : null}
    </Stack>
  );
}
