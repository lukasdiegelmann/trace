import { Checkbox, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { ImportOptions } from "./importApi";

const KEYS = ["addToPantry", "applyTags", "importCategories"] as const;

export function ImportOptionsFields({
  options,
  onChange,
  isDisabled,
}: {
  options: ImportOptions;
  onChange: (next: ImportOptions) => void;
  isDisabled?: boolean;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Stack gap={2}>
      {KEYS.map((key) => (
        <Stack gap={0} key={key}>
          <Checkbox
            checked={options[key]}
            disabled={isDisabled}
            label={t(`importers.options.${key}`)}
            onChange={(isChecked) => {
              onChange({ ...options, [key]: isChecked });
            }}
          />
          <Text variant="caption" tone="muted">
            {t(`importers.options.${key}Hint`)}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}
