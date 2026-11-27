import { Row, Stack, Text } from "@monocircuit/monolithium/components";
import type { ReactNode } from "react";

export interface SectionCardProps {
  title?: string;
  hint?: string;
  /** Buttons or a figure at the end of the heading row */
  actions?: ReactNode;
  children: ReactNode;
}

/** A titled, bordered block of a statistics or wellness screen */
export function SectionCard({
  title,
  hint,
  actions,
  children,
}: SectionCardProps) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-3 rounded-container border border-border bg-level-1 p-4"
    >
      {title || actions ? (
        <Row gap={3} align="start" justify="between">
          <Stack gap={1} minWidth={48}>
            {title ? (
              <Text variant="heading" as="h2">
                {title}
              </Text>
            ) : null}
            {hint ? <Text variant="caption">{hint}</Text> : null}
          </Stack>
          {actions}
        </Row>
      ) : null}
      {children}
    </section>
  );
}
