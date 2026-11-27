import {
  Button,
  Checkbox,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { moveItem } from "../lib/lists";

export interface SortableItem {
  id: string;
  label: string;
  /** Unchecked rows are hidden elsewhere; omit for a list without a toggle */
  isChecked?: boolean;
}

export interface SortableListProps {
  label: string;
  items: readonly SortableItem[];
  /** The ids in their new order */
  onReorder: (ids: string[]) => void;
  onToggle?: (id: string, isChecked: boolean) => void;
  /** After the arrows, e.g. a remove button */
  renderActions?: (item: SortableItem, index: number) => ReactNode;
  /** Replaces the label of a row, e.g. with a text field */
  renderLabel?: (item: SortableItem, index: number) => ReactNode;
}

// TODO(monolithium): a drag-to-reorder list; until then up and down buttons.
export function SortableList({
  label,
  items,
  onReorder,
  onToggle,
  renderActions,
  renderLabel,
}: SortableListProps) {
  const { t } = useTranslation("settings");
  const ids = items.map((item) => item.id);
  return (
    <Stack as="ul" gap={2} aria-label={label}>
      {items.map((item, index) => (
        <Row as="li" key={item.id} gap={2} align="center">
          <div className="min-w-0 flex-1">
            {renderLabel ? (
              renderLabel(item, index)
            ) : onToggle ? (
              <Checkbox
                label={item.label}
                checked={item.isChecked ?? true}
                onChange={(isOn) => {
                  onToggle(item.id, isOn);
                }}
              />
            ) : (
              <Text>{item.label}</Text>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("actions.moveUp", { name: item.label })}
            isDisabled={index === 0}
            onClick={() => {
              onReorder(moveItem(ids, index, index - 1));
            }}
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("actions.moveDown", { name: item.label })}
            isDisabled={index === items.length - 1}
            onClick={() => {
              onReorder(moveItem(ids, index, index + 1));
            }}
          >
            <ChevronDown aria-hidden />
          </Button>
          {renderActions?.(item, index)}
        </Row>
      ))}
    </Stack>
  );
}
