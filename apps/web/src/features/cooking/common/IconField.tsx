import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { CategoryIcon } from "./CategoryIcon";
import { CATEGORY_ICON_NAMES } from "./categoryIconMap";

/**
 * A pantry category's icon, stored as the old UI's Material Symbols name.
 * TODO(monolithium): an icon picker
 */
export function IconField({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Stack gap={1} role="group" aria-label={t("cookingCommon.icon")}>
      <Text variant="label">{t("cookingCommon.icon")}</Text>
      <Row gap={1} shouldWrap className="max-h-40 overflow-y-auto">
        {CATEGORY_ICON_NAMES.map((name) => (
          <Button
            key={name}
            size="sm"
            variant={value === name ? "primary" : "secondary"}
            aria-pressed={value === name}
            aria-label={name.replaceAll("_", " ")}
            onClick={() => {
              onChange(name);
            }}
          >
            <CategoryIcon name={name} size={18} />
          </Button>
        ))}
      </Row>
    </Stack>
  );
}
