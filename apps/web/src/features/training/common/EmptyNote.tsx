import { Button, Stack, Text } from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";

export interface EmptyNoteProps {
  icon?: ReactNode;
  /** A line above `text` that stands out */
  title?: string;
  text: string;
  action?: { text: string; icon?: ReactNode; onClick: () => void };
  /** E.g. more buttons */
  children?: ReactNode;
}

/** An empty or failed part of a screen, with room for whole sentences */
// TODO(monolithium): EmptyState cuts its text after one line and has no
// title; a multi-line, centred variant would replace this.
export function EmptyNote({
  icon,
  title,
  text,
  action,
  children,
}: EmptyNoteProps) {
  return (
    <Stack gap={2} align="center" paddingX={4} paddingY={8}>
      {icon ? (
        <span aria-hidden className="text-muted">
          {icon}
        </span>
      ) : null}
      {title ? <Text align="center">{title}</Text> : null}
      <Text tone="muted" variant="small" align="center">
        {text}
      </Text>
      {action ? (
        <Button
          size="sm"
          variant="secondary"
          text={action.text}
          onClick={() => {
            action.onClick();
          }}
        >
          {action.icon}
        </Button>
      ) : null}
      {children}
    </Stack>
  );
}
