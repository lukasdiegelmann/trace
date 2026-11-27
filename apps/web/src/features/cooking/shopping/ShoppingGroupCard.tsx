import {
  Box,
  Button,
  Checkbox,
  Chip,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import {
  ArrowDown,
  ArrowUp,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink as OpenIcon,
  Square,
  Tag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RowMenu } from "../common/RowMenu";
import type { GroupMode, ShoppingGroup, ShoppingRow } from "../lib/shopping";

export interface ShoppingRowActions {
  onToggle: (row: ShoppingRow) => void;
  onEdit: (row: ShoppingRow) => void;
  onAisle: (row: ShoppingRow) => void;
  onRemove: (row: ShoppingRow) => void;
  onMove: (group: ShoppingGroup, index: number, delta: -1 | 1) => void;
}

function ShoppingRowView({
  row,
  index,
  group,
  mode,
  actions,
}: {
  row: ShoppingRow;
  index: number;
  group: ShoppingGroup;
  mode: GroupMode;
  actions: ShoppingRowActions;
}) {
  const { t } = useTranslation("cooking");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const quantity = [row.quantity, row.unit]
    .filter((part) => part !== null && part !== "")
    .join(" ");
  const recipes =
    mode === "aisle"
      ? (row.recipeNames ?? (row.recipe_name ? [row.recipe_name] : []))
      : [];
  /** Checked rows sort apart: they only move among themselves */
  const canMove = (delta: -1 | 1) => {
    const other = group.rows.at(index + delta);
    return index + delta >= 0 && other?.checked === row.checked;
  };
  const items: MenuItem[] = [
    {
      id: "edit",
      text: t("cookingCommon.edit"),
      onSelect: () => {
        actions.onEdit(row);
      },
    },
    {
      id: "aisle",
      text: t("shopping.aisle.title"),
      onSelect: () => {
        actions.onAisle(row);
      },
    },
    {
      id: "delete",
      text: t("cookingCommon.delete"),
      tone: "danger",
      onSelect: () => {
        actions.onRemove(row);
      },
    },
  ];
  return (
    <li
      className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0"
      onContextMenu={(event) => {
        event.preventDefault();
        setIsMenuOpen(true);
      }}
    >
      {/* TODO(monolithium): a sortable list (drag and drop) */}
      <span className="flex flex-col">
        <Button
          className="h-5"
          aria-label={t("cookingCommon.moveUp", { name: row.name })}
          isDisabled={!canMove(-1)}
          onClick={() => {
            actions.onMove(group, index, -1);
          }}
        >
          <ArrowUp aria-hidden size={12} />
        </Button>
        <Button
          className="h-5"
          aria-label={t("cookingCommon.moveDown", { name: row.name })}
          isDisabled={!canMove(1)}
          onClick={() => {
            actions.onMove(group, index, 1);
          }}
        >
          <ArrowDown aria-hidden size={12} />
        </Button>
      </span>
      <Checkbox
        checked={row.checked}
        onChange={() => {
          actions.onToggle(row);
        }}
        label={
          <span className="sr-only">
            {t(row.checked ? "shopping.row.uncheck" : "shopping.row.check", {
              name: row.name,
            })}
          </span>
        }
      />
      <Pressable
        onPress={() => {
          actions.onToggle(row);
        }}
        className="flex min-w-0 flex-1 flex-row flex-wrap items-center justify-start gap-x-2 gap-y-1 text-start"
      >
        <Text
          as="span"
          tone={row.checked ? "muted" : "default"}
          className={row.checked ? "line-through" : ""}
        >
          {row.name}
        </Text>
        {quantity ? (
          <Text as="span" variant="small" tone="muted">
            {quantity}
          </Text>
        ) : null}
        {mode !== "aisle" && row.aisle ? (
          <Chip tone="muted" text={row.aisle} />
        ) : null}
        {recipes.map((name) => (
          <Chip
            key={name}
            tone="muted"
            icon={<Utensils aria-hidden size={12} />}
            text={name}
          />
        ))}
      </Pressable>
      <Button
        size="sm"
        aria-label={t("shopping.row.aisle", { name: row.name })}
        onClick={() => {
          actions.onAisle(row);
        }}
      >
        <Tag aria-hidden size={14} />
      </Button>
      <Button
        size="sm"
        aria-label={t("shopping.row.remove", { name: row.name })}
        onClick={() => {
          actions.onRemove(row);
        }}
      >
        <X aria-hidden size={14} />
      </Button>
      <RowMenu
        label={t("cookingCommon.actionsFor", { name: row.name })}
        items={items}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      />
    </li>
  );
}

export function ShoppingGroupCard({
  group,
  title,
  mode,
  isCollapsed,
  onToggleCollapsed,
  onCheckAll,
  onRemoveGroup,
  onOpenRecipe,
  actions,
}: {
  group: ShoppingGroup;
  /** Null in the flat list: no header */
  title: string | null;
  mode: GroupMode;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onCheckAll: (isChecked: boolean) => void;
  onRemoveGroup: () => void;
  onOpenRecipe?: () => void;
  actions: ShoppingRowActions;
}) {
  const { t } = useTranslation("cooking");
  const checked = group.rows.filter((row) => row.checked).length;
  const isDone = group.rows.length > 0 && checked === group.rows.length;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <Box
      as="section"
      border="all"
      radius="lg"
      padding={3}
      surface="surface"
      aria-label={title ?? t("shopping.title")}
      className={`mb-3 break-inside-avoid ${isDone ? "opacity-70" : ""}`}
    >
      <Stack gap={2}>
        {title === null ? null : (
          <Row gap={1} align="center">
            <Pressable
              onPress={onToggleCollapsed}
              isExpanded={!isCollapsed}
              className="flex min-w-0 flex-1 flex-row items-center justify-start gap-2 text-start"
            >
              {isCollapsed ? (
                <ChevronRight aria-hidden size={16} />
              ) : (
                <ChevronDown aria-hidden size={16} />
              )}
              <Text as="span" variant="heading" isTruncated>
                {title}
              </Text>
              <Text as="span" variant="caption" tone="muted">
                {pad(checked)}/{pad(group.rows.length)}
              </Text>
            </Pressable>
            {onOpenRecipe ? (
              <Button
                size="sm"
                aria-label={t("shopping.group.openRecipe")}
                onClick={onOpenRecipe}
              >
                <OpenIcon aria-hidden size={14} />
              </Button>
            ) : null}
            <Button
              size="sm"
              aria-label={t(
                isDone
                  ? "shopping.group.uncheckAll"
                  : "shopping.group.checkAll",
              )}
              onClick={() => {
                onCheckAll(!isDone);
              }}
            >
              {isDone ? (
                <Square aria-hidden size={14} />
              ) : (
                <CheckCheck aria-hidden size={14} />
              )}
            </Button>
            <Button
              size="sm"
              variant="danger"
              aria-label={t("shopping.group.remove")}
              onClick={onRemoveGroup}
            >
              <Trash2 aria-hidden size={14} />
            </Button>
          </Row>
        )}
        {isCollapsed ? null : (
          <Stack gap={0} as="ul">
            {group.rows.map((row, index) => (
              <ShoppingRowView
                key={row.id}
                row={row}
                index={index}
                group={group}
                mode={mode}
                actions={actions}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
