import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** A section's heading and what it is for */
export function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <Stack gap={1}>
      <Text variant="heading" as="h2">
        {title}
      </Text>
      <Text variant="small" tone="muted">
        {text}
      </Text>
    </Stack>
  );
}

export function ManageRow({
  children,
  isMuted = false,
}: {
  children: ReactNode;
  isMuted?: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-container border border-border bg-level-2 px-3 py-2 ${isMuted ? "opacity-60" : ""}`}
    >
      {children}
    </li>
  );
}

/**
 * Reordering by buttons, since monolithium has no sortable list.
 * TODO(monolithium): a sortable list (drag and drop)
 */
export function MoveButtons({
  name,
  index,
  count,
  onMove,
}: {
  name: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Row gap={0}>
      <Button
        size="sm"
        aria-label={t("cookingCommon.moveUp", { name })}
        isDisabled={index <= 0}
        onClick={() => {
          onMove(-1);
        }}
      >
        <ArrowUp aria-hidden size={14} />
      </Button>
      <Button
        size="sm"
        aria-label={t("cookingCommon.moveDown", { name })}
        isDisabled={index < 0 || index >= count - 1}
        onClick={() => {
          onMove(1);
        }}
      >
        <ArrowDown aria-hidden size={14} />
      </Button>
    </Row>
  );
}

export function EditDeleteButtons({
  name,
  editLabel,
  onEdit,
  onDelete,
}: {
  name: string;
  /** "Rename {name}" or "Edit {name}" */
  editLabel?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Row gap={1}>
      <Button
        size="sm"
        aria-label={editLabel ?? t("manage.editNamed", { name })}
        onClick={onEdit}
      >
        <Pencil aria-hidden size={14} />
      </Button>
      <Button
        size="sm"
        variant="danger"
        aria-label={t("manage.deleteNamed", { name })}
        onClick={onDelete}
      >
        <Trash2 aria-hidden size={14} />
      </Button>
    </Row>
  );
}

export function SaveCancelButtons({
  canSave,
  onSave,
  onCancel,
}: {
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Row gap={2} justify="end">
      <Button
        size="sm"
        variant="secondary"
        text={t("cookingCommon.cancel")}
        onClick={onCancel}
      />
      <Button
        size="sm"
        variant="primary"
        text={t("cookingCommon.save")}
        isDisabled={!canSave}
        onClick={onSave}
      />
    </Row>
  );
}
