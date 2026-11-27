import { Stack, Text } from "@monocircuit/monolithium/components";

export interface PlaceholderPageProps {
  title: string;
  text: string;
}

/** A section that its feature thread hasn't built yet */
export function PlaceholderPage({ title, text }: PlaceholderPageProps) {
  return (
    <Stack gap={3} padding={6}>
      <Text variant="title" as="h1">
        {title}
      </Text>
      <Text tone="muted">{text}</Text>
    </Stack>
  );
}
