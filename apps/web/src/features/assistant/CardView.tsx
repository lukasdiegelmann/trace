import {
  Button,
  Field,
  InplaceMultiSelect,
  KeyValue,
  Panel,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { aiErrorText } from "@/features/shared/ai";

import type { PendingCard } from "./useChat";

/** A proposal: nothing is saved until the user picks an action */
export function CardView({
  entry,
  onDiscard,
  onDone,
}: {
  entry: PendingCard;
  onDiscard: () => void;
  onDone: (line: string) => void;
}) {
  const { t } = useTranslation("assistant");
  const { card } = entry;
  const [selected, setSelected] = useState(card.select?.initial ?? "");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (actionId: string) => {
    const action = card.actions.find((candidate) => candidate.id === actionId);
    if (!action || busyAction) return;
    setBusyAction(actionId);
    setError(null);
    try {
      onDone(await action.run(selected));
    } catch (caught) {
      setError(aiErrorText(caught));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Panel title={card.title} density="compact">
      <Stack gap={2}>
        {card.rows.map(([label, value]) => (
          <KeyValue key={label} label={label} value={value} />
        ))}
        {entry.done ? (
          <Text variant="small" tone="success" role="status">
            {entry.done}
          </Text>
        ) : (
          <>
            {card.select ? (
              <Field label={card.select.label}>
                <InplaceMultiSelect
                  label={card.select.label}
                  isFullWidth
                  value={selected}
                  options={card.select.options}
                  onChange={setSelected}
                />
              </Field>
            ) : null}
            {error ? (
              <Text variant="small" tone="danger" role="alert">
                {error}
              </Text>
            ) : null}
            <Row gap={2} shouldWrap>
              <Button
                variant="ghost"
                size="sm"
                text={t("discard")}
                isDisabled={busyAction !== null}
                onClick={onDiscard}
              />
              {card.actions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.isPrimary ? "primary" : "secondary"}
                  size="sm"
                  text={action.text}
                  isLoading={busyAction === action.id}
                  isDisabled={
                    busyAction !== null ||
                    !(action.isEnabled?.(selected) ?? true)
                  }
                  onClick={() => void run(action.id)}
                />
              ))}
            </Row>
          </>
        )}
      </Stack>
    </Panel>
  );
}
