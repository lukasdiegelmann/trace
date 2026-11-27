import { Checkbox, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

export interface ToolListProps {
  tools: string[];
  /** Only while cooking can tools be ticked off */
  checked?: number[];
  onToggle?: (index: number) => void;
}

/** The kitchen gear of a recipe */
export function ToolList({ tools, checked, onToggle }: ToolListProps) {
  const { t } = useTranslation("cooking");
  if (tools.length === 0) return null;
  return (
    <Stack gap={2} as="section">
      <Text variant="heading" as="h2">
        {t("recipeView.gear")}
      </Text>
      <Stack gap={1} as="ul">
        {tools.map((tool, index) => (
          <li key={`${index}-${tool}`}>
            {onToggle ? (
              <Checkbox
                checked={checked?.includes(index) ?? false}
                onChange={() => {
                  onToggle(index);
                }}
                label={tool}
              />
            ) : (
              <Text as="span">{tool}</Text>
            )}
          </li>
        ))}
      </Stack>
    </Stack>
  );
}
