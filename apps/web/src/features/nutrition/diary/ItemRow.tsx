import {
  Checkbox,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { RowMenu } from "../components/RowMenu";

export interface ItemRowProps {
  name: string;
  meta: string;
  thumb?: ReactNode;
  onPress: () => void;
  actions?: MenuItem[];
  /** Select mode: the row toggles instead of opening */
  selection?: { isSelected: boolean; onToggle: () => void } | null;
  onDragStart?: (event: DragEvent) => void;
  /** After the text, e.g. a split recipe's toggle */
  trailing?: ReactNode;
}

/** A logged entry: press to edit; actions by button, right-click or long press */
export function ItemRow({
  name,
  meta,
  thumb,
  onPress,
  actions,
  selection,
  onDragStart,
  trailing,
}: ItemRowProps) {
  const { t } = useTranslation("nutrition");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasMenu = Boolean(actions) && !selection;
  return (
    <div
      draggable={Boolean(onDragStart) && !selection}
      onDragStart={onDragStart}
      onContextMenu={
        hasMenu
          ? (event) => {
              event.preventDefault();
              setIsMenuOpen(true);
            }
          : undefined
      }
      className="select-none"
    >
      <Row gap={2} align="center" paddingX={3}>
        {selection && (
          <Checkbox
            checked={selection.isSelected}
            onChange={selection.onToggle}
            aria-label={t("diary.selectItem", { name })}
          />
        )}
        <Pressable
          onPress={selection ? selection.onToggle : onPress}
          shouldGrow
          paddingY={2}
        >
          <Row gap={3} align="center">
            {thumb}
            <Stack gap={0} shouldGrow>
              <Text isTruncated>{name}</Text>
              <Text variant="caption" isTruncated>
                {meta}
              </Text>
            </Stack>
          </Row>
        </Pressable>
        {trailing}
        {hasMenu && actions && (
          <RowMenu
            items={actions}
            label={t("diary.itemActions", { name })}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          />
        )}
      </Row>
    </div>
  );
}
