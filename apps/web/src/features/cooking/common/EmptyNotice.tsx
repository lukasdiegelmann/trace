import { Button, Stack, Text } from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";

/**
 * An empty screen: what is missing, why, and what to do about it.
 * TODO(monolithium): EmptyState with a title and a wrapping description
 */
export function EmptyNotice({
  icon,
  title,
  text,
  actionText,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <Stack align="center" gap={3} padding={8} className="text-center">
      <span className="text-muted">{icon}</span>
      <Text variant="heading" as="h2">
        {title}
      </Text>
      {text ? (
        <Text tone="muted" className="max-w-prose">
          {text}
        </Text>
      ) : null}
      {actionText && onAction ? (
        <Button
          variant="primary"
          size="md"
          text={actionText}
          onClick={onAction}
        />
      ) : null}
    </Stack>
  );
}
